"""Dataset manifests, patient-level splits and the PyTorch Dataset.

A manifest is a CSV with columns: path, grade, patient_id, source.

CLI (run on Kaggle, where the datasets are mounted):
    python -m nazarai_ml.dataset build \
        --aptos-root /kaggle/input/aptos2019-blindness-detection \
        --eyepacs-csv /kaggle/input/diabetic-retinopathy-resized/trainLabels.csv \
        --eyepacs-images /kaggle/input/diabetic-retinopathy-resized/resized_train/resized_train \
        --idrid-csv ".../B. Disease Grading/2. Groundtruths/b. IDRiD_Disease Grading_Testing Labels.csv" \
        --idrid-images ".../B. Disease Grading/1. Original Images/b. Testing Set" \
        --out /kaggle/working/manifests
"""
from __future__ import annotations

import argparse
import os
from pathlib import Path

import numpy as np
import pandas as pd

from .preprocess import normalize, prepare_fundus, read_image

IMAGE_EXTS = (".png", ".jpg", ".jpeg", ".tif", ".tiff")


_DIR_INDEX: dict[Path, dict[str, str]] = {}


def _resolve(img_dir: Path, stem: str) -> str | None:
    """Find <stem>.<ext> using ONE directory listing per folder (per-file stat calls are very
    slow on network-mounted Kaggle inputs: ~100k calls for EyePACS)."""
    index = _DIR_INDEX.get(img_dir)
    if index is None:
        index = {}
        with os.scandir(img_dir) as it:
            for entry in it:
                root, ext = os.path.splitext(entry.name)
                if ext.lower() in IMAGE_EXTS and root not in index:
                    index[root] = entry.path
        _DIR_INDEX[img_dir] = index
    return index.get(stem)


def aptos_manifest(root: str) -> pd.DataFrame:
    """APTOS 2019: train.csv (id_code, diagnosis) + train_images/. No patient IDs are released,
    so each image is its own group."""
    root_p = Path(root)
    df = pd.read_csv(root_p / "train.csv")
    img_dir = root_p / "train_images"
    rows = []
    for r in df.itertuples():
        p = _resolve(img_dir, r.id_code)
        if p:
            rows.append({"path": p, "grade": int(r.diagnosis), "patient_id": f"aptos_{r.id_code}", "source": "aptos2019"})
    return pd.DataFrame(rows)


def eyepacs_manifest(csv_path: str, img_dir: str) -> pd.DataFrame:
    """EyePACS (Kaggle DR 2015): trainLabels.csv (image, level). image = '<patient>_<left|right>'.
    Both eyes of a patient share patient_id, so a patient never spans train and validation."""
    df = pd.read_csv(csv_path)
    img_p = Path(img_dir)
    rows = []
    for r in df.itertuples():
        p = _resolve(img_p, r.image)
        if p:
            patient = str(r.image).rsplit("_", 1)[0]
            rows.append({"path": p, "grade": int(r.level), "patient_id": f"eyepacs_{patient}", "source": "eyepacs"})
    return pd.DataFrame(rows)


def idrid_manifest(csv_path: str, img_dir: str) -> pd.DataFrame:
    """IDRiD disease-grading labels ('Image name', 'Retinopathy grade'). EXTERNAL TEST ONLY."""
    df = pd.read_csv(csv_path)
    df.columns = [c.strip() for c in df.columns]
    img_p = Path(img_dir)
    rows = []
    for r in df.itertuples(index=False):
        name = str(r[0]).strip()
        grade = int(r[1])
        p = _resolve(img_p, name)
        if p:
            rows.append({"path": p, "grade": grade, "patient_id": f"idrid_{name}", "source": "idrid"})
    return pd.DataFrame(rows)


def _downscale_one(job: tuple[str, str, int]) -> str | None:
    src, dst, max_side = job
    import cv2

    if not os.path.exists(dst):
        bgr = cv2.imread(src, cv2.IMREAD_COLOR)
        if bgr is None:
            return None
        h, w = bgr.shape[:2]
        scale = max_side / max(h, w)
        if scale < 1.0:
            bgr = cv2.resize(bgr, (round(w * scale), round(h * scale)), interpolation=cv2.INTER_AREA)
        cv2.imwrite(dst, bgr, [cv2.IMWRITE_PNG_COMPRESSION, 1])
    return dst


def cache_downscaled(df: pd.DataFrame, out_dir: str, max_side: int = 1024, workers: int = 4) -> pd.DataFrame:
    """Write a lossless copy of each image with its longer side capped at `max_side` and point the
    manifest at it. Raw-image resizing only (like the pre-resized EyePACS copy): the shared
    prepare_fundus pipeline still runs unchanged on the cached file. Saves re-decoding
    full-resolution APTOS PNGs every epoch."""
    from multiprocessing import Pool

    os.makedirs(out_dir, exist_ok=True)
    jobs = [(p, os.path.join(out_dir, Path(p).stem + ".png"), max_side) for p in df["path"]]
    if workers <= 1:
        new_paths = [_downscale_one(j) for j in jobs]
    else:
        with Pool(workers) as pool:
            new_paths = pool.map(_downscale_one, jobs, chunksize=16)
    out = df.copy()
    out["path"] = new_paths
    return out[out["path"].notna()].reset_index(drop=True)


def patient_level_split(df: pd.DataFrame, val_fraction: float = 0.15, seed: int = 42) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Stratified-by-grade, grouped-by-patient split."""
    from sklearn.model_selection import StratifiedGroupKFold

    n_splits = max(2, round(1 / val_fraction))
    sgkf = StratifiedGroupKFold(n_splits=n_splits, shuffle=True, random_state=seed)
    train_idx, val_idx = next(sgkf.split(df, df["grade"], groups=df["patient_id"]))
    train, val = df.iloc[train_idx].reset_index(drop=True), df.iloc[val_idx].reset_index(drop=True)
    assert not set(train.patient_id) & set(val.patient_id), "patient leakage between train and validation"
    return train, val


def class_weights(grades: np.ndarray) -> np.ndarray:
    """Per-sample weights for a WeightedRandomSampler (inverse sqrt frequency, softened)."""
    counts = np.bincount(grades, minlength=5).astype(np.float64)
    w_class = 1.0 / np.sqrt(np.maximum(counts, 1))
    return w_class[grades]


try:  # torch is optional for manifest building
    import torch
    from torch.utils.data import Dataset

    class FundusDataset(Dataset):
        def __init__(self, df: pd.DataFrame, size: int, augment=None):
            self.paths = df["path"].tolist()
            self.grades = df["grade"].to_numpy(dtype=np.float32)
            self.size = size
            self.augment = augment

        def __len__(self) -> int:
            return len(self.paths)

        def __getitem__(self, i: int):
            img = read_image(self.paths[i])
            x = prepare_fundus(img, self.size).model_input_uint8
            if self.augment is not None:
                x = self.augment(image=x)["image"]
            return torch.from_numpy(normalize(x)), torch.tensor(self.grades[i])

except ImportError:  # pragma: no cover
    pass


def train_augmentations(size: int):
    """Geometric + mild photometric augmentation. No hue/colour shifts: lesion colour matters."""
    import albumentations as A

    try:  # albumentations >= 1.4.x / 2.x
        affine = A.Affine(scale=(0.92, 1.08), translate_percent=(-0.04, 0.04), border_mode=0, p=0.5)
    except TypeError:  # older releases name the border argument "mode"
        affine = A.Affine(scale=(0.92, 1.08), translate_percent=(-0.04, 0.04), mode=0, p=0.5)
    return A.Compose(
        [
            A.HorizontalFlip(p=0.5),
            A.VerticalFlip(p=0.5),
            A.Rotate(limit=180, border_mode=0, p=0.9),
            affine,
            A.RandomBrightnessContrast(brightness_limit=0.1, contrast_limit=0.1, p=0.5),
        ]
    )


def main() -> None:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    b = sub.add_parser("build", help="build train/val/test manifests")
    b.add_argument("--aptos-root")
    b.add_argument("--aptos-cache-dir", help="write downscaled APTOS copies here (faster epochs)")
    b.add_argument("--cache-max-side", type=int, default=1024)
    b.add_argument("--eyepacs-csv")
    b.add_argument("--eyepacs-images")
    b.add_argument("--max-eyepacs", type=int, default=0, help="subsample EyePACS (0 = all) to fit the GPU budget")
    b.add_argument("--idrid-csv")
    b.add_argument("--idrid-images")
    b.add_argument("--val-fraction", type=float, default=0.15)
    b.add_argument("--out", required=True)
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    parts = []
    if args.aptos_root:
        ap_df = aptos_manifest(args.aptos_root)
        if args.aptos_cache_dir:
            ap_df = cache_downscaled(ap_df, args.aptos_cache_dir, args.cache_max_side, workers=os.cpu_count() or 4)
            print(f"cached {len(ap_df)} APTOS images (longer side <= {args.cache_max_side}) in {args.aptos_cache_dir}")
        parts.append(ap_df)
    if args.eyepacs_csv and args.eyepacs_images:
        ep = eyepacs_manifest(args.eyepacs_csv, args.eyepacs_images)
        if args.max_eyepacs and len(ep) > args.max_eyepacs:
            keep = ep["patient_id"].drop_duplicates().sample(frac=1.0, random_state=0)
            keep = set(keep.iloc[: args.max_eyepacs // 2])
            ep = ep[ep.patient_id.isin(keep)]
        parts.append(ep)
    if not parts:
        raise SystemExit("no training data sources given")
    full = pd.concat(parts, ignore_index=True)
    train, val = patient_level_split(full, args.val_fraction)
    train.to_csv(Path(args.out) / "train.csv", index=False)
    val.to_csv(Path(args.out) / "val.csv", index=False)
    print(f"train={len(train)} val={len(val)}")
    print("train grades:", np.bincount(train.grade, minlength=5).tolist())
    print("val grades:  ", np.bincount(val.grade, minlength=5).tolist())
    if args.idrid_csv and args.idrid_images:
        test = idrid_manifest(args.idrid_csv, args.idrid_images)
        test.to_csv(Path(args.out) / "test_idrid.csv", index=False)
        print(f"external test (IDRiD) = {len(test)}", np.bincount(test.grade, minlength=5).tolist())


if __name__ == "__main__":
    main()
