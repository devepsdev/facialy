import getpass
import os

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.core.validators import validate_email

from core.models import Employee, Profile

ROLES = (Profile.USER, Profile.ADMIN, Profile.SUPERADMIN)


class Command(BaseCommand):
    help = (
        'Crea una cuenta con un rol (user | admin | superadmin) o, si ya existe, actualiza su rol y contraseña. '
        'Si no se indica --password se pide por teclado (sin eco) o se lee de ADD_USER_PASSWORD.'
    )

    def add_arguments(self, parser):
        parser.add_argument('--email', required=True, help='Email: se usa como nombre de usuario.')
        parser.add_argument('--role', choices=ROLES, default=Profile.ADMIN)
        parser.add_argument('--name', default='', help='Nombre y apellidos (opcional).')
        parser.add_argument('--password', default=None, help='Evítalo: queda en el historial de la shell.')
        parser.add_argument('--no-employee', action='store_true', help='No crear ficha de empleado (para registrar un rostro propio).')

    def handle(self, *args, email, role, name, password, no_employee, **options):
        email = email.strip().lower()
        try:
            validate_email(email)
        except ValidationError:
            raise CommandError(f'Email no válido: {email}')

        password = password or os.environ.get('ADD_USER_PASSWORD')
        if not password:
            password = getpass.getpass('Contraseña: ')
            if password != getpass.getpass('Repite la contraseña: '):
                raise CommandError('Las contraseñas no coinciden.')
        try:
            validate_password(password)
        except ValidationError as exc:
            raise CommandError(' '.join(exc.messages))

        User = get_user_model()
        first, _, last = name.strip().partition(' ')
        user, created = User.objects.get_or_create(
            username=email, defaults={'email': email, 'first_name': first, 'last_name': last},
        )
        user.set_password(password)
        user.is_active = True
        user.save()

        profile, _ = Profile.objects.get_or_create(user=user)
        profile.role = role
        profile.save()  # sincroniza is_staff / is_superuser

        if not no_employee and not hasattr(user, 'employee') and not Employee.objects.filter(email=email).exists():
            Employee.objects.create(
                first_name=first or email.split('@')[0], last_name=last, email=email, user=user,
                department='Administración' if role != Profile.USER else 'Cuenta propia', is_active=True,
            )

        self.stdout.write(self.style.SUCCESS(f'{"Creado" if created else "Actualizado"}: {email} · rol {role}'))
