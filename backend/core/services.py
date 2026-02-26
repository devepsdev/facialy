import cv2 as cv
import os
import numpy as np
import base64
import json
import shutil

from django.conf import settings

DATA_DIR = os.path.join(str(settings.BASE_DIR), 'face_data')
MODEL_PATH = os.path.join(str(settings.BASE_DIR), 'face_model.xml')
LABEL_MAP_PATH = os.path.join(str(settings.BASE_DIR), 'label_map.json')
CASCADE_PATH = cv.data.haarcascades + 'haarcascade_frontalface_default.xml'
TOTAL_IMAGES = 100


def _get_capture_count(visitor_name):
    folder = os.path.join(DATA_DIR, visitor_name)
    if not os.path.exists(folder):
        return 0
    return len([f for f in os.listdir(folder) if f.endswith('.jpg')])


def capture_face_from_base64(visitor_name, base64_frame):
    """Decodifica un frame en base64, detecta la cara y la guarda en disco."""
    if ',' in base64_frame:
        base64_frame = base64_frame.split(',')[1]

    try:
        img_bytes = base64.b64decode(base64_frame)
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv.imdecode(nparr, cv.IMREAD_COLOR)
    except Exception:
        count = _get_capture_count(visitor_name)
        return {'count': count, 'total': TOTAL_IMAGES, 'face_detected': False}

    if frame is None:
        count = _get_capture_count(visitor_name)
        return {'count': count, 'total': TOTAL_IMAGES, 'face_detected': False}

    folder = os.path.join(DATA_DIR, visitor_name)
    os.makedirs(folder, exist_ok=True)

    face_cascade = cv.CascadeClassifier(CASCADE_PATH)
    gray = cv.cvtColor(frame, cv.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, 1.3, 5)

    count = _get_capture_count(visitor_name)

    if len(faces) == 0:
        return {'count': count, 'total': TOTAL_IMAGES, 'face_detected': False}

    # Tomar la cara más grande detectada
    x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
    face_crop = gray[y:y + h, x:x + w]
    face_crop = cv.resize(face_crop, (160, 160), interpolation=cv.INTER_CUBIC)
    cv.imwrite(os.path.join(folder, f'imagen_{count}.jpg'), face_crop)
    count += 1

    return {'count': count, 'total': TOTAL_IMAGES, 'face_detected': True}


def train_model():
    """Entrena EigenFaceRecognizer con las imágenes capturadas y borra las fotos."""
    if not os.path.exists(DATA_DIR):
        return False

    labels = []
    faces = []
    label_map = {}
    current_id = 0

    for person_name in os.listdir(DATA_DIR):
        person_path = os.path.join(DATA_DIR, person_name)
        if not os.path.isdir(person_path):
            continue

        label_map[current_id] = person_name

        for image_file in sorted(os.listdir(person_path)):
            image_path = os.path.join(person_path, image_file)
            image = cv.imread(image_path, 0)
            if image is not None:
                labels.append(current_id)
                faces.append(image)

        current_id += 1

    if len(faces) < 2:
        return False

    recognizer = cv.face.EigenFaceRecognizer_create()
    recognizer.train(faces, np.array(labels))
    recognizer.write(MODEL_PATH)

    with open(LABEL_MAP_PATH, 'w') as f:
        json.dump(label_map, f)

    # Borrar fotos después de entrenar — solo queda el XML y label_map.json
    shutil.rmtree(DATA_DIR, ignore_errors=True)

    return True


def recognize_from_base64(base64_frame):
    """Decodifica un frame en base64 y ejecuta reconocimiento facial."""
    if ',' in base64_frame:
        base64_frame = base64_frame.split(',')[1]

    try:
        img_bytes = base64.b64decode(base64_frame)
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv.imdecode(nparr, cv.IMREAD_COLOR)
    except Exception:
        return []

    if frame is None:
        return []

    return recognize_from_frame(frame)


def recognize_from_frame(frame):
    """Reconoce caras en un frame OpenCV ya decodificado."""
    if not os.path.exists(MODEL_PATH) or not os.path.exists(LABEL_MAP_PATH):
        return []

    with open(LABEL_MAP_PATH, 'r') as f:
        label_map = json.load(f)

    recognizer = cv.face.EigenFaceRecognizer_create()
    recognizer.read(MODEL_PATH)
    face_cascade = cv.CascadeClassifier(CASCADE_PATH)

    gray = cv.cvtColor(frame, cv.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, 1.3, 5)

    results = []
    for (x, y, w, h) in faces:
        face_crop = gray[y:y + h, x:x + w]
        face_crop = cv.resize(face_crop, (160, 160), interpolation=cv.INTER_CUBIC)
        label, confidence = recognizer.predict(face_crop)

        name = label_map.get(str(label), 'Desconocido')
        if confidence >= 8000:
            name = 'Desconocido'

        results.append({
            'name': name,
            'confidence': float(confidence),
            'box': [int(x), int(y), int(w), int(h)],
        })

    return results


def cleanup_visitor():
    """Elimina fotos, modelo XML y label map del visitante demo."""
    shutil.rmtree(DATA_DIR, ignore_errors=True)
    if os.path.exists(MODEL_PATH):
        os.remove(MODEL_PATH)
    if os.path.exists(LABEL_MAP_PATH):
        os.remove(LABEL_MAP_PATH)


# Función legacy para compatibilidad con flujo de empleados vía cámara del servidor
def capture_faces(employee_name, num_images=351):
    folder = os.path.join(DATA_DIR, employee_name)
    os.makedirs(folder, exist_ok=True)

    camera = cv.VideoCapture(0)
    face_cascade = cv.CascadeClassifier(CASCADE_PATH)
    count = 0

    while count < num_images:
        ret, frame = camera.read()
        if not ret:
            break

        gray = cv.cvtColor(frame, cv.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, 1.3, 5)

        for (x, y, w, h) in faces:
            face_crop = frame[y:y + h, x:x + w]
            face_crop = cv.resize(face_crop, (160, 160), interpolation=cv.INTER_CUBIC)
            cv.imwrite(os.path.join(folder, f'imagen_{count}.jpg'), face_crop)
            count += 1

    camera.release()
    return count
