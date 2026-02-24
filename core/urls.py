from rest_framework.routers import DefaultRouter
from .views import EmployeeViewSet, AccessLogViewSet

router = DefaultRouter()
router.register('employees', EmployeeViewSet)
router.register('access-logs', AccessLogViewSet)

urlpatterns = router.urls