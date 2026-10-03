"""Descarga (y verifica con SHA-256) los modelos ONNX de OpenCV Zoo que usa Facialy.

    python download_models.py [directorio_destino]

Por defecto guarda los ficheros en backend/models/. Se ejecuta durante el
build de la imagen Docker; en desarrollo basta con lanzarlo una vez.
"""

import hashlib
import os
import sys
import urllib.request

BASE = 'https://github.com/opencv/opencv_zoo/raw/main/models'
MODELS = {
    'face_detection_yunet_2023mar.onnx': (
        f'{BASE}/face_detection_yunet/face_detection_yunet_2023mar.onnx',
        '8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4',
    ),
    'face_recognition_sface_2021dec.onnx': (
        f'{BASE}/face_recognition_sface/face_recognition_sface_2021dec.onnx',
        '0ba9fbfa01b5270c96627c4ef784da859931e02f04419c829e83484087c34e79',
    ),
}


def sha256(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            digest.update(chunk)
    return digest.hexdigest()


def main():
    target = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'models')
    os.makedirs(target, exist_ok=True)
    for name, (url, expected) in MODELS.items():
        path = os.path.join(target, name)
        if os.path.exists(path) and sha256(path) == expected:
            print(f'OK   {name} (ya descargado)')
            continue
        print(f'GET  {name}')
        urllib.request.urlretrieve(url, path)
        if sha256(path) != expected:
            os.remove(path)
            sys.exit(f'ERROR: checksum incorrecto para {name}')
        print(f'OK   {name}')


if __name__ == '__main__':
    main()
