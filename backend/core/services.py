import cv2 as cv
import os
import numpy as np
from django.conf import settings

# Rutas
DATA_DIR = os.path.join(settings.BASE_DIR, 'face_data')
MODEL_PATH = os.path.join(settings.BASE_DIR, 'face_model.xml')
CASCADE_PATH = cv.data.haarcascades + 'haarcascade_frontalface_default.xml'


def capture_faces(employee_name, num_images=351):
    folder = os.path.join(DATA_DIR, employee_name)
    if not os.path.exists(folder):
        os.makedirs(folder)

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
            face_crop = frame[y:y+h, x:x+w]
            face_crop = cv.resize(face_crop, (160, 160), interpolation=cv.INTER_CUBIC)
            cv.imwrite(os.path.join(folder, f'imagen_{count}.jpg'), face_crop)
            count += 1

    camera.release()
    return count


def train_model():
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

        for image_file in os.listdir(person_path):
            image_path = os.path.join(person_path, image_file)
            image = cv.imread(image_path, 0)
            if image is not None:
                labels.append(current_id)
                faces.append(image)

        current_id += 1

    if len(faces) == 0:
        return False

    recognizer = cv.face.EigenFaceRecognizer_create()
    recognizer.train(faces, np.array(labels))
    recognizer.write(MODEL_PATH)

    # Guardar el mapa de etiquetas
    import json
    label_map_path = os.path.join(settings.BASE_DIR, 'label_map.json')
    with open(label_map_path, 'w') as f:
        json.dump(label_map, f)

    return True


def recognize_from_frame(frame):
    label_map_path = os.path.join(settings.BASE_DIR, 'label_map.json')

    if not os.path.exists(MODEL_PATH) or not os.path.exists(label_map_path):
        return []

    import json
    with open(label_map_path, 'r') as f:
        label_map = json.load(f)

    recognizer = cv.face.EigenFaceRecognizer_create()
    recognizer.read(MODEL_PATH)
    face_cascade = cv.CascadeClassifier(CASCADE_PATH)

    gray = cv.cvtColor(frame, cv.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, 1.3, 5)

    results = []
    for (x, y, w, h) in faces:
        face_crop = gray[y:y+h, x:x+w]
        face_crop = cv.resize(face_crop, (160, 160), interpolation=cv.INTER_CUBIC)
        label, confidence = recognizer.predict(face_crop)

        name = label_map.get(str(label), "Desconocido")
        if confidence >= 8000:
            name = "Desconocido"

        results.append({
            "name": name,
            "confidence": float(confidence),
            "box": [int(x), int(y), int(w), int(h)]
        })

    return results