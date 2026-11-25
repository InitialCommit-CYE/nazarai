"""Model definition: timm ImageNet backbone with a single regression output (continuous grade)."""
from __future__ import annotations

import torch
import timm

SUPPORTED_BACKBONES = ("efficientnet_b3", "convnext_tiny")


def build_model(backbone: str = "efficientnet_b3", pretrained: bool = True, drop_rate: float = 0.3) -> torch.nn.Module:
    if backbone not in SUPPORTED_BACKBONES:
        raise ValueError(f"unsupported backbone {backbone!r}; choose from {SUPPORTED_BACKBONES}")
    return timm.create_model(backbone, pretrained=pretrained, num_classes=1, drop_rate=drop_rate)


def gradcam_target_layer(model: torch.nn.Module, backbone: str) -> torch.nn.Module:
    """Last convolutional block used by Grad-CAM (CLAUDE.md section 4.5)."""
    if backbone.startswith("efficientnet"):
        return model.conv_head
    if backbone.startswith("convnext"):
        return model.stages[-1]
    raise ValueError(f"no Grad-CAM target layer known for {backbone!r}")


def load_checkpoint(path: str, backbone: str, map_location: str = "cpu") -> torch.nn.Module:
    model = build_model(backbone, pretrained=False)
    state = torch.load(path, map_location=map_location, weights_only=True)
    if isinstance(state, dict) and "state_dict" in state:
        state = state["state_dict"]
    model.load_state_dict(state)
    model.eval()
    return model


@torch.no_grad()
def predict_tta(model: torch.nn.Module, x: torch.Tensor) -> torch.Tensor:
    """Test-time augmentation over flips. x: (B,3,H,W). Returns (B, 4) scores per view."""
    views = [x, torch.flip(x, dims=[3]), torch.flip(x, dims=[2]), torch.flip(x, dims=[2, 3])]
    return torch.cat([model(v).reshape(-1, 1) for v in views], dim=1)
