"""Motor de reconocimiento facial: detección (YuNet) + embeddings (SFace).

Ambos modelos son ONNX ligeros que se ejecutan con OpenCV (cv.FaceDetectorYN y
cv.FaceRecognizerSF), sin necesidad de GPU. El reconocimiento no "entrena" nada:
cada rostro se convierte en un vector de 128 dimensiones y se compara por
similitud coseno con las plantillas guardadas. Así registrar a una persona nueva
no afecta a las existentes y nunca hace falta conservar fotografías.
"""

import base64
import binascii
import os
import threading
from dataclasses import dataclass

import cv2 as cv
import numpy as np
from django.conf import settings

YUNET_FILE = 'face_detection_yunet_2023mar.onnx'
SFACE_FILE = 'face_recognition_sface_2021dec.onnx'

# Los fotogramas se reducen a este ancho máximo antes de procesarlos (velocidad)
MAX_FRAME_WIDTH = 640
# Límite del frame en base64 (~1.5 MB): protege al servidor de cargas enormes
MAX_B64_LENGTH = 1_500_000
# Un rostro debe ocupar al menos esta fracción del ancho para guardarse como plantilla
MIN_ENROLL_FACE_RATIO = 0.18
MAX_FACES_PER_FRAME = 5


class FaceModelsMissing(RuntimeError):
    """Los ficheros ONNX no están disponibles (ejecuta backend/download_models.py)."""


@dataclass
class Face:
    box: tuple          # (x, y, w, h) normalizado 0-1 respecto al frame
    score: float        # confianza del detector
    row: np.ndarray     # fila YuNet en píxeles (necesaria para alinear)
    width_ratio: float

    def to_dict(self):
        return {'box': [round(v, 4) for v in self.box], 'score': round(self.score, 3)}


def models_available():
    base = settings.FACE_MODELS_DIR
    return os.path.exists(os.path.join(base, YUNET_FILE)) and os.path.exists(os.path.join(base, SFACE_FILE))


class FaceEngine:
    """Envoltorio thread-safe sobre los modelos de OpenCV (se cargan una sola vez)."""

    def __init__(self):
        self._lock = threading.Lock()
        self._detector = None
        self._recognizer = None

    def _load(self):
        if self._detector is not None:
            return
        if not models_available():
            raise FaceModelsMissing(
                f'Modelos ONNX no encontrados en {settings.FACE_MODELS_DIR}. '
                'Ejecuta: python download_models.py'
            )
        base = settings.FACE_MODELS_DIR
        self._detector = cv.FaceDetectorYN.create(
            os.path.join(base, YUNET_FILE), '', (320, 320),
            settings.FACE_DETECT_SCORE, 0.3, 50,
        )
        self._recognizer = cv.FaceRecognizerSF.create(os.path.join(base, SFACE_FILE), '')

    # ── Decodificación ────────────────────────────────────────────────────────

    @staticmethod
    def decode(base64_frame):
        """Decodifica un frame base64 (con o sin prefijo data:) a BGR. None si es inválido."""
        if not isinstance(base64_frame, str) or not base64_frame or len(base64_frame) > MAX_B64_LENGTH:
            return None
        if ',' in base64_frame:
            base64_frame = base64_frame.split(',', 1)[1]
        try:
            raw = base64.b64decode(base64_frame, validate=False)
            img = cv.imdecode(np.frombuffer(raw, np.uint8), cv.IMREAD_COLOR)
        except (binascii.Error, ValueError, cv.error):
            return None
        if img is None:
            return None
        h, w = img.shape[:2]
        if w > MAX_FRAME_WIDTH:
            img = cv.resize(img, (MAX_FRAME_WIDTH, int(h * MAX_FRAME_WIDTH / w)), interpolation=cv.INTER_AREA)
        return img

    # ── Detección y embeddings ────────────────────────────────────────────────

    def detect(self, img):
        """Devuelve la lista de Face detectadas, de mayor a menor tamaño."""
        self._load()
        h, w = img.shape[:2]
        with self._lock:
            self._detector.setInputSize((w, h))
            _, rows = self._detector.detect(img)
        if rows is None:
            return []
        faces = []
        for row in rows:
            x, y, fw, fh = (float(v) for v in row[:4])
            x, y = max(x, 0.0), max(y, 0.0)
            fw, fh = min(fw, w - x), min(fh, h - y)
            if fw <= 1 or fh <= 1:
                continue
            faces.append(Face(
                box=(x / w, y / h, fw / w, fh / h),
                score=float(row[14]),
                row=row,
                width_ratio=fw / w,
            ))
        faces.sort(key=lambda f: f.box[2] * f.box[3], reverse=True)
        return faces[:MAX_FACES_PER_FRAME]

    def embed(self, img, face):
        """Embedding L2-normalizado (128,) de una cara detectada."""
        self._load()
        with self._lock:
            aligned = self._recognizer.alignCrop(img, face.row)
            feature = self._recognizer.feature(aligned)
        vector = feature.ravel().astype(np.float32)
        norm = np.linalg.norm(vector)
        return vector / norm if norm else vector

    def is_good_for_enrollment(self, face):
        return face.score >= max(settings.FACE_DETECT_SCORE, 0.9) and face.width_ratio >= MIN_ENROLL_FACE_RATIO


engine = FaceEngine()


# ── Comparación ───────────────────────────────────────────────────────────────

def best_similarity(vector, templates):
    """Máxima similitud coseno entre `vector` y una matriz (N, 128) de plantillas."""
    if templates is None or len(templates) == 0:
        return 0.0
    return float(np.max(templates @ vector))


def select_diverse(vectors, k):
    """Elige hasta k vectores lo más distintos entre sí (farthest-point sampling).

    Conserva variedad de poses/iluminación en lugar de k fotogramas casi idénticos.
    """
    if len(vectors) <= k:
        return list(vectors)
    matrix = np.stack(vectors)
    chosen = [0]
    best_sim = matrix @ matrix[0]
    while len(chosen) < k:
        idx = int(np.argmin(best_sim))
        chosen.append(idx)
        best_sim = np.maximum(best_sim, matrix @ matrix[idx])
    return [vectors[i] for i in chosen]
