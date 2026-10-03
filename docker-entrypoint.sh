#!/bin/sh
set -e

python manage.py migrate --noinput
# Crea/actualiza el administrador si ADMIN_PASSWORD está definida (no hace nada si no)
python manage.py ensure_admin
# Datos de ejemplo para el demo público (solo si no hay empleados todavía)
if [ "$SEED_DEMO" = "true" ]; then
    python manage.py seed_demo
fi

# Un único proceso: las sesiones de captura viven en memoria y deben compartirse entre peticiones.
# La concurrencia se obtiene con hilos (OpenCV libera el GIL durante la inferencia).
exec gunicorn config.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers 1 --threads 4 \
    --timeout 60 \
    --access-logfile -
