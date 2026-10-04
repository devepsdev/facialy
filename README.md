# Facialy — Control de acceso facial

Sistema de control de acceso con reconocimiento facial en tiempo real. Los empleados se registran con la webcam desde el navegador, un **kiosco** reconoce a quien llega y decide si puede entrar (horario, estado), y cada evento queda auditado en un **dashboard** con filtros y exportación CSV.

Proyecto fullstack de **[DevEps](https://github.com/devepsdev)**, desplegado con CI/CD en un VPS: **[facialy.deveps.dev](https://facialy.deveps.dev)**.

---

## Qué hace

| Área | Funcionalidad |
|------|---------------|
| **Demo pública** | Te registras con tu webcam en unos segundos y compruebas que te reconoce. Todo ocurre en una sesión efímera **en memoria**: no se escribe nada en la base de datos y caduca sola. |
| **Registro de empleados** | Alta desde el panel + captura guiada del rostro (30 fotogramas válidos) con consentimiento explícito. Re-registro y borrado individual del dato biométrico. |
| **Kiosco** | Reconocimiento continuo, veredicto a pantalla completa (concedido / denegado / no identificado), aviso sonoro, historial en vivo y registro automático con anti-duplicados. |
| **Reglas de acceso** | Empleado inactivo → denegado. Horario por empleado con margen configurable, incluidos **turnos nocturnos**. Cada denegación guarda su motivo. |
| **Dashboard** | KPIs del día vs. ayer, accesos de 7 días, reparto de resultados, franja horaria, ranking de empleados, actividad reciente (auto-refresco). |
| **Registro de accesos** | Filtros por resultado, fechas y empleado; paginación; **exportación CSV** (protegida contra inyección de fórmulas). |
| **Cuentas y roles** | Registro público + login con **JWT**. Cuatro roles: **invitado** (solo lectura, solo datos de demo), **usuario**, **administrador** y **superadmin**. |
| **Mi perfil (usuario)** | Registra tu propio rostro, **verificación 1:1** en vivo, historial propio y borrado de tu huella o de toda tu cuenta (derecho de supresión). |
| **Superadmin** | Gestión de cuentas (rol, activar/desactivar, borrar) y **registro de auditoría** (logins, fallos, cambios de rol, borrados). |
| **Seguridad** | Access token de 15 min en memoria + refresh rotatorio y revocable en cookie `httpOnly; SameSite=Strict`; bloqueo tras 5 fallos; throttling; mensajes que no revelan qué emails existen; `DEBUG` apagado por defecto. |

### Roles y permisos

| | Invitado | Usuario | Admin | Superadmin |
|---|:-:|:-:|:-:|:-:|
| Demo pública | ✅ | ✅ | ✅ | ✅ |
| Mi perfil: registrar/verificar mi rostro, borrar mis datos | — | ✅ | ✅ | ✅ |
| Dashboard / empleados / accesos (lectura) | ✅ *solo datos demo* | — | ✅ | ✅ |
| Alta, edición, aprobación y borrado de empleados; registrar rostros ajenos | — | — | ✅ | ✅ |
| Kiosco (reconocimiento 1:N + registro) | — | — | ✅ | ✅ |
| Exportar CSV | ✅ *demo* | — | ✅ | ✅ |
| Gestión de cuentas y auditoría | — | — | — | ✅ |

Las cuentas creadas por registro público nacen como **usuario** y con la ficha **pendiente de aprobación**: pueden verificar su identidad, pero el kiosco las deniega hasta que un administrador las apruebe. El rol se comprueba en el servidor en cada petición; el invitado nunca ve datos reales (filtrado por `is_demo`).

## Recorrido rápido (2 minutos)

1. **Demo pública** (`/demo`): sin registro, con tu webcam. Prueba a taparte media cara o a meter a otra persona en el encuadre: debe salir *Desconocido*.
2. **Panel como invitado** (`/login` → «Explorar el panel como invitado»): dashboard, empleados y accesos con datos ficticios, en solo lectura. Intenta crear un empleado: el servidor responde `403`.
3. **Cuenta propia** (`/register`): crea tu usuario, registra tu rostro en «Mi perfil» y usa la verificación 1:1. Tu cuenta queda *pendiente de aprobación* (el acceso saldrá denegado hasta que un admin la apruebe) y puedes borrar todo con un clic.
4. **Seguridad**: inspecciona las cookies (el refresh es `httpOnly`, no hay tokens en `localStorage`), reutiliza un refresh ya rotado (`401`) o intenta entrar a `/employees` con un usuario normal (`403`).

## Cómo reconoce caras

```
 frame JPEG ──► YuNet (detección + 5 landmarks) ──► alineado ──► SFace ──► embedding 128-d
                                                                              │
                          similitud coseno contra las plantillas  ◄───────────┘
                          ≥ umbral (0.40)  →  empleado identificado → reglas de acceso → registro
```

- **Sin entrenamiento.** Cada rostro se convierte en un vector; registrar a alguien nuevo **no afecta a los demás** (la v1 reentrenaba un único modelo EigenFace y solo reconocía a la última persona registrada).
- **Solo vectores, nunca imágenes.** Se conservan hasta 12 plantillas diversas por empleado (muestreo *farthest-point* para cubrir poses y luces distintas). Borrar al empleado o su rostro elimina las plantillas (`ON DELETE CASCADE`).
- **CPU únicamente.** Los modelos ONNX de [OpenCV Zoo](https://github.com/opencv/opencv_zoo) (YuNet 0.2 MB, SFace 37 MB) se ejecutan con `cv2.FaceDetectorYN` / `cv2.FaceRecognizerSF`. Se descargan y verifican por SHA-256 durante el build (`backend/download_models.py`).

## Stack

Django 6 · Django REST Framework · PostgreSQL 16 · OpenCV 4.13 (headless) · React 19 · Vite 7 · Tailwind CSS 4 · React Router 7 · Docker multi-stage · GitHub Actions (runner self-hosted) · nginx + Let's Encrypt.

Frontend: parallax por scroll y por ratón, tarjetas con foco que sigue al cursor, transiciones de vista entre rutas (View Transitions API), barra de progreso con `animation-timeline: scroll()`, revelado progresivo, *count-up*, marquesina, gráficos SVG propios (sin librerías) y respeto a `prefers-reduced-motion`.

## Arquitectura

```
Navegador ──HTTPS──► nginx (facialy.deveps.dev) ──► Gunicorn + Django :8000 ──► PostgreSQL
                                              │  ├─ /api/*   DRF (token auth)
                                              │  ├─ /static  WhiteNoise (build de React)
                                              │  └─ OpenCV: YuNet + SFace (en proceso)
                                              └─ sesiones de captura: RAM, TTL 10 min
```

> Gunicorn corre con **1 worker y 4 hilos** a propósito: las sesiones de captura viven en la memoria del proceso. Para escalar a varios workers habría que moverlas a Redis.

```
backend/core/
├── faces.py        # motor: decodificación, detección, embeddings, similitud
├── access.py       # índice de plantillas, reglas de horario, registro con cooldown
├── sessions.py     # sesiones de captura efímeras (demo y registro de empleados)
├── views.py        # auth, demo, empleados, kiosco, logs, dashboard
├── views_auth.py   # JWT: login, registro, refresh rotatorio, logout, invitado
├── views_me.py     # «Mi perfil»: rostro propio, verificación 1:1, borrado de cuenta
├── views_admin.py  # cuentas y auditoría (superadmin)
├── roles.py · permissions.py · audit.py
└── tests.py        # 93 tests (modelos, reglas, JWT, roles, scoping del invitado, API, flujos completos con modelos reales)
frontend/src/
├── pages/          # Home, Demo, Login, Dashboard, Employees, AccessLogs, Kiosk
├── components/     # ui, FaceCamera, FaceMesh, Navbar, Footer
├── hooks/          # useCamera, useCapture, useEffects (parallax, reveal, count-up, loop)
└── lib/auth.jsx    # contexto de autenticación
```

## Inicio rápido

### En local con Docker (+ Apache de XAMPP como proxy)

```powershell
.\scripts\local-up.ps1               # PostgreSQL + Django en Docker y Apache (XAMPP) en :8080
.\scripts\add-admin.ps1 -Email tu@correo.com -Name "Tu Nombre"   # tu cuenta de superadmin (pide la contraseña sin eco)
# -> http://localhost:8080/facialy/
.\scripts\local-up.ps1 -Down         # parar (añade -Purge para borrar la BD local)
```

`local-up.ps1` genera `.env.local` con secretos aleatorios, levanta `docker compose` y arranca `httpd.exe` de XAMPP directamente (sin abrir el panel) con `deploy/apache.local.conf.template`, que replica el `ProxyPass /facialy/` de producción. En Linux/macOS: `docker compose up -d --build` y `scripts/add-admin.sh tu@correo.com`.

### Con Docker (producción / genérico)

```bash
git clone https://github.com/devepsdev/facialy.git && cd facialy
cp .env.example .env          # edita SECRET_KEY, DB_PASSWORD y ADMIN_PASSWORD
docker compose up -d --build  # aplica migraciones y crea el admin al arrancar
```

Disponible en `http://localhost:8000/`. La app puede vivir en la raíz de un dominio (`BASE_PATH=` y `FORCE_SCRIPT_NAME=` vacíos, como en producción) o bajo un prefijo como `/facialy` (valor por defecto, el que usa el entorno local con XAMPP).

### Desarrollo local

```bash
# Backend (SQLite si no defines DB_NAME)
cd backend
python -m venv venv && source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
python download_models.py
export DEBUG=1 FORCE_SCRIPT_NAME= GUEST_LOGIN_ENABLED=true ADMIN_PASSWORD=cambiame123
python manage.py migrate && python manage.py ensure_admin && python manage.py seed_demo
python manage.py runserver

# Frontend (otra terminal) → http://localhost:5173/facialy/  (proxy de /facialy/api → :8000)
cd frontend && npm install && npm run dev
```

La cámara requiere un contexto seguro: `localhost` o HTTPS.

### Tests

```bash
cd backend && python manage.py test     # 93 tests; los de reconocimiento necesitan los modelos ONNX
cd frontend && npm run lint && npm run build
```

## Configuración

Todas son variables de entorno (ver [.env.example](.env.example)):

| Variable | Por defecto | Descripción |
|----------|-------------|-------------|
| `SECRET_KEY` | — (obligatoria) | Clave secreta de Django |
| `DB_NAME` `DB_USER` `DB_PASSWORD` `DB_HOST` | — | PostgreSQL; sin `DB_NAME` se usa SQLite |
| `DEBUG` | `false` | Nunca activar en producción |
| `ALLOWED_HOSTS` / `CSRF_TRUSTED_ORIGINS` | `localhost,127.0.0.1,deveps.ddns.net,facialy.deveps.dev` | Hosts y orígenes permitidos |
| `BASE_PATH` / `FORCE_SCRIPT_NAME` | `/facialy` | Prefijo de la app (build del frontend / Django). Vacíos para servirla en la raíz de un dominio |
| `ADMIN_USER` / `ADMIN_PASSWORD` | `admin` / — | Si hay contraseña, se crea/actualiza un superadmin al arrancar |
| `GUEST_LOGIN_ENABLED` | `false` | Habilita el acceso de invitado (solo lectura, solo datos demo) |
| `REGISTRATION_ENABLED` | `true` | Registro público de usuarios |
| `JWT_ACCESS_MINUTES` / `JWT_REFRESH_DAYS` | `15` / `7` | Vida de los tokens |
| `SECURE_COOKIES` | `true` (si no `DEBUG`) | Cookie del refresh con `Secure`; `false` solo en `http://localhost` |
| `LOGIN_MAX_FAILURES` | `5` | Fallos antes del bloqueo temporal (15 min) de la cuenta |
| `SEED_DEMO` | `false` | Genera empleados y accesos ficticios si la BD está vacía |
| `FACE_MATCH_THRESHOLD` | `0.40` | Similitud coseno mínima. Súbela para reducir falsos positivos |
| `ACCESS_SCHEDULE_GRACE_MINUTES` | `30` | Margen alrededor del horario |
| `ACCESS_LOG_COOLDOWN_SECONDS` | `30` | Evita registrar el mismo evento en bucle |

## API

Base: `/api/` · Cabecera `Authorization: Bearer <access>` salvo en los endpoints públicos.

| Método | Endpoint | Acceso | Descripción |
|--------|----------|--------|-------------|
| `POST` | `auth/login/` · `auth/register/` · `auth/guest/` | público (throttled) | Devuelven `{access, user}` y fijan la cookie `facialy_refresh` (httpOnly) |
| `POST` | `auth/refresh/` · `auth/logout/` | cookie | Rota el refresh (el anterior queda en lista negra) / lo revoca |
| `GET` | `auth/me/` | autenticado | Usuario actual y rol |
| `GET` | `health/` · `config/` | público | Estado (BD + modelos) / configuración pública |
| `POST` | `demo/start/` `demo/capture/` `demo/recognize/` `demo/end/` | público (throttled) | Demo efímera en memoria |
| `GET/POST/PATCH/DELETE` | `employees/` | lectura: invitado*/admin · escritura: admin | CRUD con búsqueda, filtros y paginación |
| `POST` | `employees/{id}/enroll/start\|capture\|finish/` | admin | Registro del rostro |
| `DELETE` | `employees/{id}/face/` | admin | Borra solo los datos biométricos |
| `POST` | `kiosk/recognize/` | admin | Reconoce, aplica reglas y registra |
| `GET` | `access-logs/` · `access-logs/export/` | invitado*/admin | Historial filtrable / CSV |
| `GET` | `dashboard/` | invitado*/admin | Métricas agregadas |
| `GET/DELETE` | `me/profile/` | usuario | Mi ficha, historial · eliminar mi cuenta y mis datos |
| `POST` | `me/enroll/start\|capture\|finish/` · `DELETE me/face/` | usuario | Registrar / borrar mi rostro |
| `POST` | `me/verify/` | usuario | Verificación 1:1 contra mi propia huella |
| `GET/PATCH/DELETE` | `users/` | superadmin | Cuentas: rol, activar/desactivar, borrar |
| `GET` | `audit/` | superadmin | Auditoría de seguridad |

\* El invitado solo ve datos marcados `is_demo`.

```jsonc
// POST /api/kiosk/recognize/  { "frame": "data:image/jpeg;base64,..." }
{ "results": [{
    "name": "Lucía Fernández", "employee_id": 3, "department": "Ingeniería",
    "result": "GRANTED",          // GRANTED | DENIED | UNKNOWN
    "reason": "",                 // INACTIVE | OUTSIDE_SCHEDULE cuando se deniega
    "similarity": 0.871, "box": [0.31, 0.18, 0.27, 0.41], "logged": true
}]}
```

## CI/CD

[`deploy.yml`](.github/workflows/deploy.yml): en cada push/PR se ejecutan los **tests del backend** y el **lint + build del frontend** en GitHub. Al hacer push a `main` y pasar los tests, el runner self-hosted del VPS (etiqueta `vps`) sincroniza el código en `/opt/apps/facialy`, construye la imagen, levanta los contenedores y **espera al healthcheck** antes de dar el despliegue por bueno.

La configuración de producción (secretos de Django y PostgreSQL, `BASE_PATH=` vacío, hosts) vive solo en el servidor, en `/opt/apps/facialy/.env`, y el workflow nunca la sobrescribe. Para crear o cambiar tu superadmin: `.\scripts\add-admin.ps1 -Email tu@correo.com -Remote vps`. El invitado, los datos de ejemplo y el registro público están activados; es seguro aunque haya datos reales: el invitado solo ve filas `is_demo` y el seed nunca toca datos reales.

## Privacidad y límites (léelo antes de usarlo "en serio")

- Los datos biométricos son **categoría especial** en el RGPD (art. 9): para un uso real necesitas base legal, información a los empleados y, normalmente, una evaluación de impacto. El flujo incluye consentimiento explícito y supresión individual, pero eso no sustituye al asesoramiento legal.
- **No hay detección de vivacidad (anti-spoofing):** una foto o un vídeo pueden engañar al sistema. Es una limitación conocida de este enfoque; en un despliegue crítico añadiría un modelo de *liveness* o una cámara de profundidad/IR.
- El umbral por defecto (0.40) es el recomendado por OpenCV para SFace; conviene calibrarlo con tu cámara e iluminación.
- Las sesiones de captura están en memoria de un solo proceso (ver arquitectura).

## Licencia y contacto

Proyecto de portfolio — uso libre para referencia y aprendizaje. Desarrollado por **DevEps** · [github.com/devepsdev](https://github.com/devepsdev) · [LinkedIn](https://www.linkedin.com/in/enrique-perez-sanchez/) · devepsdev@gmail.com
