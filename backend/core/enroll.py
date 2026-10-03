"""Registro del rostro de un empleado (compartido por el panel de admin y por «Mi perfil»)."""

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response

from . import faces, sessions
from .audit import audit

EXPIRED = {'error': 'La sesión ha caducado.', 'code': 'session_expired'}
MIN_CAPTURES = 10


def start(employee):
    sid = sessions.create_session('enroll', employee.full_name, employee.id)
    return Response({'session_id': sid, 'total': settings.FACE_CAPTURE_TARGET})


def capture(request, employee):
    session = sessions.get_session(request.data.get('session_id'), kind='enroll', employee_id=employee.id)
    if session is None:
        return Response(EXPIRED, status=status.HTTP_404_NOT_FOUND)
    return Response(sessions.add_frame(session, request.data.get('frame')))


def finish(request, employee):
    """Guarda las plantillas (embeddings) elegidas y descarta la sesión. Devuelve el empleado actualizado."""
    from .serializers import EmployeeSerializer

    sid = request.data.get('session_id')
    session = sessions.get_session(sid, kind='enroll', employee_id=employee.id)
    if session is None:
        return Response(EXPIRED, status=status.HTTP_404_NOT_FOUND)
    if session.count < MIN_CAPTURES:
        return Response(
            {'error': 'No hay suficientes capturas válidas para registrar el rostro.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    from .models import FaceTemplate

    vectors = faces.select_diverse(session.embeddings, settings.FACE_TEMPLATES_PER_EMPLOYEE)
    with transaction.atomic():
        employee.templates.all().delete()
        for vector in vectors:
            template = FaceTemplate(employee=employee)
            template.set_vector(vector)
            template.save()
        employee.face_enrolled_at = timezone.now()
        employee.save(update_fields=['face_enrolled_at'])
    sessions.drop_session(sid)
    audit(request, 'face_enrolled', employee.full_name)
    return Response(EmployeeSerializer(employee).data)


def remove(request, employee):
    from .serializers import EmployeeSerializer

    employee.templates.all().delete()
    employee.face_enrolled_at = None
    employee.save(update_fields=['face_enrolled_at'])
    audit(request, 'face_deleted', employee.full_name)
    return Response(EmployeeSerializer(employee).data)
