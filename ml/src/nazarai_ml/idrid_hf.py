"""Export the IDRiD disease-grading set (CC BY 4.0) from its Hugging Face parquet mirror to
image files + a labels CSV readable by dataset.idrid_manifest. Used as the EXTERNAL TEST SET.

    python -m nazarai_ml.idrid_hf --out /kaggle/working/idrid            # downloads train+test
    python -m nazarai_ml.idrid_hf --out ./idrid --parquet test.parquet   # from a local file
"""
from __future__ import annotations

import argparse
import io
from pathlib import Path

import pandas as pd

REPO = "amin-nejad/idrid-disease-grading"
FILES = {
    "train": "data/train-00000-of-00001-d81b05cdbfbe95cd.parquet",
    "test": "data/test-00000-of-00001-3eaaa0286c6f240e.parquet",
}


def export(parquets: dict[str, str], out: Path) -> Path:
    img_dir = out / "images"
    img_dir.mkdir(parents=True, exist_ok=True)
    rows = []
    for split, path in parquets.items():
        df = pd.read_parquet(path)
        for i, r in df.iterrows():
            name = f"idrid_{split}_{i:03d}"
            data = r["image"]["bytes"]
            ext = ".png" if data[:4] == b"\x89PNG" else ".jpg"
            (img_dir / f"{name}{ext}").write_bytes(data)
            rows.append({"Image name": name, "Retinopathy grade": int(r["label"])})
    csv = out / "labels.csv"
    pd.DataFrame(rows).to_csv(csv, index=False)
    print(f"exported {len(rows)} IDRiD images to {img_dir}")
    return csv


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--parquet", help="local parquet file (skips download)")
    args = ap.parse_args()
    if args.parquet:
        parquets = {"local": args.parquet}
    else:
        from huggingface_hub import hf_hub_download

        parquets = {s: hf_hub_download(REPO, f, repo_type="dataset") for s, f in FILES.items()}
    export(parquets, Path(args.out))


if __name__ == "__main__":
    main()
