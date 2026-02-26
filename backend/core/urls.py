from rest_framework.routers import DefaultRouter
from django.urls import path

from .views import (
    EmployeeViewSet,
    AccessLogViewSet,
    capture_employee_faces,
    capture_frame,
    train,
    recognize,
    cleanup,
    dashboard,
)

router = DefaultRouter()
router.register('employees', EmployeeViewSet)
router.register('access-logs', AccessLogViewSet)

urlpatterns = [
    path('capture/<int:employee_id>/', capture_employee_faces, name='capture'),
    path('capture-frame/', capture_frame, name='capture_frame'),
    path('train/', train, name='train'),
    path('recognize/', recognize, name='recognize'),
    path('cleanup/', cleanup, name='cleanup'),
    path('dashboard/', dashboard, name='dashboard'),
] + router.urls
