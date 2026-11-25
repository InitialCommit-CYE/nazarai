# Evaluation artefacts

`python -m nazarai_ml.evaluate` writes here:

- `metrics.json`: the single source of every number shown on the Model Performance page
- `confusion_matrix_validation.png`, `confusion_matrix_external_test.png`, `roc.png`

No `metrics.json` is committed until the trained model has actually been evaluated. Until then the
app shows an honest "Evaluation pending" state. Never edit these numbers by hand.
