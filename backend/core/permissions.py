from rest_framework.permissions import SAFE_METHODS, BasePermission

from . import roles


class AdminWritesViewerReads(BasePermission):
    """Lectura: administradores e invitado (este último, solo datos demo; ver scoping en las vistas).
    Escritura: solo administradores. El rol `user` no accede a los datos de la empresa."""

    def has_permission(self, request, view):
        role = roles.get_role(request.user)
        if role in (roles.ADMIN, roles.SUPERADMIN):
            return True
        return role == roles.VIEWER and request.method in SAFE_METHODS


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return roles.is_admin(request.user)


class IsSuperAdmin(BasePermission):
    def has_permission(self, request, view):
        return roles.is_superadmin(request.user)


class IsAuthenticatedWithRole(BasePermission):
    def has_permission(self, request, view):
        return roles.get_role(request.user) is not None


class HasOwnProfile(BasePermission):
    """Cuentas con empleado propio (registro público): usan /api/me/*."""

    message = 'Tu cuenta no tiene perfil biométrico asociado.'

    def has_permission(self, request, view):
        role = roles.get_role(request.user)
        return role in (roles.USER, roles.ADMIN, roles.SUPERADMIN) and hasattr(request.user, 'employee')
