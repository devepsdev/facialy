"""Gestión de cuentas y auditoría (solo superadministradores)."""

from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework import serializers, status, viewsets
from rest_framework.response import Response

from . import roles
from .audit import audit
from .models import AuditLog, Profile
from .permissions import IsSuperAdmin

User = get_user_model()
ASSIGNABLE_ROLES = (Profile.USER, Profile.ADMIN, Profile.SUPERADMIN)


class UserSerializer(serializers.ModelSerializer):
    role = serializers.ChoiceField(choices=ASSIGNABLE_ROLES, required=False, write_only=True)
    name = serializers.SerializerMethodField()
    current_role = serializers.SerializerMethodField()
    has_face = serializers.SerializerMethodField()
    pending = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'name', 'role', 'current_role', 'is_active', 'last_login', 'date_joined', 'has_face', 'pending']
        read_only_fields = ['username', 'email', 'last_login', 'date_joined']

    def get_name(self, obj):
        return roles.user_payload(obj)['name']

    def get_current_role(self, obj):
        return roles.get_role(obj)

    def get_has_face(self, obj):
        employee = getattr(obj, 'employee', None)
        return bool(employee and employee.face_enrolled_at)

    def get_pending(self, obj):
        employee = getattr(obj, 'employee', None)
        return bool(employee and not employee.is_active)

    def to_representation(self, obj):
        data = super().to_representation(obj)
        data['role'] = data.pop('current_role')
        return data


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.select_related('profile', 'employee').order_by('-date_joined')
    serializer_class = UserSerializer
    permission_classes = [IsSuperAdmin]
    http_method_names = ['get', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        qs = super().get_queryset().exclude(profile__role=Profile.VIEWER)
        params = self.request.query_params
        search = params.get('search', '').strip()
        if search:
            qs = qs.filter(Q(username__icontains=search) | Q(email__icontains=search) | Q(first_name__icontains=search))
        if params.get('role') in ASSIGNABLE_ROLES:
            qs = qs.filter(profile__role=params['role'])
        return qs

    def partial_update(self, request, *args, **kwargs):
        user = self.get_object()
        if user.pk == request.user.pk:
            return Response({'error': 'No puedes modificar tu propia cuenta desde aquí.'}, status=status.HTTP_400_BAD_REQUEST)
        serializer = self.get_serializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        new_role = data.get('role')
        if new_role and new_role != roles.get_role(user):
            profile, _ = Profile.objects.get_or_create(user=user)
            audit(request, 'role_changed', f'{user.username}: {profile.role} -> {new_role}')
            profile.role = new_role
            profile.save()
        if 'is_active' in data and data['is_active'] != user.is_active:
            user.is_active = data['is_active']
            user.save(update_fields=['is_active'])
            audit(request, 'user_activated' if user.is_active else 'user_deactivated', user.username)
        return Response(self.get_serializer(User.objects.get(pk=user.pk)).data)

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        if user.pk == request.user.pk:
            return Response({'error': 'No puedes eliminar tu propia cuenta.'}, status=status.HTTP_400_BAD_REQUEST)
        audit(request, 'user_deleted', user.username)
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AuditSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = ['id', 'actor_label', 'action', 'target', 'ip', 'created_at']


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.all()
    serializer_class = AuditSerializer
    permission_classes = [IsSuperAdmin]

    def get_queryset(self):
        qs = super().get_queryset()
        action = self.request.query_params.get('action', '').strip()
        if action:
            qs = qs.filter(action=action)
        return qs
