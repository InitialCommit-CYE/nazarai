# NazarAI ML inference service. Build context = repository root:
#   docker build -f backend/Dockerfile -t nazarai-ml .
# Hugging Face Spaces (Docker SDK) uses the same file at the Space root (see scripts/deploy_hf_space.py).
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# OpenCV headless needs glib at runtime.
RUN apt-get update \
 && apt-get install -y --no-install-recommends libglib2.0-0 \
 && rm -rf /var/lib/apt/lists/*

# Hugging Face Spaces run containers as uid 1000.
RUN useradd -m -u 1000 user
WORKDIR /home/user/app

COPY backend/requirements.txt backend/requirements.txt
RUN pip install -r backend/requirements.txt

COPY --chown=user ml/src ml/src
COPY --chown=user ml/reports ml/reports
COPY --chown=user backend/app backend/app
RUN mkdir -p ml/weights && chown -R user:user ml/weights

USER user
ENV APP_ENV=production \
    MODEL_DIR=/home/user/app/ml/weights \
    METRICS_PATH=/home/user/app/ml/reports/metrics.json \
    HF_HOME=/home/user/.cache/huggingface \
    OMP_NUM_THREADS=2

WORKDIR /home/user/app/backend
EXPOSE 7860
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:7860/health', timeout=4)"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860", "--workers", "1", "--timeout-keep-alive", "30"]
