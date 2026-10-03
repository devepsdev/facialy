from rest_framework.response import Response
from rest_framework.views import exception_handler

from .faces import FaceModelsMissing
from .sessions import SessionLimitReached


def api_exception_handler(exc, context):
    """Traduce los errores propios del dominio a respuestas 503 legibles."""
    if isinstance(exc, FaceModelsMissing):
        return Response(
            {'error': 'El motor de reconocimiento no está disponible en el servidor.', 'code': 'models_missing'},
            status=503,
        )
    if isinstance(exc, SessionLimitReached):
        return Response(
            {'error': 'Hay demasiadas demos activas en este momento. Inténtalo en unos minutos.',
             'code': 'too_many_sessions'},
            status=503,
        )
    return exception_handler(exc, context)
