from rest_framework import serializers

from .models import AccessLog, Employee


class EmployeeSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    has_face = serializers.SerializerMethodField()
    has_account = serializers.SerializerMethodField()
    pending = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = [
            'id', 'first_name', 'last_name', 'full_name', 'email', 'department',
            'schedule_entry', 'schedule_exit', 'is_active', 'created_at',
            'face_enrolled_at', 'has_face', 'is_demo', 'has_account', 'pending',
        ]
        read_only_fields = ['created_at', 'face_enrolled_at', 'is_demo']
        extra_kwargs = {
            'last_name': {'required': False, 'allow_blank': True},
            'email': {'required': False, 'allow_null': True, 'allow_blank': True},
            'department': {'required': False, 'allow_blank': True},
            'schedule_entry': {'required': False, 'allow_null': True},
            'schedule_exit': {'required': False, 'allow_null': True},
        }

    def get_has_face(self, obj):
        return obj.face_enrolled_at is not None

    def get_has_account(self, obj):
        return obj.user_id is not None

    def get_pending(self, obj):
        # Cuenta de registro público a la espera de que un administrador la active
        return obj.user_id is not None and not obj.is_active

    def validate_email(self, value):
        # Un email vacío se guarda como NULL: dos '' chocarían con la restricción unique
        return value or None

    def validate_first_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('El nombre es obligatorio.')
        return value

    def validate(self, attrs):
        entry = attrs.get('schedule_entry', getattr(self.instance, 'schedule_entry', None))
        exit_ = attrs.get('schedule_exit', getattr(self.instance, 'schedule_exit', None))
        if bool(entry) != bool(exit_):
            raise serializers.ValidationError('Indica hora de entrada y de salida, o ninguna de las dos.')
        return attrs


class AccessLogSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    department = serializers.SerializerMethodField()

    class Meta:
        model = AccessLog
        fields = ['id', 'employee', 'employee_name', 'department', 'timestamp', 'result', 'reason', 'confidence']

    def get_employee_name(self, obj):
        return obj.employee.full_name if obj.employee else 'Desconocido'

    def get_department(self, obj):
        return obj.employee.department if obj.employee else ''
