from rest_framework.routers import DefaultRouter
from django.urls import path
from .views import EmployeeViewSet, AccessLogViewSet, capture_employee_faces, train, dashboard

router = DefaultRouter()
router.register('employees', EmployeeViewSet)
router.register('access-logs', AccessLogViewSet)

urlpatterns = [
    path('capture/<int:employee_id>/', capture_employee_faces, name='capture'),
    path('train/', train, name='train'),
    path('dashboard/', dashboard, name='dashboard'),
] + router.urls