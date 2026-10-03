"""Sesiones de captura en memoria (demo pública y registro de empleados).

Mientras dura una sesión solo se guardan embeddings (vectores de 128 floats) en
la RAM del proceso; ninguna imagen toca el disco. Caducan solas pasados unos
minutos. Requiere un único proceso de Gunicorn (ver Dockerfile: 1 worker + hilos).
"""

import secrets
import threading
import time

import numpy as np
from django.conf import settings

from .faces import engine


class SessionLimitReached(Exception):
    pass


class CaptureSession:
    def __init__(self, kind, name, employee_id=None):
        self.kind = kind
        self.name = name
        self.employee_id = employee_id
        self.embeddings = []
        self.created = self.last_seen = time.monotonic()

    @property
    def count(self):
        return len(self.embeddings)

    def templates(self):
        return np.stack(self.embeddings) if self.embeddings else np.empty((0, 128), dtype=np.float32)


_sessions = {}
_lock = threading.Lock()


def _sweep(now):
    ttl = settings.CAPTURE_SESSION_TTL_SECONDS
    for sid in [sid for sid, s in _sessions.items() if now - s.last_seen > ttl]:
        del _sessions[sid]


def create_session(kind, name, employee_id=None):
    now = time.monotonic()
    with _lock:
        _sweep(now)
        if len(_sessions) >= settings.CAPTURE_SESSION_MAX:
            raise SessionLimitReached()
        sid = secrets.token_urlsafe(16)
        _sessions[sid] = CaptureSession(kind, name, employee_id)
        return sid


def get_session(sid, kind=None, employee_id=None):
    now = time.monotonic()
    with _lock:
        _sweep(now)
        session = _sessions.get(sid)
        if session is None:
            return None
        if kind and session.kind != kind:
            return None
        if employee_id is not None and session.employee_id != employee_id:
            return None
        session.last_seen = now
        return session


def drop_session(sid):
    with _lock:
        return _sessions.pop(sid, None) is not None


def active_sessions():
    with _lock:
        return len(_sessions)


def add_frame(session, base64_frame):
    """Procesa un frame de captura y, si hay un rostro válido, guarda su embedding.

    Returns:
        dict con `count`, `total`, `face_detected`, `hint` y la `box` de la cara.
    """
    total = settings.FACE_CAPTURE_TARGET
    result = {'count': session.count, 'total': total, 'face_detected': False, 'hint': 'no_face', 'box': None}

    img = engine.decode(base64_frame)
    if img is None:
        result['hint'] = 'bad_frame'
        return result

    faces = engine.detect(img)
    if not faces:
        return result

    face = faces[0]
    result['box'] = face.to_dict()['box']
    if len(faces) > 1 and faces[1].width_ratio > 0.6 * face.width_ratio:
        result['hint'] = 'multiple_faces'
        return result
    if not engine.is_good_for_enrollment(face):
        result['hint'] = 'too_small' if face.width_ratio < 0.18 else 'low_quality'
        return result

    if session.count < total:
        session.embeddings.append(engine.embed(img, face))
    result.update(count=session.count, face_detected=True, hint='ok')
    return result
