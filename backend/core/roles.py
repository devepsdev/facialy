"""Roles de la plataforma y utilidades de autorización.

  viewer     Invitado: solo lectura y únicamente sobre los datos de demostración.
  user       Usuario registrado: gestiona su propio rostro y verifica su identidad.
  admin      Administrador: empleados, kiosco, accesos y dashboard.
  superadmin Todo lo anterior + gestión de cuentas/roles y auditoría.
"""

from .models import Profile

VIEWER, USER, ADMIN, SUPERADMIN = Profile.VIEWER, Profile.USER, Profile.ADMIN, Profile.SUPERADMIN


def get_role(user):
    if not (user and user.is_authenticated):
        return None
    try:
        return user.profile.role
    except Profile.DoesNotExist:
        # Cuentas anteriores a los roles: se derivan de los flags de Django
        return SUPERADMIN if user.is_superuser else ADMIN if user.is_staff else USER


def is_admin(user):
    return get_role(user) in (ADMIN, SUPERADMIN)


def is_superadmin(user):
    return get_role(user) == SUPERADMIN


def user_payload(user):
    employee = getattr(user, 'employee', None)
    return {
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'name': (employee.full_name if employee else user.get_full_name()) or user.username,
        'role': get_role(user),
        'has_employee': employee is not None,
    }
