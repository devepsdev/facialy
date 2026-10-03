import csv
from datetime import timedelta

from django.conf import settings
from django.db import connection
from django.db.models import Count, Q
from django.db.models.functions import ExtractHour, TruncDate
from django.http import StreamingHttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import status, viewsets
from rest_framework.decorators import (
    action, api_view, authentication_classes, permission_classes, throttle_classes,
)
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from . import access, enroll, faces, roles, sessions
from .audit import audit
from .models import AccessLog, Employee
from .permissions import IsAdmin
from .serializers import AccessLogSerializer, EmployeeSerializer

# Rostros más pequeños que esto (fracción del ancho) no se intentan identificar en el kiosco
KIOSK_MIN_FACE_RATIO = 0.12


class DemoThrottle(AnonRateThrottle):
    scope = 'demo'


def _demo_only(qs, user):
    """El invitado solo ve los datos de demostración; los administradores lo ven todo."""
    return qs.filter(is_demo=True) if roles.get_role(user) == roles.VIEWER else qs


# ── Estado del servicio ───────────────────────────────────────────────────────

@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def health(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
        db_ok = True
    except Exception:
        db_ok = False
    models_ok = faces.models_available()
    body = {'status': 'ok' if db_ok and models_ok else 'degraded', 'database': db_ok, 'face_models': models_ok}
    return Response(body, status=200 if db_ok else 503)


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def public_config(request):
    return Response({
        'guest_login_enabled': settings.GUEST_LOGIN_ENABLED,
        'registration_enabled': settings.REGISTRATION_ENABLED,
        'capture_target': settings.FACE_CAPTURE_TARGET,
        'match_threshold': settings.FACE_MATCH_THRESHOLD,
    })


# ── Demo pública (sandbox en memoria, sin escribir en la BD) ──────────────────

def _clean_name(raw):
    name = ''.join(ch for ch in str(raw or '') if ch.isprintable()).strip()
    return name[:60]


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([DemoThrottle])
def demo_start(request):
    name = _clean_name(request.data.get('name'))
    if not name:
        return Response({'error': 'El nombre es obligatorio.'}, status=status.HTTP_400_BAD_REQUEST)
    sid = sessions.create_session('demo', name)
    return Response({'session_id': sid, 'name': name, 'total': settings.FACE_CAPTURE_TARGET})


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([DemoThrottle])
def demo_capture(request):
    session = sessions.get_session(request.data.get('session_id'), kind='demo')
    if session is None:
        return Response({'error': 'La sesión ha caducado.', 'code': 'session_expired'}, status=status.HTTP_404_NOT_FOUND)
    return Response(sessions.add_frame(session, request.data.get('frame')))


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([DemoThrottle])
def demo_recognize(request):
    session = sessions.get_session(request.data.get('session_id'), kind='demo')
    if session is None:
        return Response({'error': 'La sesión ha caducado.', 'code': 'session_expired'}, status=status.HTTP_404_NOT_FOUND)

    img = faces.engine.decode(request.data.get('frame'))
    if img is None:
        return Response({'results': []})

    templates = session.templates()
    results = []
    for face in faces.engine.detect(img):
        similarity = faces.best_similarity(faces.engine.embed(img, face), templates)
        known = similarity >= settings.FACE_MATCH_THRESHOLD
        results.append({
            'name': session.name if known else 'Desconocido',
            'known': known,
            'similarity': round(similarity, 3),
            'box': face.to_dict()['box'],
        })
    return Response({'results': results})


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([DemoThrottle])
def demo_end(request):
    sessions.drop_session(request.data.get('session_id'))
    return Response({'success': True})


# ── Empleados ─────────────────────────────────────────────────────────────────

class EmployeeViewSet(viewsets.ModelViewSet):
    queryset = Employee.objects.select_related('user__profile')
    serializer_class = EmployeeSerializer

    def get_queryset(self):
        qs = _demo_only(super().get_queryset(), self.request.user)
        params = self.request.query_params
        search = params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(first_name__icontains=search) | Q(last_name__icontains=search)
                | Q(email__icontains=search) | Q(department__icontains=search)
            )
        if params.get('is_active') in ('true', 'false'):
            qs = qs.filter(is_active=params['is_active'] == 'true')
        if params.get('has_face') in ('true', 'false'):
            qs = qs.filter(face_enrolled_at__isnull=params['has_face'] == 'false')
        if params.get('pending') == 'true':
            qs = qs.filter(user__isnull=False, is_active=False)
        return qs

    def perform_destroy(self, instance):
        name, user = instance.full_name, instance.user
        # Una cuenta de usuario normal desaparece con su ficha (derecho de supresión);
        # las cuentas de administración se conservan.
        if user is not None and roles.get_role(user) == roles.USER:
            user.delete()
        else:
            instance.delete()
        audit(self.request, 'employee_deleted', name)

    @action(detail=True, methods=['post'], url_path='enroll/start')
    def enroll_start(self, request, pk=None):
        return enroll.start(self.get_object())

    @action(detail=True, methods=['post'], url_path='enroll/capture')
    def enroll_capture(self, request, pk=None):
        return enroll.capture(request, self.get_object())

    @action(detail=True, methods=['post'], url_path='enroll/finish')
    def enroll_finish(self, request, pk=None):
        return enroll.finish(request, self.get_object())

    @action(detail=True, methods=['delete'], url_path='face')
    def delete_face(self, request, pk=None):
        """Elimina los datos biométricos del empleado (derecho de supresión)."""
        return enroll.remove(request, self.get_object())


# ── Registro de accesos ───────────────────────────────────────────────────────

def _filter_logs(qs, params):
    results = [r for r in params.get('result', '').split(',') if r in ('GRANTED', 'DENIED', 'UNKNOWN')]
    if results:
        qs = qs.filter(result__in=results)
    if params.get('employee', '').isdigit():
        qs = qs.filter(employee_id=int(params['employee']))
    date_from, date_to = parse_date(params.get('date_from', '')), parse_date(params.get('date_to', ''))
    if date_from:
        qs = qs.filter(timestamp__date__gte=date_from)
    if date_to:
        qs = qs.filter(timestamp__date__lte=date_to)
    q = params.get('q', '').strip()
    if q:
        qs = qs.filter(Q(employee__first_name__icontains=q) | Q(employee__last_name__icontains=q))
    return qs


def _csv_safe(value):
    """Evita inyección de fórmulas al abrir el CSV en Excel/Sheets."""
    text = str(value)
    return "'" + text if text[:1] in ('=', '+', '-', '@', '\t', '\r') else text


class _Echo:
    def write(self, value):
        return value


class AccessLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AccessLog.objects.select_related('employee')
    serializer_class = AccessLogSerializer

    def get_queryset(self):
        qs = _demo_only(super().get_queryset(), self.request.user)
        return _filter_logs(qs, self.request.query_params)

    @action(detail=False, methods=['get'])
    def export(self, request):
        qs = self.get_queryset()
        writer = csv.writer(_Echo())

        def rows():
            yield '﻿'  # BOM para que Excel detecte UTF-8
            yield writer.writerow(['fecha', 'empleado', 'departamento', 'resultado', 'motivo', 'similitud'])
            for log in qs.iterator(chunk_size=500):
                yield writer.writerow([
                    timezone.localtime(log.timestamp).strftime('%Y-%m-%d %H:%M:%S'),
                    _csv_safe(log.employee.full_name if log.employee else 'Desconocido'),
                    _csv_safe(log.employee.department if log.employee else ''),
                    log.result, log.reason, f'{log.confidence:.3f}',
                ])

        response = StreamingHttpResponse(rows(), content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="accesos.csv"'
        return response


# ── Kiosco de acceso (reconocimiento + registro en la BD) ─────────────────────

@api_view(['POST'])
@permission_classes([IsAdmin])
def kiosk_recognize(request):
    img = faces.engine.decode(request.data.get('frame'))
    if img is None:
        return Response({'results': []})

    results = []
    for face in faces.engine.detect(img):
        if face.width_ratio < KIOSK_MIN_FACE_RATIO:
            continue
        verdict = access.process_face(faces.engine.embed(img, face))
        employee = verdict['employee']
        logged = access.log_access(employee, verdict['result'], verdict['reason'], verdict['similarity'])
        results.append({
            'box': face.to_dict()['box'],
            'result': verdict['result'],
            'reason': verdict['reason'],
            'similarity': round(verdict['similarity'], 3),
            'employee_id': employee.id if employee else None,
            'name': employee.full_name if employee else 'Desconocido',
            'department': employee.department if employee else '',
            'logged': logged,
        })
    return Response({'results': results})


# ── Dashboard ─────────────────────────────────────────────────────────────────

@api_view(['GET'])
def dashboard(request):
    logs = _demo_only(AccessLog.objects.all(), request.user)
    today = timezone.localdate()
    start = today - timedelta(days=6)

    def counts(qs):
        return qs.aggregate(
            total=Count('id'),
            granted=Count('id', filter=Q(result='GRANTED')),
            denied=Count('id', filter=Q(result='DENIED')),
            unknown=Count('id', filter=Q(result='UNKNOWN')),
        )

    today_counts = counts(logs.filter(timestamp__date=today))
    yesterday_total = logs.filter(timestamp__date=today - timedelta(days=1)).count()

    daily = {
        row['day']: row
        for row in logs.filter(timestamp__date__gte=start)
        .annotate(day=TruncDate('timestamp')).values('day')
        .annotate(
            granted=Count('id', filter=Q(result='GRANTED')),
            denied=Count('id', filter=Q(result='DENIED')),
            unknown=Count('id', filter=Q(result='UNKNOWN')),
        )
    }
    last_7_days = []
    for offset in range(7):
        day = start + timedelta(days=offset)
        row = daily.get(day, {})
        last_7_days.append({
            'date': day.isoformat(),
            'granted': row.get('granted', 0),
            'denied': row.get('denied', 0),
            'unknown': row.get('unknown', 0),
        })

    hours = [0] * 24
    for row in (
        logs.filter(timestamp__date__gte=start)
        .annotate(hour=ExtractHour('timestamp')).values('hour').annotate(n=Count('id'))
    ):
        hours[row['hour']] = row['n']

    top_employees = list(
        logs.filter(timestamp__date__gte=today - timedelta(days=29), employee__isnull=False, result='GRANTED')
        .values('employee_id', 'employee__first_name', 'employee__last_name', 'employee__department')
        .annotate(n=Count('id')).order_by('-n')[:5]
    )

    recent = logs.select_related('employee')[:8]
    employees = _demo_only(Employee.objects.filter(is_active=True), request.user)
    return Response({
        'total_employees': employees.count(),
        'enrolled_employees': employees.filter(face_enrolled_at__isnull=False).count(),
        'accesses_today': today_counts['total'],
        'granted_today': today_counts['granted'],
        'denied_today': today_counts['denied'],
        'unknown_today': today_counts['unknown'],
        'accesses_yesterday': yesterday_total,
        'last_7_days': last_7_days,
        'by_hour': hours,
        'top_employees': [
            {
                'employee_id': r['employee_id'],
                'name': f"{r['employee__first_name']} {r['employee__last_name']}".strip(),
                'department': r['employee__department'],
                'count': r['n'],
            }
            for r in top_employees
        ],
        'recent_logs': AccessLogSerializer(recent, many=True).data,
    })
