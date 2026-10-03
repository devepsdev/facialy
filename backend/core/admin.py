from django.contrib import admin

from .models import AccessLog, Employee, FaceTemplate


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ('full_name', 'email', 'department', 'is_active', 'face_enrolled_at')
    list_filter = ('is_active', 'department')
    search_fields = ('first_name', 'last_name', 'email')


@admin.register(AccessLog)
class AccessLogAdmin(admin.ModelAdmin):
    list_display = ('timestamp', 'employee', 'result', 'reason', 'confidence')
    list_filter = ('result', 'reason')
    date_hierarchy = 'timestamp'


@admin.register(FaceTemplate)
class FaceTemplateAdmin(admin.ModelAdmin):
    list_display = ('id', 'employee', 'created_at')
    exclude = ('embedding',)
