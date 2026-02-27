# Facialy — Sistema de Control de Acceso Facial

Sistema de reconocimiento facial para control de acceso empresarial. Los empleados se registran mediante su webcam; el modelo EigenFace aprende su rostro en segundos y, a partir de ese momento, los identifica en tiempo real simulando la concesión de acceso.

Proyecto fullstack desarrollado por **[DevEps](https://github.com/devepsdev)** como portfolio de ingeniería de software.

---

## Características

- **Registro desde el navegador** — captura 100 fotogramas via `getUserMedia`, no se requiere cámara en el servidor
- **Entrenamiento on-demand** — OpenCV EigenFaceRecognizer entrenado al vuelo; las fotos se eliminan del disco tras el entrenamiento
- **Reconocimiento en vivo** — bounding boxes con nombre superpuestos sobre el vídeo en tiempo real
- **CRUD de empleados** — alta completa o registro rápido desde la demo + edición inline posterior
- **Logs de acceso** — historial de intentos con confianza, resultado y timestamp
- **Dashboard** — métricas diarias de accesos concedidos, denegados y desconocidos
- **SPA con Django** — el build de React se sirve directamente desde Gunicorn + WhiteNoise, sin Node en producción
- **Docker multi-stage** — imagen final mínima (python:3.12-slim) con el frontend ya compilado dentro
- **CI/CD automático** — push a `main` despliega en el servidor via GitHub Actions con runner self-hosted

---

## Stack Tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Backend | Django + Django REST Framework | 6.0.2 / 3.16 |
| Visión artificial | OpenCV contrib (headless) | 4.13.0 |
| Base de datos | PostgreSQL | 16 |
| Frontend | React + Vite | 19 / 7 |
| Estilos | Tailwind CSS v4 | 4.x |
| Enrutado | React Router | 7 |
| HTTP client | Axios | 1.x |
| Servidor WSGI | Gunicorn | — |
| Static files | WhiteNoise | 6.x |
| Contenedores | Docker + Docker Compose | — |
| CI/CD | GitHub Actions (self-hosted) | — |

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                     Apache (reverse proxy)              │
│              http://host/facialy/ → :8000               │
└──────────────────────────┬──────────────────────────────┘
                           │
            ┌──────────────▼──────────────┐
            │   Django 6 + Gunicorn :8000 │
            │                             │
            │  /facialy/api/*  ──► DRF    │
            │  /facialy/*      ──► SPA    │
            │  /facialy/static/*WhiteNoise│
            └──────┬──────────────┬───────┘
                   │              │
        ┌──────────▼──┐   ┌───────▼──────────┐
        │ PostgreSQL  │   │ OpenCV EigenFace │
        │  (logs +    │   │  face_model.xml  │
        │  employees) │   │  label_map.json  │
        └─────────────┘   └──────────────────┘
```

### Flujo de reconocimiento facial

```
Browser                           Django
  │                                 │
  │── POST /api/capture-frame/ ────►│  Haar Cascade detecta cara
  │   (base64 JPEG × 100)           │  Guarda 160×160 px en /face_data/
  │                                 │
  │── POST /api/train/ ────────────►│  EigenFaceRecognizer.train()
  │                                 │  Guarda face_model.xml
  │                                 │  Borra /face_data/ (GDPR-friendly)
  │                                 │  Crea registro Employee en BD
  │                                 │
  │── POST /api/recognize/ ────────►│  Predice identidad + confianza
  │◄── { results: [{name, box}] } ──│  Devuelve bounding boxes
  │                                 │
  │  Canvas overlay dibuja cajas    │
```

---

## Estructura del proyecto

```
facialy/
├── backend/
│   ├── config/
│   │   ├── settings.py          # Configuración Django
│   │   ├── urls.py              # Rutas principales + catch-all SPA
│   │   └── wsgi.py
│   └── core/
│       ├── migrations/          # 0001_initial, 0002_optional_fields
│       ├── models.py            # Employee, AccessLog
│       ├── serializers.py       # DRF serializers
│       ├── services.py          # Lógica OpenCV (capture, train, recognize)
│       ├── views.py             # ViewSets + endpoints funcionales
│       └── urls.py              # Router DRF + URLs adicionales
├── frontend/
│   └── src/
│       ├── api/client.js        # Axios con baseURL '/facialy/api/'
│       ├── components/Navbar.jsx
│       └── pages/
│           ├── Home.jsx         # Landing page
│           ├── Demo.jsx         # Demo interactiva (state machine)
│           ├── Dashboard.jsx    # Métricas diarias
│           ├── Employees.jsx    # CRUD empleados + edición inline
│           └── AccessLogs.jsx   # Historial de accesos
├── .github/workflows/deploy.yml # Pipeline CI/CD
├── Dockerfile                   # Multi-stage build
├── docker-compose.yml
└── .env.example                 # Plantilla de variables de entorno
```

---

## Inicio rápido

### Prerrequisitos

- Docker ≥ 24 y Docker Compose v2
- (Opcional) Node 20 y Python 3.12 para desarrollo local sin Docker

### 1. Clonar el repositorio

```bash
git clone https://github.com/devepsdev/facialy.git
cd facialy
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
# Edita .env con tus credenciales
```

### 3. Levantar con Docker Compose

```bash
docker compose up -d --build
docker compose exec web python manage.py migrate
```

La aplicación queda disponible en `http://localhost:8000/facialy/`.

---

## Variables de entorno

Crea un archivo `.env` en la raíz del proyecto a partir de `.env.example`:

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `SECRET_KEY` | Clave secreta Django | `django-insecure-...` |
| `DB_NAME` | Nombre de la base de datos | `facialy` |
| `DB_USER` | Usuario PostgreSQL | `facialy_user` |
| `DB_PASSWORD` | Contraseña PostgreSQL | `superSecreta123!` |
| `DB_HOST` | Host de la BD (en Docker: `db`) | `db` |

> **Nunca** subas el archivo `.env` real al repositorio. Está en `.gitignore`.

---

## API Reference

Base URL: `/facialy/api/`

### Reconocimiento facial

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `capture-frame/` | Recibe frame base64, detecta cara y la almacena |
| `POST` | `train/` | Entrena el modelo y crea registro Employee |
| `POST` | `recognize/` | Predice identidad en un frame base64 |
| `POST` | `cleanup/` | Elimina fotos, modelo y label map |

#### POST `capture-frame/`

```json
// Request
{ "visitor_name": "María García", "frame": "data:image/jpeg;base64,..." }

// Response
{ "count": 42, "total": 100, "face_detected": true }
```

#### POST `train/`

```json
// Request
{ "visitor_name": "María García" }

// Response
{ "success": true, "message": "Modelo entrenado correctamente", "employee_id": 7 }
```

#### POST `recognize/`

```json
// Request
{ "visitor_name": "María García", "frame": "data:image/jpeg;base64,..." }

// Response
{ "results": [{ "name": "María García", "confidence": 4821.3, "box": [120, 80, 160, 160] }] }
```

### CRUD Empleados

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `employees/` | Listado de empleados |
| `POST` | `employees/` | Crear empleado (solo `first_name` es obligatorio) |
| `GET` | `employees/{id}/` | Detalle |
| `PATCH` | `employees/{id}/` | Actualización parcial |
| `DELETE` | `employees/{id}/` | Eliminar |

### Logs y Dashboard

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `access-logs/` | Historial de accesos |
| `GET` | `dashboard/` | Métricas del día actual |

---

## CI/CD

El pipeline en [.github/workflows/deploy.yml](.github/workflows/deploy.yml) se ejecuta en cada push a `main` sobre un runner **self-hosted** instalado en un Orange Pi 5 con Armbian:

```
push → main
  └── Checkout código
  └── Crear .env desde GitHub Secrets
  └── docker compose up -d --build
  └── sleep 10  (espera a PostgreSQL)
  └── docker compose exec web python manage.py migrate
```

Los secretos necesarios en GitHub Actions son: `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `SECRET_KEY`.

---

## Desarrollo local (sin Docker)

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt gunicorn
cp ../.env.example ../.env  # ajusta DB_HOST=localhost
python manage.py migrate
python manage.py runserver
```

> OpenCV headless requiere `libgl1` en Linux: `sudo apt install libgl1-mesa-glx`

### Frontend

```bash
cd frontend
npm install
npm run dev   # proxy a localhost:8000 para la API
```

La app estará en `http://localhost:5173`.

> En desarrollo el `base` de Vite es `/facialy/static/`. Configura el proxy de Vite si quieres que las llamadas `/facialy/api/` se reenvíen al backend local.

---

## Modelos de datos

### Employee

| Campo | Tipo | Obligatorio | Descripción |
|-------|------|-------------|-------------|
| `first_name` | `CharField` | ✅ | Nombre |
| `last_name` | `CharField` | — | Apellido |
| `email` | `EmailField` (unique) | — | Email corporativo |
| `department` | `CharField` | — | Departamento |
| `schedule_entry` | `TimeField` | — | Hora de entrada |
| `schedule_exit` | `TimeField` | — | Hora de salida |
| `is_active` | `BooleanField` | — | Activo/Inactivo (default: True) |
| `created_at` | `DateTimeField` | — | Fecha de registro |

> Los campos opcionales permiten el registro rápido desde la demo interactiva; se completan posteriormente desde la página de Empleados.

### AccessLog

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `employee` | `FK → Employee` | Empleado identificado (nullable) |
| `timestamp` | `DateTimeField` | Momento del intento |
| `result` | `CharField` | `GRANTED` / `DENIED` / `UNKNOWN` |
| `confidence` | `FloatField` | Distancia EigenFace (menor = mejor) |

---

## Notas de seguridad para producción

- Establecer `DEBUG = False` en `settings.py`
- Definir `ALLOWED_HOSTS` con el dominio real
- Generar una `SECRET_KEY` segura (mínimo 50 caracteres aleatorios)
- Usar HTTPS y configurar `SECURE_SSL_REDIRECT = True`
- El modelo facial es efímero; no persiste datos biométricos entre sesiones de demo

---

## Licencia

Proyecto de portfolio — uso libre para referencia y aprendizaje.
Desarrollado por **DevEps** · [github.com/devepsdev](https://github.com/devepsdev)

## Contacto

- Portfolio: [deveps.ddns.net](https://deveps.ddns.net)
- Email: devepsdev@gmail.com
- LinkedIn: [www.linkedin.com/in/enrique-perez-sanchez](https://www.linkedin.com/in/enrique-perez-sanchez/)
- GitHub: [github.com/devepsdev](https://github.com/devepsdev)

