"""Autenticación JWT: access token corto en la respuesta + refresh rotatorio en cookie httpOnly."""

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.models import update_last_login
from django.contrib.auth.password_validation import validate_password
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from . import roles
from .audit import audit
from .models import Employee, Profile
from .permissions import IsAuthenticatedWithRole

User = get_user_model()
GENERIC_REGISTER_ERROR = 'No se pudo completar el registro con esos datos.'


class LoginThrottle(AnonRateThrottle):
    scope = 'login'


class RegisterThrottle(AnonRateThrottle):
    scope = 'register'


class RefreshThrottle(AnonRateThrottle):
    scope = 'refresh'


# ── Utilidades ────────────────────────────────────────────────────────────────

def _issue(user, http_status=status.HTTP_200_OK):
    """Crea el par de tokens: access en el cuerpo, refresh en cookie httpOnly."""
    refresh = RefreshToken.for_user(user)
    refresh['role'] = roles.get_role(user)
    response = Response({'access': str(refresh.access_token), 'user': roles.user_payload(user)}, status=http_status)
    _set_refresh_cookie(response, str(refresh))
    return response


def _set_refresh_cookie(response, value):
    response.set_cookie(
        settings.JWT_REFRESH_COOKIE, value,
        max_age=int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds()),
        httponly=True, secure=settings.JWT_COOKIE_SECURE, samesite='Strict', path=settings.JWT_COOKIE_PATH,
    )


def _clear_refresh_cookie(response):
    response.delete_cookie(settings.JWT_REFRESH_COOKIE, path=settings.JWT_COOKIE_PATH, samesite='Strict')


def _lock_key(identifier):
    return f'login-fail:{identifier.lower()}'


def _find_user(identifier):
    user = User.objects.filter(username__iexact=identifier).first()
    return user or User.objects.filter(email__iexact=identifier).first()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([LoginThrottle])
def login(request):
    identifier = str(request.data.get('username') or request.data.get('email') or '').strip()[:150]
    password = str(request.data.get('password', ''))
    if not identifier or not password:
        return Response({'error': 'Introduce usuario y contraseña.'}, status=status.HTTP_400_BAD_REQUEST)

    failures = cache.get(_lock_key(identifier), 0)
    if failures >= settings.LOGIN_MAX_FAILURES:
        audit(request, 'login_locked', identifier, label=identifier)
        return Response(
            {'error': 'Demasiados intentos fallidos. Espera unos minutos antes de volver a intentarlo.', 'code': 'locked'},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    candidate = _find_user(identifier)
    user = authenticate(request, username=candidate.username if candidate else identifier, password=password)
    if user is None or not user.is_active or roles.get_role(user) == roles.VIEWER:
        cache.set(_lock_key(identifier), failures + 1, settings.LOGIN_LOCKOUT_SECONDS)
        audit(request, 'login_failed', identifier, label=identifier)
        return Response({'error': 'Credenciales incorrectas.'}, status=status.HTTP_400_BAD_REQUEST)

    cache.delete(_lock_key(identifier))
    update_last_login(None, user)
    audit(request, 'login_ok', actor=user)
    return _issue(user)


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([RegisterThrottle])
def register(request):
    """Registro público: crea una cuenta de rol `user` y su ficha de empleado (pendiente de aprobación)."""
    if not settings.REGISTRATION_ENABLED:
        return Response({'error': 'El registro está desactivado.'}, status=status.HTTP_403_FORBIDDEN)

    data = request.data
    email = str(data.get('email', '')).strip().lower()
    password = str(data.get('password', ''))
    first_name = str(data.get('first_name', '')).strip()[:100]
    last_name = str(data.get('last_name', '')).strip()[:100]

    errors = {}
    try:
        validate_email(email)
    except ValidationError:
        errors['email'] = 'Introduce un email válido.'
    if not first_name:
        errors['first_name'] = 'El nombre es obligatorio.'
    if data.get('accept_terms') is not True:
        errors['accept_terms'] = 'Debes aceptar el tratamiento de tus datos.'
    if not errors:
        try:
            validate_password(password, User(username=email, email=email, first_name=first_name))
        except ValidationError as exc:
            errors['password'] = ' '.join(exc.messages)
    if errors:
        return Response(errors, status=status.HTTP_400_BAD_REQUEST)

    # Mensaje genérico ante duplicados: no se revela qué emails existen
    if User.objects.filter(username__iexact=email).exists() or Employee.objects.filter(email__iexact=email).exists():
        return Response({'error': GENERIC_REGISTER_ERROR}, status=status.HTTP_400_BAD_REQUEST)

    try:
        with transaction.atomic():
            user = User.objects.create_user(username=email, email=email, password=password, first_name=first_name, last_name=last_name)
            Employee.objects.create(
                first_name=first_name, last_name=last_name, email=email, user=user,
                department='Cuenta propia', is_active=False,
            )
    except IntegrityError:
        return Response({'error': GENERIC_REGISTER_ERROR}, status=status.HTTP_400_BAD_REQUEST)

    audit(request, 'register', email, actor=user)
    return _issue(user, status.HTTP_201_CREATED)


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([RefreshThrottle])
def refresh(request):
    """Rota el refresh token (cookie) y devuelve un nuevo access token."""
    raw = request.COOKIES.get(settings.JWT_REFRESH_COOKIE)
    fail = Response({'error': 'Sesión no válida.'}, status=status.HTTP_401_UNAUTHORIZED)
    if not raw:
        return fail
    try:
        old = RefreshToken(raw)
        user = User.objects.get(pk=old['user_id'])
        if not user.is_active:
            raise TokenError('inactive')
        old.blacklist()
    except (TokenError, User.DoesNotExist, KeyError):
        _clear_refresh_cookie(fail)
        return fail
    return _issue(user)


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def logout(request):
    """Revoca el refresh token (lista negra) y borra la cookie."""
    raw = request.COOKIES.get(settings.JWT_REFRESH_COOKIE)
    if raw:
        try:
            RefreshToken(raw).blacklist()
        except TokenError:
            pass
    response = Response(status=status.HTTP_204_NO_CONTENT)
    _clear_refresh_cookie(response)
    return response


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([LoginThrottle])
def guest_login(request):
    """Sesión de invitado: solo lectura y únicamente sobre los datos de demostración."""
    if not settings.GUEST_LOGIN_ENABLED:
        return Response({'error': 'El acceso como invitado está desactivado.'}, status=status.HTTP_403_FORBIDDEN)
    user, created = User.objects.get_or_create(username='invitado', defaults={'first_name': 'Invitado'})
    if created:
        user.set_unusable_password()
        user.save(update_fields=['password'])
    profile, _ = Profile.objects.get_or_create(user=user)
    if profile.role != Profile.VIEWER:
        profile.role = Profile.VIEWER
        profile.save()
    user.profile = profile  # evita usar la instancia en caché creada por la señal (rol antiguo)
    return _issue(user)


@api_view(['GET'])
@permission_classes([IsAuthenticatedWithRole])
def me(request):
    return Response(roles.user_payload(request.user))
