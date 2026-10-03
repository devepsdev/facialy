"""
Django settings for Facialy.

Toda la configuración sensible o dependiente del entorno se lee de variables
de entorno (ver .env.example). Los valores por defecto son seguros para
producción: DEBUG desactivado y hosts restringidos.
"""

import os
import sys
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent


def env_bool(name, default=False):
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in ('1', 'true', 'yes', 'on')


def env_list(name, default=''):
    return [item.strip() for item in os.environ.get(name, default).split(',') if item.strip()]


DEBUG = env_bool('DEBUG', False)
TESTING = 'test' in sys.argv

SECRET_KEY = os.environ.get('SECRET_KEY')
if not SECRET_KEY:
    if DEBUG or TESTING:
        SECRET_KEY = 'django-insecure-dev-only-key'
    else:
        raise ImproperlyConfigured('La variable de entorno SECRET_KEY es obligatoria.')

ALLOWED_HOSTS = env_list('ALLOWED_HOSTS', 'localhost,127.0.0.1,deveps.ddns.net')
CSRF_TRUSTED_ORIGINS = env_list('CSRF_TRUSTED_ORIGINS', 'https://deveps.ddns.net')


# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework_simplejwt.token_blacklist',
    'core',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [os.path.join(BASE_DIR, 'frontend_dist')],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'


# Database: PostgreSQL cuando hay DB_NAME; SQLite como fallback para desarrollo y tests.

if os.environ.get('DB_NAME'):
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.environ['DB_NAME'],
            'USER': os.environ.get('DB_USER'),
            'PASSWORD': os.environ.get('DB_PASSWORD'),
            'HOST': os.environ.get('DB_HOST', 'localhost'),
            'PORT': os.environ.get('DB_PORT', '5432'),
            'CONN_MAX_AGE': 60,
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'


AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]


# Internationalization

LANGUAGE_CODE = 'es'
TIME_ZONE = os.environ.get('TIME_ZONE', 'Europe/Madrid')
USE_I18N = True
USE_TZ = True


# Static files: el build de React (frontend_dist) se sirve con WhiteNoise.

STATIC_URL = 'static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
STATICFILES_DIRS = [os.path.join(BASE_DIR, 'frontend_dist')]
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedStaticFilesStorage'},
}

# La app cuelga de /facialy/ detrás del proxy Apache
FORCE_SCRIPT_NAME = os.environ.get('FORCE_SCRIPT_NAME', '/facialy') or None
USE_X_FORWARDED_HOST = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

if not DEBUG:
    SESSION_COOKIE_SECURE = env_bool('SECURE_COOKIES', True)
    CSRF_COOKIE_SECURE = env_bool('SECURE_COOKIES', True)
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_REFERRER_POLICY = 'same-origin'
    X_FRAME_OPTIONS = 'DENY'


# Django REST Framework

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'core.permissions.AdminWritesViewerReads',
    ],
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    'DEFAULT_PAGINATION_CLASS': 'core.pagination.StandardPagination',
    'EXCEPTION_HANDLER': 'core.exceptions.api_exception_handler',
    'DEFAULT_THROTTLE_RATES': {
        'demo': '1200/min',
        'login': '10/min',
        'register': '5/hour',
        'refresh': '60/min',
    },
    'NUM_PROXIES': int(os.environ.get('NUM_PROXIES', '1')),
}


# JWT: access token corto (en memoria del navegador) + refresh rotatorio en cookie httpOnly

from datetime import timedelta  # noqa: E402

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=int(os.environ.get('JWT_ACCESS_MINUTES', '15'))),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=int(os.environ.get('JWT_REFRESH_DAYS', '7'))),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
}
JWT_REFRESH_COOKIE = 'facialy_refresh'
# Ruta que ve el navegador (incluye el prefijo del proxy): el refresh solo viaja a /auth/
JWT_COOKIE_PATH = os.environ.get('JWT_COOKIE_PATH', '/facialy/api/auth/')
JWT_COOKIE_SECURE = env_bool('SECURE_COOKIES', not DEBUG)
# Bloqueo temporal de la cuenta tras demasiados intentos fallidos
LOGIN_MAX_FAILURES = int(os.environ.get('LOGIN_MAX_FAILURES', '5'))
LOGIN_LOCKOUT_SECONDS = int(os.environ.get('LOGIN_LOCKOUT_SECONDS', '900'))
# Permite el registro público de usuarios (cuentas pendientes de aprobación)
REGISTRATION_ENABLED = env_bool('REGISTRATION_ENABLED', True)


# Facialy: reconocimiento y control de acceso

FACE_MODELS_DIR = os.environ.get('FACE_MODELS_DIR', str(BASE_DIR / 'models'))
# Similitud coseno mínima (0-1) entre embeddings SFace para considerar que es la misma persona.
FACE_MATCH_THRESHOLD = float(os.environ.get('FACE_MATCH_THRESHOLD', '0.40'))
# Puntuación mínima del detector YuNet
FACE_DETECT_SCORE = float(os.environ.get('FACE_DETECT_SCORE', '0.85'))
# Capturas necesarias para completar un registro (demo y empleados)
FACE_CAPTURE_TARGET = int(os.environ.get('FACE_CAPTURE_TARGET', '30'))
# Plantillas (embeddings) que se conservan por empleado
FACE_TEMPLATES_PER_EMPLOYEE = int(os.environ.get('FACE_TEMPLATES_PER_EMPLOYEE', '12'))
# Margen (min) alrededor del horario del empleado en el que se concede acceso
ACCESS_SCHEDULE_GRACE_MINUTES = int(os.environ.get('ACCESS_SCHEDULE_GRACE_MINUTES', '30'))
# Segundos antes de volver a registrar el mismo evento (misma persona / mismo resultado)
ACCESS_LOG_COOLDOWN_SECONDS = int(os.environ.get('ACCESS_LOG_COOLDOWN_SECONDS', '30'))
# Permite entrar como invitado (solo lectura) sin credenciales: pensado para el demo público
GUEST_LOGIN_ENABLED = env_bool('GUEST_LOGIN_ENABLED', False)
# Sesiones de captura en memoria (demo / registro)
CAPTURE_SESSION_TTL_SECONDS = int(os.environ.get('CAPTURE_SESSION_TTL_SECONDS', '600'))
CAPTURE_SESSION_MAX = int(os.environ.get('CAPTURE_SESSION_MAX', '25'))
