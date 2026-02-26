from rest_framework import serializers
from .models import Employee, AccessLog


class EmployeeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Employee
        fields = '__all__'
        extra_kwargs = {
            'last_name': {'required': False, 'allow_blank': True},
            'email': {'required': False, 'allow_null': True, 'allow_blank': True},
            'department': {'required': False, 'allow_blank': True},
            'schedule_entry': {'required': False, 'allow_null': True},
            'schedule_exit': {'required': False, 'allow_null': True},
        }


class AccessLogSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()

    class Meta:
        model = AccessLog
        fields = '__all__'

    def get_employee_name(self, obj):
        if obj.employee:
            return f"{obj.employee.first_name} {obj.employee.last_name}"
        return "Desconocido"