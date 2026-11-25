"""NazarAI ML service package. Makes the shared ml/src package importable (single source of preprocessing)."""
import sys
from pathlib import Path

_ML_SRC = Path(__file__).resolve().parents[2] / "ml" / "src"
if str(_ML_SRC) not in sys.path:
    sys.path.insert(0, str(_ML_SRC))
