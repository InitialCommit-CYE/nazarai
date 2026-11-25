# Fallback: EyePACS-only model (`efficientnet_b3-384-202611250727`)

**Not the deployed model.** Archived here so it can be restored if the APTOS run fails.

- Training data: EyePACS / Kaggle DR Detection 2015 (US screening photos), resized community copy
  `tanlikesmath/diabetic-retinopathy-resized`, 30,089 images, 10 epochs on a Kaggle T4.
- External test (IDRiD, n = 516): referable sensitivity 100%, specificity 52.8%, AUC 0.981, QWK 0.840.
- Weights are not in git; they are in the output of that Kaggle training run (kernel `hassanagddsbdxfg/nazarai-train`).

**Why it is parked:** the team moved to APTOS 2019 (India), a population and camera mix much closer to Pakistani
clinics. See `DECISIONS.md`.

**To restore:** copy `reports/*` back into `ml/reports/`, upload that run's weights with `scripts/upload_model.py` and
restart the Hugging Face Space. Also restore the EyePACS dataset disclosure in `README.md`.
