from django.conf import settings

from .models import AuditLog


def client_ip(request):
    """IP real del cliente teniendo en cuenta los proxies de confianza (NUM_PROXIES)."""
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if forwarded:
        parts = [p.strip() for p in forwarded.split(',') if p.strip()]
        proxies = settings.REST_FRAMEWORK.get('NUM_PROXIES', 1)
        if parts:
            return parts[-proxies] if len(parts) >= proxies else parts[0]
    return request.META.get('REMOTE_ADDR') or None


def audit(request, action, target='', actor=None, label=''):
    actor = actor or getattr(request, 'user', None)
    if actor is not None and not getattr(actor, 'is_authenticated', False):
        actor = None
    AuditLog.objects.create(
        actor=actor,
        actor_label=(actor.username if actor else label)[:150],
        action=action,
        target=str(target)[:200],
        ip=client_ip(request),
    )
