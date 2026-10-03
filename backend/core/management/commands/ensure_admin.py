import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from core.models import Profile


class Command(BaseCommand):
    help = (
        'Crea (o actualiza la contraseña de) un superadministrador a partir de ADMIN_USER y ADMIN_PASSWORD. '
        'Es idempotente: pensado para el arranque del contenedor. Para otros roles usa `add_user`.'
    )

    def handle(self, *args, **options):
        username = os.environ.get('ADMIN_USER') or 'admin'
        password = os.environ.get('ADMIN_PASSWORD')
        if not password:
            self.stdout.write('ADMIN_PASSWORD no definida: no se toca ningún usuario.')
            return
        if len(password) < 8:
            raise CommandError('ADMIN_PASSWORD debe tener al menos 8 caracteres.')

        User = get_user_model()
        user, created = User.objects.get_or_create(username=username)
        if '@' in username and not user.email:
            user.email = username
        user.is_active = True
        user.set_password(password)
        user.save()
        profile, _ = Profile.objects.get_or_create(user=user)
        profile.role = Profile.SUPERADMIN
        profile.save()
        self.stdout.write(self.style.SUCCESS(f'Superadmin "{username}" {"creado" if created else "actualizado"}.'))
