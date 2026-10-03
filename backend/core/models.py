import numpy as np
from django.conf import settings
from django.db import models


class Employee(models.Model):
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100, blank=True, default='')
    email = models.EmailField(unique=True, blank=True, null=True)
    department = models.CharField(max_length=100, blank=True, default='')
    schedule_entry = models.TimeField(null=True, blank=True)
    schedule_exit = models.TimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    face_enrolled_at = models.DateTimeField(null=True, blank=True)
    # Cuenta de usuario propia (registro público). Nula para empleados dados de alta por un admin.
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.CASCADE, related_name='employee',
    )
    # Datos ficticios del demo público: son los únicos que ve el rol invitado
    is_demo = models.BooleanField(default=False, db_index=True)

    class Meta:
        ordering = ['first_name', 'last_name']

    @property
    def full_name(self):
        return f'{self.first_name} {self.last_name}'.strip()

    def __str__(self):
        return self.full_name


class FaceTemplate(models.Model):
    """Embedding facial (128 floats SFace) de un empleado.

    Solo se almacena el vector biométrico, nunca la imagen original.
    """

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='templates')
    embedding = models.BinaryField()
    created_at = models.DateTimeField(auto_now_add=True)

    def set_vector(self, vector):
        self.embedding = np.asarray(vector, dtype=np.float32).tobytes()

    def get_vector(self):
        return np.frombuffer(bytes(self.embedding), dtype=np.float32)

    def __str__(self):
        return f'Template #{self.pk} · {self.employee}'


class AccessLog(models.Model):
    RESULT_CHOICES = [
        ('GRANTED', 'Granted'),
        ('DENIED', 'Denied'),
        ('UNKNOWN', 'Unknown'),
    ]
    REASON_CHOICES = [
        ('', 'Ninguno'),
        ('INACTIVE', 'Empleado inactivo'),
        ('OUTSIDE_SCHEDULE', 'Fuera de horario'),
    ]

    employee = models.ForeignKey(Employee, on_delete=models.SET_NULL, null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    result = models.CharField(max_length=10, choices=RESULT_CHOICES)
    reason = models.CharField(max_length=20, choices=REASON_CHOICES, blank=True, default='')
    # Similitud coseno (0-1) del mejor candidato; mayor = más parecido
    confidence = models.FloatField(default=0.0)
    is_demo = models.BooleanField(default=False, db_index=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f'{self.timestamp} - {self.result}'



class Profile(models.Model):
    """Rol de una cuenta. Las banderas is_staff / is_superuser de Django se derivan de él."""

    VIEWER, USER, ADMIN, SUPERADMIN = 'viewer', 'user', 'admin', 'superadmin'
    ROLE_CHOICES = [
        (VIEWER, 'Invitado (solo lectura, datos demo)'),
        (USER, 'Usuario'),
        (ADMIN, 'Administrador'),
        (SUPERADMIN, 'Superadministrador'),
    ]

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=12, choices=ROLE_CHOICES, default=USER)

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Mantiene coherentes los flags de Django (admin site, createsuperuser, etc.)
        flags = {'is_staff': self.role in (self.ADMIN, self.SUPERADMIN), 'is_superuser': self.role == self.SUPERADMIN}
        type(self.user).objects.filter(pk=self.user_id).update(**flags)

    def __str__(self):
        return f'{self.user} · {self.role}'


class AuditLog(models.Model):
    """Registro de eventos de seguridad (accesos al panel, cambios de rol, borrados...)."""

    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    actor_label = models.CharField(max_length=150, blank=True, default='')
    action = models.CharField(max_length=40, db_index=True)
    target = models.CharField(max_length=200, blank=True, default='')
    ip = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.created_at:%Y-%m-%d %H:%M} {self.action} {self.actor_label}'
