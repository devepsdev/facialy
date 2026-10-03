from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views, views_admin, views_auth, views_me

router = DefaultRouter()
router.register('employees', views.EmployeeViewSet)
router.register('access-logs', views.AccessLogViewSet)
router.register('users', views_admin.UserViewSet)
router.register('audit', views_admin.AuditLogViewSet)

urlpatterns = [
    path('health/', views.health, name='health'),
    path('config/', views.public_config, name='config'),
    # Autenticación (JWT)
    path('auth/login/', views_auth.login, name='login'),
    path('auth/register/', views_auth.register, name='register'),
    path('auth/refresh/', views_auth.refresh, name='refresh'),
    path('auth/logout/', views_auth.logout, name='logout'),
    path('auth/guest/', views_auth.guest_login, name='guest_login'),
    path('auth/me/', views_auth.me, name='me'),
    # Mi perfil (usuario)
    path('me/profile/', views_me.profile, name='me_profile'),
    path('me/enroll/start/', views_me.enroll_start, name='me_enroll_start'),
    path('me/enroll/capture/', views_me.enroll_capture, name='me_enroll_capture'),
    path('me/enroll/finish/', views_me.enroll_finish, name='me_enroll_finish'),
    path('me/face/', views_me.delete_face, name='me_face'),
    path('me/verify/', views_me.verify, name='me_verify'),
    # Demo pública
    path('demo/start/', views.demo_start, name='demo_start'),
    path('demo/capture/', views.demo_capture, name='demo_capture'),
    path('demo/recognize/', views.demo_recognize, name='demo_recognize'),
    path('demo/end/', views.demo_end, name='demo_end'),
    # Administración
    path('kiosk/recognize/', views.kiosk_recognize, name='kiosk_recognize'),
    path('dashboard/', views.dashboard, name='dashboard'),
] + router.urls
