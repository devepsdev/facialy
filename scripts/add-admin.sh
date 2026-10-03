#!/bin/sh
# Uso: scripts/add-admin.sh tu@email.com [user|admin|superadmin] ["Nombre Apellidos"]
# Ejecuta add_user dentro del contenedor facialy_web (pide la contraseña sin eco).
set -e
EMAIL="${1:?Falta el email}"
ROLE="${2:-superadmin}"
NAME="${3:-}"
exec docker exec -it facialy_web python manage.py add_user --email "$EMAIL" --role "$ROLE" --name "$NAME"
