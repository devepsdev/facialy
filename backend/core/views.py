import time

from rest_framework import viewsets, status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import Employee, AccessLog
from .serializers import EmployeeSerializer, AccessLogSerializer
from .services import (
    capture_faces,
    capture_face_from_base64,
    train_model,
    recognize_from_base64,
    cleanup_visitor,
)

# Throttle simple en memoria: evita crear logs duplicados en reconocimiento en vivo
_last_log_time: dict = {}


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
def capture_frame(request):
    """Recibe un frame en base64, detecta cara y guarda imagen. Devuelve progreso."""
    visitor_name = request.data.get('visitor_name', '').strip()
    frame_data = request.data.get('frame', '')

    if not visitor_name or not frame_data:
        return Response(
            {'error': 'visitor_name y frame son requeridos'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    result = capture_face_from_base64(visitor_name, frame_data)
    return Response(result)


@api_view(['POST'])
def train(request):
    """Entrena el modelo con las imágenes capturadas y borra las fotos del disco.
    Si se proporciona visitor_name, crea un registro de Employee en la BD."""
    visitor_name = request.data.get('visitor_name', '').strip()
    success = train_model()
    if success:
        employee_id = None
        if visitor_name:
            parts = visitor_name.split(' ', 1)
            first_name = parts[0]
            last_name = parts[1] if len(parts) > 1 else ''
            emp = Employee.objects.create(first_name=first_name, last_name=last_name)
            employee_id = emp.id
        return Response({
            'success': True,
            'message': 'Modelo entrenado correctamente',
            'employee_id': employee_id,
        })
    return Response(
        {'success': False, 'message': 'No hay suficientes imágenes para entrenar'},
        status=status.HTTP_400_BAD_REQUEST,
    )


@api_view(['POST'])
def recognize(request):
    """Recibe frame base64, ejecuta reconocimiento y devuelve resultados con bounding boxes."""
    frame_data = request.data.get('frame', '')
    visitor_name = request.data.get('visitor_name', 'Visitante')

    if not frame_data:
        return Response({'error': 'frame es requerido'}, status=status.HTTP_400_BAD_REQUEST)

    results = recognize_from_base64(frame_data)

    # Registrar en BD solo cada 30 s para no saturar los logs
    now = time.time()
    throttle_key = f'log_{visitor_name}'
    if now - _last_log_time.get(throttle_key, 0) > 30:
        for r in results:
            if r['name'] != 'Desconocido':
                AccessLog.objects.create(result='GRANTED', confidence=r['confidence'])
                _last_log_time[throttle_key] = now
                break

    return Response({'results': results})


@api_view(['POST'])
def cleanup(request):
    """Limpia datos del visitante demo: fotos, modelo XML y label map."""
    cleanup_visitor()
    return Response({'success': True, 'message': 'Datos eliminados correctamente'})


@api_view(['GET'])
def dashboard(request):
    from django.utils import timezone

    today = timezone.now().date()
    logs_today = AccessLog.objects.filter(timestamp__date=today)
    recent_logs = AccessLog.objects.order_by('-timestamp')[:10]
    recent_data = AccessLogSerializer(recent_logs, many=True).data

    return Response({
        'total_employees': Employee.objects.filter(is_active=True).count(),
        'accesses_today': logs_today.count(),
        'granted_today': logs_today.filter(result='GRANTED').count(),
        'denied_today': logs_today.filter(result='DENIED').count(),
        'unknown_today': logs_today.filter(result='UNKNOWN').count(),
        'recent_logs': recent_data,
    })
