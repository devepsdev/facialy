import random
import unicodedata
from datetime import datetime, time, timedelta

import numpy as np
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from core.models import AccessLog, Employee, FaceTemplate

PEOPLE = [
    ('Lucía', 'Fernández', 'Ingeniería', time(8, 0), time(16, 0)),
    ('Marcos', 'Ortega', 'Ingeniería', time(9, 0), time(17, 0)),
    ('Elena', 'Navarro', 'Diseño', time(9, 30), time(17, 30)),
    ('Javier', 'Molina', 'Operaciones', time(7, 0), time(15, 0)),
    ('Sara', 'Iglesias', 'Recursos Humanos', time(9, 0), time(17, 0)),
    ('Pablo', 'Cano', 'Seguridad', time(22, 0), time(6, 0)),
    ('Marta', 'Ruiz', 'Finanzas', time(8, 30), time(16, 30)),
    ('Daniel', 'Vega', 'Operaciones', time(15, 0), time(23, 0)),
    ('Irene', 'Santos', 'Dirección', None, None),
    ('Alberto', 'Gil', 'Ingeniería', time(9, 0), time(17, 0)),
]


def ascii_slug(text):
    return unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode().lower()


class Command(BaseCommand):
    help = (
        'Genera empleados y 14 días de accesos ficticios (marcados is_demo) para el rol invitado. '
        'Es idempotente y nunca toca datos reales: no hace nada si ya existen datos de demo (usa --reset).'
    )

    def add_arguments(self, parser):
        parser.add_argument('--reset', action='store_true', help='Borra los datos de demo anteriores (nunca los reales) antes de generar.')

    @transaction.atomic
    def handle(self, *args, **options):
        if options['reset']:
            AccessLog.objects.filter(is_demo=True).delete()
            Employee.objects.filter(is_demo=True).delete()
        elif Employee.objects.filter(is_demo=True).exists():
            self.stdout.write('Ya hay datos de demo: no se genera nada (usa --reset para regenerar).')
            return

        rng = random.Random(42)
        np_rng = np.random.default_rng(42)
        now = timezone.now()

        employees = []
        for i, (first, last, dept, entry, exit_) in enumerate(PEOPLE):
            emp = Employee.objects.create(
                first_name=first, last_name=last, department=dept,
                email=f'{ascii_slug(first)}.{ascii_slug(last)}@acme.example',
                schedule_entry=entry, schedule_exit=exit_,
                is_active=(i != 9), is_demo=True, face_enrolled_at=now - timedelta(days=rng.randint(15, 60)),
            )
            # Plantillas sintéticas: vectores aleatorios que nunca coinciden con un rostro real
            for _ in range(3):
                vec = np_rng.normal(size=128).astype(np.float32)
                template = FaceTemplate(employee=emp)
                template.set_vector(vec / np.linalg.norm(vec))
                template.save()
            employees.append(emp)

        logs = []
        for days_ago in range(14):
            day = (timezone.localtime(now) - timedelta(days=days_ago)).date()
            if days_ago > 0 and day.weekday() >= 5 and rng.random() < 0.7:
                continue  # fines de semana tranquilos
            for emp in employees:
                if not emp.is_active or rng.random() < 0.1:
                    continue
                entry = emp.schedule_entry or time(9, 0)
                exit_ = emp.schedule_exit or time(18, 0)
                for moment, jitter in ((entry, (-20, 15)), (exit_, (-5, 25))):
                    stamp = timezone.make_aware(datetime.combine(day, moment)) + timedelta(minutes=rng.randint(*jitter))
                    if stamp > now:
                        continue
                    logs.append(AccessLog(is_demo=True, 
                        employee=emp, result='GRANTED', confidence=round(rng.uniform(0.55, 0.86), 3), timestamp=stamp,
                    ))
            for _ in range(rng.randint(0, 3)):  # intentos de desconocidos
                stamp = timezone.make_aware(datetime.combine(day, time(rng.randint(7, 21), rng.randint(0, 59))))
                if stamp <= now:
                    logs.append(AccessLog(is_demo=True, result='UNKNOWN', confidence=round(rng.uniform(0.05, 0.3), 3), timestamp=stamp))
            if rng.random() < 0.6:  # fuera de horario
                emp = rng.choice([e for e in employees if e.schedule_entry and e.is_active])
                stamp = timezone.make_aware(datetime.combine(day, time(rng.choice([2, 3, 4, 23]), rng.randint(0, 59))))
                if stamp <= now:
                    logs.append(AccessLog(is_demo=True, 
                        employee=emp, result='DENIED', reason='OUTSIDE_SCHEDULE',
                        confidence=round(rng.uniform(0.5, 0.8), 3), timestamp=stamp,
                    ))

        # Actividad "reciente" para que el dashboard de hoy nunca aparezca vacío
        for emp in rng.sample([e for e in employees if e.is_active], 5):
            stamp = now - timedelta(minutes=rng.randint(4, 150))
            logs.append(AccessLog(is_demo=True, employee=emp, result='GRANTED', confidence=round(rng.uniform(0.55, 0.86), 3), timestamp=stamp))
        logs.append(AccessLog(is_demo=True, result='UNKNOWN', confidence=0.18, timestamp=now - timedelta(minutes=rng.randint(10, 90))))

        # auto_now_add pisa el timestamp en el INSERT: lo restauramos con un bulk_update
        stamps = [log.timestamp for log in logs]
        AccessLog.objects.bulk_create(logs)
        for log, stamp in zip(logs, stamps):
            log.timestamp = stamp
        AccessLog.objects.bulk_update(logs, ['timestamp'], batch_size=500)
        self.stdout.write(self.style.SUCCESS(f'{len(employees)} empleados y {len(logs)} accesos generados.'))
