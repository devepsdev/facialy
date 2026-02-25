from rest_framework import viewsets, status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import Employee, AccessLog
from .serializers import EmployeeSerializer, AccessLogSerializer
from .services import capture_faces, train_model, recognize_from_frame


class EmployeeViewSet(viewsets.ModelViewSet):
    queryset = Employee.objects.all()
    serializer_class = EmployeeSerializer


class AccessLogViewSet(viewsets.ModelViewSet):
    queryset = AccessLog.objects.all().order_by('-timestamp')
    serializer_class = AccessLogSerializer


@api_view(['POST'])
def capture_employee_faces(request, employee_id):
    try:
        employee = Employee.objects.get(id=employee_id)
    except Employee.DoesNotExist:
        return Response({'error': 'Empleado no encontrado'}, status=status.HTTP_404_NOT_FOUND)

    count = capture_faces(f"{employee.id}_{employee.first_name}_{employee.last_name}")
    return Response({'message': f'{count} imágenes capturadas para {employee.first_name}'})


@api_view(['POST'])
def train(request):
    success = train_model()
    if success:
        return Response({'message': 'Modelo entrenado correctamente'})
    return Response({'error': 'No hay imágenes para entrenar'}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
def dashboard(request):
    from django.utils import timezone
    from datetime import timedelta

    today = timezone.now().date()
    logs_today = AccessLog.objects.filter(timestamp__date=today)

    return Response({
        'total_employees': Employee.objects.filter(is_active=True).count(),
        'accesses_today': logs_today.count(),
        'granted_today': logs_today.filter(result='GRANTED').count(),
        'denied_today': logs_today.filter(result='DENIED').count(),
        'unknown_today': logs_today.filter(result='UNKNOWN').count(),
    })