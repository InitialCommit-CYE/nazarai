"""Train the ordinal-regression DR model (CLAUDE.md section 4.3). Designed for a Kaggle GPU.

    python -m nazarai_ml.train --manifests /kaggle/working/manifests --out /kaggle/working/run1 \
        --backbone efficientnet_b3 --size 384 --epochs 12 --batch-size 24

Outputs in --out:
    model.pt            best state_dict (by validation QWK)
    model_config.json   backbone, size, optimised thresholds, referral threshold, version
    val_predictions.csv validation scores (TTA) used for threshold optimisation
    history.json        per-epoch loss / QWK
"""
from __future__ import annotations

import argparse
import json
import math
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from torch.utils.data import DataLoader, WeightedRandomSampler

from .dataset import FundusDataset, class_weights, train_augmentations
from .model import build_model, predict_tta
from .thresholds import DEFAULT_THRESHOLDS, apply_thresholds, choose_referral_threshold, optimise_grade_thresholds, qwk


def cosine_with_warmup(optimizer, warmup_steps: int, total_steps: int):
    def fn(step: int) -> float:
        if step < warmup_steps:
            return (step + 1) / warmup_steps
        progress = (step - warmup_steps) / max(1, total_steps - warmup_steps)
        return 0.5 * (1 + math.cos(math.pi * progress))

    return torch.optim.lr_scheduler.LambdaLR(optimizer, fn)


@torch.no_grad()
def predict(model, loader, device, tta: bool = False) -> np.ndarray:
    model.eval()
    out = []
    for x, _ in loader:
        x = x.to(device, non_blocking=True)
        with torch.autocast(device_type=device.type, enabled=device.type == "cuda"):
            s = predict_tta(model, x).mean(dim=1) if tta else model(x).reshape(-1)
        out.append(s.float().cpu().numpy())
    return np.concatenate(out)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifests", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--backbone", default="efficientnet_b3")
    ap.add_argument("--size", type=int, default=384)
    ap.add_argument("--epochs", type=int, default=12)
    ap.add_argument("--batch-size", type=int, default=24)
    ap.add_argument("--lr", type=float, default=1e-4, help="backbone learning rate")
    ap.add_argument("--head-lr-mult", type=float, default=10.0)
    ap.add_argument("--weight-decay", type=float, default=1e-4)
    ap.add_argument("--warmup-epochs", type=float, default=0.5)
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--balanced-sampler", action="store_true")
    ap.add_argument("--target-sensitivity", type=float, default=0.90)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    torch.manual_seed(args.seed)
    np.random.seed(args.seed)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    train_df = pd.read_csv(Path(args.manifests) / "train.csv")
    val_df = pd.read_csv(Path(args.manifests) / "val.csv")
    train_ds = FundusDataset(train_df, args.size, augment=train_augmentations(args.size))
    val_ds = FundusDataset(val_df, args.size)

    sampler = None
    if args.balanced_sampler:
        w = class_weights(train_df.grade.to_numpy())
        sampler = WeightedRandomSampler(torch.as_tensor(w, dtype=torch.double), num_samples=len(w), replacement=True)
    train_dl = DataLoader(train_ds, batch_size=args.batch_size, shuffle=sampler is None, sampler=sampler,
                          num_workers=args.workers, pin_memory=True, drop_last=True, persistent_workers=args.workers > 0)
    val_dl = DataLoader(val_ds, batch_size=args.batch_size * 2, shuffle=False, num_workers=args.workers, pin_memory=True)

    model = build_model(args.backbone, pretrained=True).to(device)
    head = model.get_classifier()
    head_ids = {id(p) for p in head.parameters()}
    backbone_params = [p for p in model.parameters() if id(p) not in head_ids]
    optimizer = torch.optim.AdamW(
        [{"params": backbone_params, "lr": args.lr}, {"params": head.parameters(), "lr": args.lr * args.head_lr_mult}],
        weight_decay=args.weight_decay,
    )
    steps_per_epoch = len(train_dl)
    scheduler = cosine_with_warmup(optimizer, int(args.warmup_epochs * steps_per_epoch), args.epochs * steps_per_epoch)
    scaler = torch.amp.GradScaler(enabled=device.type == "cuda")
    criterion = torch.nn.SmoothL1Loss()

    history, best_qwk = [], -1.0
    y_val = val_df.grade.to_numpy()
    for epoch in range(args.epochs):
        model.train()
        t0, running = time.time(), 0.0
        for step, (x, y) in enumerate(train_dl):
            x, y = x.to(device, non_blocking=True), y.to(device, non_blocking=True)
            optimizer.zero_grad(set_to_none=True)
            with torch.autocast(device_type=device.type, enabled=device.type == "cuda"):
                loss = criterion(model(x).reshape(-1), y)
            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()
            scheduler.step()
            running += loss.item()
            if step % 100 == 0:
                print(f"epoch {epoch} step {step}/{steps_per_epoch} loss {loss.item():.4f}", flush=True)
        scores = predict(model, val_dl, device)
        val_qwk = qwk(y_val, apply_thresholds(scores, DEFAULT_THRESHOLDS))
        rec = {"epoch": epoch, "train_loss": running / steps_per_epoch, "val_qwk_default_thresholds": val_qwk,
               "seconds": round(time.time() - t0, 1)}
        history.append(rec)
        print(json.dumps(rec), flush=True)
        if val_qwk > best_qwk:
            best_qwk = val_qwk
            torch.save(model.state_dict(), out / "model.pt")
        (out / "history.json").write_text(json.dumps(history, indent=2))

    # Thresholds are fitted on VALIDATION predictions of the best checkpoint (with TTA,
    # exactly as served). The external test set is not touched here.
    model.load_state_dict(torch.load(out / "model.pt", map_location=device, weights_only=True))
    scores = predict(model, val_dl, device, tta=True)
    pd.DataFrame({"path": val_df.path, "grade": y_val, "score": scores}).to_csv(out / "val_predictions.csv", index=False)
    thresholds = optimise_grade_thresholds(scores, y_val)
    referral = choose_referral_threshold(scores, y_val, thresholds, args.target_sensitivity)
    version = f"{args.backbone}-{args.size}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M')}"
    config = {
        "model_version": version,
        "trained": True,
        "backbone": args.backbone,
        "image_size": args.size,
        "grade_thresholds": thresholds,
        "referral_threshold": referral["threshold"],
        "referral_selection": referral,
        "val_qwk_default_thresholds": best_qwk,
        "val_qwk_optimised_thresholds": qwk(y_val, apply_thresholds(scores, thresholds)),
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "train_sources": sorted(train_df.source.unique().tolist()),
        "n_train": len(train_df),
        "n_val": len(val_df),
        "epochs": args.epochs,
    }
    (out / "model_config.json").write_text(json.dumps(config, indent=2))
    print(json.dumps(config, indent=2))


if __name__ == "__main__":
    main()
