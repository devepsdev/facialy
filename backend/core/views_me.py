"""«Mi perfil»: cada cuenta gestiona su propio rostro y verifica su identidad (1:1)."""

from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from . import access, enroll, faces, roles
from .audit import audit
from .models import AccessLog
from .permissions import HasOwnProfile
from .serializers import AccessLogSerializer, EmployeeSerializer

MIN_FACE_RATIO = 0.12


@api_view(['GET', 'DELETE'])
@permission_classes([HasOwnProfile])
def profile(request):
    employee = request.user.employee
    if request.method == 'DELETE':
        if roles.get_role(request.user) != roles.USER:
            return Response({'error': 'Las cuentas de administración las gestiona un superadministrador.'}, status=status.HTTP_403_FORBIDDEN)
        audit(request, 'account_deleted', request.user.username)
        request.user.delete()  # en cascada: ficha, plantillas biométricas y tokens
        return Response(status=status.HTTP_204_NO_CONTENT)

    history = AccessLog.objects.filter(employee=employee).select_related('employee')[:10]
    return Response({
        'user': roles.user_payload(request.user),
        'employee': EmployeeSerializer(employee).data,
        'history': AccessLogSerializer(history, many=True).data,
    })


@api_view(['POST'])
@permission_classes([HasOwnProfile])
def enroll_start(request):
    return enroll.start(request.user.employee)


@api_view(['POST'])
@permission_classes([HasOwnProfile])
def enroll_capture(request):
    return enroll.capture(request, request.user.employee)


@api_view(['POST'])
@permission_classes([HasOwnProfile])
def enroll_finish(request):
    return enroll.finish(request, request.user.employee)


@api_view(['DELETE'])
@permission_classes([HasOwnProfile])
def delete_face(request):
    return enroll.remove(request, request.user.employee)


@api_view(['POST'])
@permission_classes([HasOwnProfile])
def verify(request):
    """Verificación 1:1: ¿la persona frente a la cámara es el titular de esta cuenta?

    A diferencia del kiosco (1:N, identifica entre todos los empleados), solo se compara
    con las plantillas del propio usuario.
    """
    employee = request.user.employee
    templates = [t.get_vector() for t in employee.templates.all()]
    if not templates:
        return Response({'enrolled': False, 'face': None, 'verified': False})

    img = faces.engine.decode(request.data.get('frame'))
    detected = faces.engine.detect(img) if img is not None else []
    detected = [f for f in detected if f.width_ratio >= MIN_FACE_RATIO]
    if not detected:
        return Response({'enrolled': True, 'face': None, 'verified': False})

    face = detected[0]
    import numpy as np

    similarity = faces.best_similarity(faces.engine.embed(img, face), np.stack(templates))
    verified = similarity >= settings.FACE_MATCH_THRESHOLD
    body = {
        'enrolled': True, 'face': face.to_dict()['box'], 'verified': verified,
        'similarity': round(similarity, 3), 'access': None, 'logged': False,
    }
    if verified:
        result, reason = access.evaluate_access(employee)
        body['access'] = {'result': result, 'reason': reason}
        body['logged'] = access.log_access(employee, result, reason, similarity)
    return Response(body)
