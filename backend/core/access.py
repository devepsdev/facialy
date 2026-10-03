"""Control de acceso: índice de plantillas, reglas de horario y registro de eventos."""

import threading
from datetime import timedelta

import numpy as np
from django.conf import settings
from django.db.models import Count, Max
from django.utils import timezone

from .models import AccessLog, Employee, FaceTemplate


# ── Índice de plantillas en memoria ───────────────────────────────────────────

class TemplateIndex:
    """Matriz (N, 128) con todas las plantillas; se reconstruye si la BD cambia."""

    def __init__(self):
        self._lock = threading.Lock()
        self._fingerprint = None
        self.matrix = np.empty((0, 128), dtype=np.float32)
        self.employee_ids = np.empty((0,), dtype=np.int64)

    def refresh(self):
        stats = FaceTemplate.objects.filter(employee__is_demo=False).aggregate(n=Count('id'), last=Max('id'))
        fingerprint = (stats['n'], stats['last'])
        with self._lock:
            if fingerprint == self._fingerprint:
                return
            rows = list(FaceTemplate.objects.filter(employee__is_demo=False).values_list('employee_id', 'embedding'))
            if rows:
                self.employee_ids = np.array([r[0] for r in rows], dtype=np.int64)
                self.matrix = np.stack([np.frombuffer(bytes(r[1]), dtype=np.float32) for r in rows])
            else:
                self.employee_ids = np.empty((0,), dtype=np.int64)
                self.matrix = np.empty((0, 128), dtype=np.float32)
            self._fingerprint = fingerprint

    def best_match(self, vector):
        """(employee_id | None, similitud) del mejor candidato; None si no supera el umbral."""
        self.refresh()
        if len(self.matrix) == 0:
            return None, 0.0
        sims = self.matrix @ vector
        best = int(np.argmax(sims))
        score = float(sims[best])
        if score >= settings.FACE_MATCH_THRESHOLD:
            return int(self.employee_ids[best]), score
        return None, score


index = TemplateIndex()


# ── Reglas de acceso ──────────────────────────────────────────────────────────

def _minutes(t):
    return t.hour * 60 + t.minute


def within_schedule(employee, now=None):
    """True si `now` cae en el horario del empleado (± margen). Sin horario = siempre."""
    if not employee.schedule_entry or not employee.schedule_exit:
        return True
    now = timezone.localtime(now or timezone.now())
    grace = settings.ACCESS_SCHEDULE_GRACE_MINUTES
    start = _minutes(employee.schedule_entry) - grace
    end = _minutes(employee.schedule_exit) + grace
    if end - start >= 24 * 60:
        return True
    start, end, current = start % 1440, end % 1440, _minutes(now)
    if start <= end:
        return start <= current <= end
    return current >= start or current <= end  # turno nocturno


def evaluate_access(employee, now=None):
    """Decide (resultado, motivo) para un empleado reconocido."""
    if not employee.is_active:
        return 'DENIED', 'INACTIVE'
    if not within_schedule(employee, now):
        return 'DENIED', 'OUTSIDE_SCHEDULE'
    return 'GRANTED', ''


def log_access(employee, result, reason, confidence):
    """Registra el evento salvo que ya exista uno idéntico (misma persona, resultado y motivo) dentro del cooldown.

    Returns:
        bool: True si se creó un registro nuevo.
    """
    since = timezone.now() - timedelta(seconds=settings.ACCESS_LOG_COOLDOWN_SECONDS)
    if AccessLog.objects.filter(employee=employee, result=result, reason=reason, timestamp__gte=since).exists():
        return False
    AccessLog.objects.create(employee=employee, result=result, reason=reason, confidence=confidence)
    return True


def process_face(vector):
    """Reconoce un embedding contra la base de empleados y aplica las reglas.

    Returns:
        dict con el veredicto (sin registrar nada todavía).
    """
    employee_id, score = index.best_match(vector)
    employee = Employee.objects.filter(pk=employee_id).first() if employee_id else None
    if employee is None:
        return {'employee': None, 'result': 'UNKNOWN', 'reason': '', 'similarity': score}
    result, reason = evaluate_access(employee)
    return {'employee': employee, 'result': result, 'reason': reason, 'similarity': score}
