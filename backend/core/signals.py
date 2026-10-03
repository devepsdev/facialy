from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Profile


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_profile(sender, instance, created, **kwargs):
    """Toda cuenta tiene un perfil con rol. Los superusuarios creados con `createsuperuser`
    (o desde el admin de Django) nacen como superadmin; los is_staff, como admin."""
    if not created:
        return
    if instance.is_superuser:
        role = Profile.SUPERADMIN
    elif instance.is_staff:
        role = Profile.ADMIN
    else:
        role = Profile.USER
    Profile.objects.get_or_create(user=instance, defaults={'role': role})
