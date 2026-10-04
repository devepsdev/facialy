# ── Etapa 1: build del frontend ──────────────────────────────────────────────
FROM node:20-slim AS frontend
# Prefijo de la app: /facialy (Orange Pi) o vacío (subdominio propio)
ARG BASE_PATH=/facialy
ENV VITE_BASE_PATH=$BASE_PATH
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# ── Etapa 2: backend + SPA compilada ─────────────────────────────────────────
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Modelos ONNX (YuNet + SFace) verificados por SHA-256; capa propia para cachearla
COPY backend/download_models.py .
RUN python download_models.py /app/models

COPY backend/ .
COPY --from=frontend /frontend/dist ./frontend_dist
COPY docker-entrypoint.sh /docker-entrypoint.sh

RUN SECRET_KEY=build-only python manage.py collectstatic --noinput \
    && chmod +x /docker-entrypoint.sh \
    && useradd --system --create-home app \
    && chown -R app:app /app
USER app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health/', timeout=4).status == 200 else 1)"

CMD ["/docker-entrypoint.sh"]
