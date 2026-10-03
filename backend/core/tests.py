import base64
import time as time_module
from datetime import datetime, time, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import cv2 as cv
import numpy as np
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from . import access, faces, sessions
from .models import AccessLog, AuditLog, Employee, FaceTemplate, Profile

User = get_user_model()
FIXTURE = Path(__file__).parent / 'tests_assets' / 'face.jpg'
needs_models = __import__('unittest').skipUnless(faces.models_available(), 'Modelos ONNX no descargados')


def frame_b64(image=None, flip=False, dim=False):
    """Frame de prueba en base64 (la cara del fixture, opcionalmente alterada)."""
    img = cv.imread(str(FIXTURE)) if image is None else image
    if flip:
        img = cv.flip(img, 1)
    if dim:
        img = cv.convertScaleAbs(img, alpha=0.75, beta=8)
    ok, buf = cv.imencode('.jpg', img)
    return 'data:image/jpeg;base64,' + base64.b64encode(buf.tobytes()).decode()


def noise_frame():
    rng = np.random.default_rng(1)
    return frame_b64(rng.integers(0, 255, (240, 320, 3), dtype=np.uint8))


class ApiTestCase(TestCase):
    def setUp(self):
        cache.clear()
        sessions._sessions.clear()
        access.index._fingerprint = None
        self.admin = User.objects.create_user('admin', password='s3cret-pass-1', is_staff=True)
        self.superadmin = User.objects.create_user('root', password='s3cret-pass-1', is_superuser=True, is_staff=True)
        self.guest = User.objects.create_user('guest', password='x')
        self.guest.profile.role = Profile.VIEWER
        self.guest.profile.save()
        self.plain = User.objects.create_user('plain@example.com', email='plain@example.com', password='s3cret-pass-1')
        self.staff = self.client_for(self.admin)
        self.root = self.client_for(self.superadmin)
        self.viewer = self.client_for(self.guest)
        self.user_api = self.client_for(self.plain)
        self.anon = APIClient()

    @staticmethod
    def client_for(user):
        c = APIClient()
        c.force_authenticate(user)
        return c


# ── Modelos ───────────────────────────────────────────────────────────────────

class ModelTests(TestCase):
    def test_employee_defaults_and_str(self):
        emp = Employee.objects.create(first_name='Juan')
        self.assertEqual(emp.last_name, '')
        self.assertIsNone(emp.email)
        self.assertTrue(emp.is_active)
        self.assertEqual(str(emp), 'Juan')
        self.assertEqual(str(Employee(first_name='Carlos', last_name='López')), 'Carlos López')

    def test_email_unico(self):
        Employee.objects.create(first_name='Juan', email='juan@example.com')
        with self.assertRaises(Exception):
            Employee.objects.create(first_name='José', email='juan@example.com')

    def test_template_vector_roundtrip(self):
        emp = Employee.objects.create(first_name='Ana')
        vec = np.random.default_rng(0).normal(size=128).astype(np.float32)
        t = FaceTemplate(employee=emp)
        t.set_vector(vec)
        t.save()
        np.testing.assert_array_equal(FaceTemplate.objects.get().get_vector(), vec)

    def test_template_cascade_on_employee_delete(self):
        emp = Employee.objects.create(first_name='Ana')
        FaceTemplate.objects.create(employee=emp, embedding=b'\x00' * 512)
        emp.delete()
        self.assertEqual(FaceTemplate.objects.count(), 0)

    def test_access_log_keeps_row_when_employee_deleted(self):
        emp = Employee.objects.create(first_name='Ana')
        log = AccessLog.objects.create(employee=emp, result='GRANTED')
        emp.delete()
        log.refresh_from_db()
        self.assertIsNone(log.employee)


# ── Reglas de acceso ──────────────────────────────────────────────────────────

MADRID = ZoneInfo('Europe/Madrid')


def at(hour, minute=0):
    return datetime(2026, 3, 11, hour, minute, tzinfo=MADRID)


@override_settings(ACCESS_SCHEDULE_GRACE_MINUTES=30)
class ScheduleTests(TestCase):
    def emp(self, entry, exit_, **kw):
        return Employee(first_name='X', schedule_entry=entry, schedule_exit=exit_, **kw)

    def test_sin_horario_siempre_permitido(self):
        self.assertTrue(access.within_schedule(self.emp(None, None), at(3)))

    def test_dentro_y_fuera_del_horario_diurno(self):
        e = self.emp(time(9), time(17))
        self.assertTrue(access.within_schedule(e, at(12)))
        self.assertTrue(access.within_schedule(e, at(8, 35)))   # margen de 30 min
        self.assertTrue(access.within_schedule(e, at(17, 25)))
        self.assertFalse(access.within_schedule(e, at(8, 20)))
        self.assertFalse(access.within_schedule(e, at(18)))
        self.assertFalse(access.within_schedule(e, at(3)))

    def test_turno_nocturno_cruza_medianoche(self):
        e = self.emp(time(22), time(6))
        self.assertTrue(access.within_schedule(e, at(23)))
        self.assertTrue(access.within_schedule(e, at(2)))
        self.assertTrue(access.within_schedule(e, at(6, 20)))
        self.assertFalse(access.within_schedule(e, at(12)))

    def test_evaluate_access(self):
        self.assertEqual(access.evaluate_access(self.emp(None, None, is_active=False)), ('DENIED', 'INACTIVE'))
        e = self.emp(time(9), time(17))
        self.assertEqual(access.evaluate_access(e, at(12)), ('GRANTED', ''))
        self.assertEqual(access.evaluate_access(e, at(2)), ('DENIED', 'OUTSIDE_SCHEDULE'))


class FaceMathTests(TestCase):
    def test_select_diverse_prefers_distinct_vectors(self):
        a = np.array([1, 0, 0], dtype=np.float32)
        b = np.array([0, 1, 0], dtype=np.float32)
        c = np.array([0, 0, 1], dtype=np.float32)
        picked = faces.select_diverse([a, a.copy(), a.copy(), b, c], 3)
        self.assertEqual({tuple(v) for v in picked}, {tuple(a), tuple(b), tuple(c)})

    def test_select_diverse_returns_all_when_few(self):
        vecs = [np.ones(3, dtype=np.float32)] * 2
        self.assertEqual(len(faces.select_diverse(vecs, 5)), 2)

    def test_best_similarity(self):
        t = np.eye(3, dtype=np.float32)
        self.assertAlmostEqual(faces.best_similarity(np.array([0, 1, 0], dtype=np.float32), t), 1.0)
        self.assertEqual(faces.best_similarity(np.ones(3, dtype=np.float32), np.empty((0, 3))), 0.0)

    def test_decode_rechaza_basura(self):
        for bad in (None, '', 'no-es-base64!!', 'data:image/jpeg;base64,AAAA', 123, 'x' * 2_000_000):
            self.assertIsNone(faces.engine.decode(bad))


# ── Autenticación JWT y permisos ──────────────────────────────────────────────

REFRESH = 'facialy_refresh'


class RolesTests(ApiTestCase):
    def test_roles_se_derivan_de_los_flags(self):
        self.assertEqual(self.admin.profile.role, Profile.ADMIN)
        self.assertEqual(self.superadmin.profile.role, Profile.SUPERADMIN)
        self.assertEqual(self.plain.profile.role, Profile.USER)

    def test_cambiar_rol_sincroniza_flags_de_django(self):
        self.plain.profile.role = Profile.SUPERADMIN
        self.plain.profile.save()
        self.plain.refresh_from_db()
        self.assertTrue(self.plain.is_staff and self.plain.is_superuser)
        self.plain.profile.role = Profile.USER
        self.plain.profile.save()
        self.plain.refresh_from_db()
        self.assertFalse(self.plain.is_staff or self.plain.is_superuser)


class JwtAuthTests(ApiTestCase):
    def login(self, username='admin', password='s3cret-pass-1', client=None):
        return (client or self.anon).post('/api/auth/login/', {'username': username, 'password': password}, format='json')

    def test_login_devuelve_access_y_cookie_refresh_httponly(self):
        r = self.login()
        self.assertEqual(r.status_code, 200)
        self.assertIn('access', r.data)
        self.assertNotIn('refresh', r.data)  # el refresh nunca viaja en el cuerpo
        self.assertEqual(r.data['user']['role'], 'admin')
        cookie = r.cookies[REFRESH]
        self.assertTrue(cookie['httponly'])
        self.assertEqual(cookie['samesite'], 'Strict')
        self.assertEqual(cookie['path'], '/facialy/api/auth/')

    def test_access_token_autentica_la_api(self):
        token = self.login().data['access']
        c = APIClient()
        self.assertEqual(c.get('/api/employees/').status_code, 401)
        c.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        self.assertEqual(c.get('/api/employees/').status_code, 200)
        self.assertEqual(c.get('/api/auth/me/').data['username'], 'admin')

    def test_login_por_email(self):
        r = self.login('PLAIN@example.com')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['user']['role'], 'user')

    def test_login_incorrecto_y_auditado(self):
        r = self.login(password='mala')
        self.assertEqual(r.status_code, 400)
        self.assertTrue(AuditLog.objects.filter(action='login_failed', actor_label='admin').exists())

    def test_bloqueo_tras_varios_fallos(self):
        for _ in range(5):
            self.login('victima', 'x')
        r = self.login('victima', 'x')
        self.assertEqual((r.status_code, r.data['code']), (429, 'locked'))
        # y el bloqueo es por cuenta: otra cuenta sigue entrando
        self.assertEqual(self.login().status_code, 200)

    def test_cuenta_inactiva_no_entra(self):
        self.admin.is_active = False
        self.admin.save()
        self.assertEqual(self.login().status_code, 400)

    def test_refresh_rota_el_token_y_revoca_el_anterior(self):
        r = self.login()
        old = r.cookies[REFRESH].value
        c = APIClient()
        c.cookies[REFRESH] = old
        r2 = c.post('/api/auth/refresh/')
        self.assertEqual(r2.status_code, 200)
        self.assertIn('access', r2.data)
        new = r2.cookies[REFRESH].value
        self.assertNotEqual(old, new)
        # reutilizar el refresh anterior (robo/replay) falla
        c2 = APIClient()
        c2.cookies[REFRESH] = old
        self.assertEqual(c2.post('/api/auth/refresh/').status_code, 401)

    def test_refresh_sin_cookie_o_basura(self):
        self.assertEqual(self.anon.post('/api/auth/refresh/').status_code, 401)
        c = APIClient()
        c.cookies[REFRESH] = 'no.es.un.jwt'
        self.assertEqual(c.post('/api/auth/refresh/').status_code, 401)

    def test_logout_revoca_el_refresh(self):
        r = self.login()
        token = r.cookies[REFRESH].value
        c = APIClient()
        c.cookies[REFRESH] = token
        self.assertEqual(c.post('/api/auth/logout/').status_code, 204)
        c2 = APIClient()
        c2.cookies[REFRESH] = token
        self.assertEqual(c2.post('/api/auth/refresh/').status_code, 401)

    def test_usuario_desactivado_no_puede_refrescar(self):
        r = self.login()
        self.admin.is_active = False
        self.admin.save()
        c = APIClient()
        c.cookies[REFRESH] = r.cookies[REFRESH].value
        self.assertEqual(c.post('/api/auth/refresh/').status_code, 401)

    def test_access_token_caducado_o_manipulado(self):
        c = APIClient()
        c.credentials(HTTP_AUTHORIZATION='Bearer ' + self.login().data['access'][:-3] + 'abc')
        self.assertEqual(c.get('/api/employees/').status_code, 401)

    @override_settings(GUEST_LOGIN_ENABLED=False)
    def test_guest_desactivado(self):
        self.assertEqual(self.anon.post('/api/auth/guest/').status_code, 403)

    @override_settings(GUEST_LOGIN_ENABLED=True)
    def test_guest_activado_es_viewer_sin_password(self):
        r = self.anon.post('/api/auth/guest/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['user']['role'], 'viewer')
        self.assertFalse(User.objects.get(username='invitado').has_usable_password())
        # no se puede entrar al invitado con contraseña
        self.assertEqual(self.login('invitado', '').status_code, 400)

    def test_me_requiere_autenticacion(self):
        self.assertEqual(self.anon.get('/api/auth/me/').status_code, 401)


@override_settings(REGISTRATION_ENABLED=True)
class RegisterTests(ApiTestCase):
    payload = {'email': 'Nueva@Example.com', 'password': 'Una-clave-larga-9', 'first_name': 'Nora', 'last_name': 'Gil', 'accept_terms': True}

    def test_registro_crea_usuario_con_ficha_pendiente_y_sesion(self):
        r = self.anon.post('/api/auth/register/', self.payload, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data['user']['role'], 'user')
        self.assertIn(REFRESH, r.cookies)
        user = User.objects.get(username='nueva@example.com')
        self.assertEqual(user.profile.role, Profile.USER)
        self.assertFalse(user.is_staff)
        emp = user.employee
        self.assertFalse(emp.is_active)  # pendiente de aprobación
        self.assertEqual(emp.first_name, 'Nora')
        self.assertTrue(AuditLog.objects.filter(action='register').exists())

    def test_validaciones(self):
        post = lambda **kw: self.anon.post('/api/auth/register/', {**self.payload, **kw}, format='json')
        self.assertIn('email', post(email='no-es-email').data)
        self.assertIn('password', post(password='123').data)
        self.assertIn('password', post(password='password').data)  # común
        self.assertIn('first_name', post(first_name=' ').data)
        self.assertIn('accept_terms', post(accept_terms=False).data)

    def test_no_se_puede_registrar_como_admin(self):
        r = self.anon.post('/api/auth/register/', {**self.payload, 'role': 'superadmin', 'is_staff': True, 'is_superuser': True}, format='json')
        self.assertEqual(r.data['user']['role'], 'user')
        user = User.objects.get(username='nueva@example.com')
        self.assertFalse(user.is_staff or user.is_superuser)

    def test_email_duplicado_mensaje_generico(self):
        self.anon.post('/api/auth/register/', self.payload, format='json')
        r = self.anon.post('/api/auth/register/', self.payload, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertNotIn('existe', str(r.data).lower())

    def test_no_se_apropia_de_la_ficha_de_un_empleado_existente(self):
        Employee.objects.create(first_name='Real', email='nueva@example.com')
        r = self.anon.post('/api/auth/register/', self.payload, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertFalse(User.objects.filter(username='nueva@example.com').exists())

    @override_settings(REGISTRATION_ENABLED=False)
    def test_registro_desactivable(self):
        self.assertEqual(self.anon.post('/api/auth/register/', self.payload, format='json').status_code, 403)


class PermissionMatrixTests(ApiTestCase):
    def status_for(self, client, method, url, **kw):
        return getattr(client, method)(url, **kw).status_code

    def test_api_cerrada_sin_credenciales(self):
        for url in ('/api/employees/', '/api/access-logs/', '/api/dashboard/', '/api/access-logs/export/',
                    '/api/users/', '/api/audit/', '/api/me/profile/'):
            self.assertEqual(self.anon.get(url).status_code, 401, url)
        self.assertEqual(self.anon.post('/api/kiosk/recognize/', {}, format='json').status_code, 401)

    def test_usuario_normal_no_ve_datos_de_la_empresa(self):
        for url in ('/api/employees/', '/api/access-logs/', '/api/dashboard/', '/api/users/', '/api/audit/'):
            self.assertEqual(self.status_for(self.user_api, 'get', url), 403, url)
        self.assertEqual(self.user_api.post('/api/kiosk/recognize/', {}, format='json').status_code, 403)

    def test_admin_no_gestiona_cuentas_ni_auditoria(self):
        self.assertEqual(self.staff.get('/api/users/').status_code, 403)
        self.assertEqual(self.staff.get('/api/audit/').status_code, 403)
        self.assertEqual(self.staff.get('/api/employees/').status_code, 200)
        self.assertEqual(self.staff.get('/api/dashboard/').status_code, 200)

    def test_superadmin_lo_puede_todo(self):
        for url in ('/api/employees/', '/api/users/', '/api/audit/', '/api/dashboard/'):
            self.assertEqual(self.root.get(url).status_code, 200, url)

    def test_invitado_solo_lee(self):
        emp = Employee.objects.create(first_name='Demo', is_demo=True)
        self.assertEqual(self.viewer.get('/api/employees/').status_code, 200)
        self.assertEqual(self.viewer.get('/api/dashboard/').status_code, 200)
        self.assertEqual(self.viewer.post('/api/employees/', {'first_name': 'X'}, format='json').status_code, 403)
        self.assertEqual(self.viewer.delete(f'/api/employees/{emp.id}/').status_code, 403)
        self.assertEqual(self.viewer.post(f'/api/employees/{emp.id}/enroll/start/').status_code, 403)
        self.assertEqual(self.viewer.post('/api/kiosk/recognize/', {}, format='json').status_code, 403)
        self.assertEqual(self.viewer.get('/api/users/').status_code, 403)
        self.assertEqual(self.viewer.get('/api/me/profile/').status_code, 403)

    def test_invitado_solo_ve_datos_demo(self):
        Employee.objects.create(first_name='Demo', is_demo=True)
        real = Employee.objects.create(first_name='Real', email='real@empresa.com')
        AccessLog.objects.create(result='GRANTED', is_demo=True)
        AccessLog.objects.create(employee=real, result='GRANTED')
        emps = self.viewer.get('/api/employees/').data['results']
        self.assertEqual([e['first_name'] for e in emps], ['Demo'])
        self.assertNotIn('real@empresa.com', str(self.viewer.get('/api/employees/', {'search': 'real'}).data))
        self.assertEqual(self.viewer.get('/api/access-logs/').data['count'], 1)
        self.assertEqual(self.viewer.get(f'/api/employees/{real.id}/').status_code, 404)
        self.assertEqual(self.viewer.get('/api/dashboard/').data['accesses_today'], 1)
        self.assertEqual(self.staff.get('/api/access-logs/').data['count'], 2)
        csv_body = b''.join(self.viewer.get('/api/access-logs/export/').streaming_content).decode()
        self.assertEqual(len(csv_body.strip().splitlines()), 2)

    def test_health_es_publico(self):
        r = self.anon.get('/api/health/')
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data['database'])


class UserManagementTests(ApiTestCase):
    def test_listado_excluye_al_invitado(self):
        names = {u['username'] for u in self.root.get('/api/users/').data['results']}
        self.assertIn('plain@example.com', names)
        self.assertNotIn('guest', names)

    def test_cambio_de_rol_aplica_de_inmediato_y_se_audita(self):
        r = self.root.patch(f'/api/users/{self.plain.id}/', {'role': 'admin'}, format='json')
        self.assertEqual((r.status_code, r.data['role']), (200, 'admin'))
        self.assertEqual(self.client_for(User.objects.get(pk=self.plain.pk)).get('/api/employees/').status_code, 200)
        self.assertTrue(AuditLog.objects.filter(action='role_changed', actor_label='root').exists())

    def test_no_se_puede_asignar_rol_invitado_ni_invalido(self):
        for role in ('viewer', 'dios'):
            self.assertEqual(self.root.patch(f'/api/users/{self.plain.id}/', {'role': role}, format='json').status_code, 400)

    def test_no_puede_modificarse_ni_borrarse_a_si_mismo(self):
        self.assertEqual(self.root.patch(f'/api/users/{self.superadmin.id}/', {'role': 'user'}, format='json').status_code, 400)
        self.assertEqual(self.root.delete(f'/api/users/{self.superadmin.id}/').status_code, 400)
        self.superadmin.refresh_from_db()
        self.assertTrue(self.superadmin.is_superuser)

    def test_desactivar_usuario_corta_su_acceso(self):
        token = self.anon.post('/api/auth/login/', {'username': 'admin', 'password': 's3cret-pass-1'}, format='json').data['access']
        self.root.patch(f'/api/users/{self.admin.id}/', {'is_active': False}, format='json')
        c = APIClient()
        c.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        self.assertEqual(c.get('/api/employees/').status_code, 401)

    def test_borrar_usuario_elimina_su_ficha_y_biometria(self):
        emp = Employee.objects.create(first_name='P', user=self.plain, face_enrolled_at=timezone.now())
        FaceTemplate.objects.create(employee=emp, embedding=b'\x00' * 512)
        self.assertEqual(self.root.delete(f'/api/users/{self.plain.id}/').status_code, 204)
        self.assertEqual((Employee.objects.count(), FaceTemplate.objects.count()), (0, 0))

    def test_auditoria_filtrable(self):
        AuditLog.objects.create(action='login_ok', actor_label='x')
        AuditLog.objects.create(action='role_changed', actor_label='y')
        r = self.root.get('/api/audit/', {'action': 'role_changed'})
        self.assertEqual(r.data['count'], 1)


class AddUserCommandTests(TestCase):
    def run_cmd(self, *args):
        from django.core.management import call_command
        call_command('add_user', *args, stdout=__import__('io').StringIO())

    def test_crea_superadmin_con_ficha(self):
        self.run_cmd('--email', 'Yo@Example.com', '--role', 'superadmin', '--name', 'Yo Mismo', '--password', 'Clave-muy-larga-7')
        u = User.objects.get(username='yo@example.com')
        self.assertTrue(u.is_superuser and u.is_staff)
        self.assertEqual(u.profile.role, 'superadmin')
        self.assertTrue(u.check_password('Clave-muy-larga-7'))
        self.assertEqual(u.employee.last_name, 'Mismo')

    def test_es_idempotente_y_actualiza_rol(self):
        self.run_cmd('--email', 'a@b.com', '--role', 'user', '--password', 'Clave-muy-larga-7')
        self.run_cmd('--email', 'a@b.com', '--role', 'admin', '--password', 'Otra-clave-larga-8')
        self.assertEqual(User.objects.filter(username='a@b.com').count(), 1)
        self.assertEqual(User.objects.get(username='a@b.com').profile.role, 'admin')

    def test_rechaza_contrasena_debil(self):
        from django.core.management.base import CommandError
        with self.assertRaises(CommandError):
            self.run_cmd('--email', 'a@b.com', '--password', '123')


# ── Empleados ─────────────────────────────────────────────────────────────────

class EmployeeAPITests(ApiTestCase):
    url = '/api/employees/'

    def test_crud(self):
        r = self.staff.post(self.url, {'first_name': 'Roberto', 'department': 'IT'}, format='json')
        self.assertEqual(r.status_code, 201)
        emp_id = r.data['id']
        self.assertFalse(r.data['has_face'])

        r = self.staff.patch(f'{self.url}{emp_id}/', {'department': 'Ventas'}, format='json')
        self.assertEqual(r.data['department'], 'Ventas')
        self.assertEqual(r.data['first_name'], 'Roberto')

        self.assertEqual(self.staff.delete(f'{self.url}{emp_id}/').status_code, 204)
        self.assertEqual(Employee.objects.count(), 0)

    def test_varios_empleados_sin_email_no_chocan(self):
        for name in ('A', 'B', 'C'):
            r = self.staff.post(self.url, {'first_name': name, 'email': ''}, format='json')
            self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(Employee.objects.filter(email__isnull=True).count(), 3)

    def test_email_duplicado_da_400(self):
        self.staff.post(self.url, {'first_name': 'A', 'email': 'a@x.com'}, format='json')
        r = self.staff.post(self.url, {'first_name': 'B', 'email': 'a@x.com'}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_nombre_obligatorio_y_horario_coherente(self):
        self.assertEqual(self.staff.post(self.url, {'first_name': '  '}, format='json').status_code, 400)
        r = self.staff.post(self.url, {'first_name': 'A', 'schedule_entry': '09:00'}, format='json')
        self.assertEqual(r.status_code, 400)
        r = self.staff.post(self.url, {'first_name': 'A', 'schedule_entry': '09:00', 'schedule_exit': '17:00'}, format='json')
        self.assertEqual(r.status_code, 201)

    def test_listado_paginado_y_filtros(self):
        Employee.objects.create(first_name='Ana', department='IT')
        Employee.objects.create(first_name='Luis', department='RRHH', is_active=False)
        r = self.staff.get(self.url)
        self.assertEqual(r.data['count'], 2)
        self.assertEqual(self.staff.get(self.url, {'search': 'rrhh'}).data['count'], 1)
        self.assertEqual(self.staff.get(self.url, {'is_active': 'false'}).data['results'][0]['first_name'], 'Luis')
        self.assertEqual(self.staff.get(self.url, {'has_face': 'true'}).data['count'], 0)


# ── Registros y dashboard ─────────────────────────────────────────────────────

class AccessLogTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.ana = Employee.objects.create(first_name='Ana', last_name='López', department='IT')
        self.evil = Employee.objects.create(first_name='=HYPERLINK("x")', department='+cmd')
        AccessLog.objects.create(employee=self.ana, result='GRANTED', confidence=0.8)
        AccessLog.objects.create(employee=self.ana, result='DENIED', reason='OUTSIDE_SCHEDULE', confidence=0.7)
        AccessLog.objects.create(employee=self.evil, result='GRANTED', confidence=0.6)
        AccessLog.objects.create(result='UNKNOWN', confidence=0.1)

    def test_solo_lectura(self):
        self.assertEqual(self.staff.post('/api/access-logs/', {'result': 'GRANTED'}, format='json').status_code, 405)

    def test_filtros(self):
        get = lambda **p: self.staff.get('/api/access-logs/', p).data['count']
        self.assertEqual(get(), 4)
        self.assertEqual(get(result='GRANTED'), 2)
        self.assertEqual(get(result='GRANTED,DENIED'), 3)
        self.assertEqual(get(employee=self.ana.id), 2)
        self.assertEqual(get(q='lópez'), 2)
        self.assertEqual(get(date_from='2999-01-01'), 0)
        self.assertEqual(get(date_to=timezone.localdate().isoformat()), 4)

    def test_serializa_nombre_de_desconocido(self):
        names = {r['employee_name'] for r in self.staff.get('/api/access-logs/').data['results']}
        self.assertIn('Desconocido', names)

    def test_export_csv_neutraliza_formulas(self):
        r = self.staff.get('/api/access-logs/export/')
        self.assertEqual(r.status_code, 200)
        body = b''.join(r.streaming_content).decode('utf-8-sig')
        lines = body.strip().splitlines()
        self.assertEqual(len(lines), 5)
        self.assertIn("'=HYPERLINK", body)
        self.assertIn("'+cmd", body)
        self.assertNotIn(',=HYPERLINK', body)


class DashboardTests(ApiTestCase):
    def test_vacio(self):
        d = self.staff.get('/api/dashboard/').data
        self.assertEqual((d['accesses_today'], d['total_employees']), (0, 0))
        self.assertEqual(len(d['last_7_days']), 7)
        self.assertEqual(len(d['by_hour']), 24)

    def test_cuenta_hoy_y_ranking(self):
        ana = Employee.objects.create(first_name='Ana')
        Employee.objects.create(first_name='Inactivo', is_active=False)
        for _ in range(3):
            AccessLog.objects.create(employee=ana, result='GRANTED')
        AccessLog.objects.create(employee=ana, result='DENIED', reason='OUTSIDE_SCHEDULE')
        AccessLog.objects.create(result='UNKNOWN')
        d = self.staff.get('/api/dashboard/').data
        self.assertEqual((d['accesses_today'], d['granted_today'], d['denied_today'], d['unknown_today']), (5, 3, 1, 1))
        self.assertEqual(d['total_employees'], 1)
        self.assertEqual(d['last_7_days'][-1]['granted'], 3)
        self.assertEqual(d['top_employees'][0]['name'], 'Ana')
        self.assertEqual(d['top_employees'][0]['count'], 3)
        self.assertEqual(sum(d['by_hour']), 5)
        self.assertEqual(len(d['recent_logs']), 5)


# ── Demo pública (requiere los modelos ONNX) ──────────────────────────────────

@needs_models
class DemoFlowTests(ApiTestCase):
    def start(self, name='María'):
        return self.anon.post('/api/demo/start/', {'name': name}, format='json').data['session_id']

    def capture_all(self, sid, url='/api/demo/capture/', extra=None):
        total = 0
        for _ in range(40):
            payload = {'session_id': sid, 'frame': frame_b64(), **(extra or {})}
            r = self.anon.post(url, payload, format='json')
            self.assertEqual(r.status_code, 200, r.data)
            total = r.data['count']
            if total >= r.data['total']:
                break
        return total

    def test_flujo_completo_reconoce_y_no_toca_la_bd(self):
        sid = self.start()
        self.assertEqual(self.capture_all(sid), 30)

        for kwargs in ({}, {'flip': True, 'dim': True}):
            r = self.anon.post('/api/demo/recognize/', {'session_id': sid, 'frame': frame_b64(**kwargs)}, format='json')
            self.assertEqual(len(r.data['results']), 1)
            res = r.data['results'][0]
            self.assertTrue(res['known'], res)
            self.assertEqual(res['name'], 'María')
            self.assertEqual(len(res['box']), 4)

        self.assertEqual(Employee.objects.count(), 0)
        self.assertEqual(AccessLog.objects.count(), 0)
        self.assertEqual(self.anon.post('/api/demo/end/', {'session_id': sid}, format='json').status_code, 200)
        self.assertEqual(sessions.active_sessions(), 0)

    def test_sesiones_aisladas(self):
        a, b = self.start('Ana'), self.start('Beto')
        self.capture_all(a)
        r = self.anon.post('/api/demo/recognize/', {'session_id': b, 'frame': frame_b64()}, format='json')
        self.assertFalse(r.data['results'][0]['known'])  # b no tiene plantillas

    def test_sin_cara_no_cuenta(self):
        sid = self.start()
        r = self.anon.post('/api/demo/capture/', {'session_id': sid, 'frame': noise_frame()}, format='json')
        self.assertEqual((r.data['count'], r.data['face_detected'], r.data['hint']), (0, False, 'no_face'))

    def test_frame_invalido_no_rompe(self):
        sid = self.start()
        r = self.anon.post('/api/demo/capture/', {'session_id': sid, 'frame': 'basura'}, format='json')
        self.assertEqual((r.status_code, r.data['hint']), (200, 'bad_frame'))
        r = self.anon.post('/api/demo/recognize/', {'session_id': sid}, format='json')
        self.assertEqual(r.data['results'], [])

    def test_sesion_inexistente_o_caducada(self):
        for url in ('/api/demo/capture/', '/api/demo/recognize/'):
            r = self.anon.post(url, {'session_id': 'nope', 'frame': frame_b64()}, format='json')
            self.assertEqual((r.status_code, r.data['code']), (404, 'session_expired'))

    @override_settings(CAPTURE_SESSION_TTL_SECONDS=0)
    def test_sesion_caduca_por_ttl(self):
        sid = self.start()
        time_module.sleep(0.01)
        r = self.anon.post('/api/demo/capture/', {'session_id': sid, 'frame': frame_b64()}, format='json')
        self.assertEqual(r.status_code, 404)

    @override_settings(CAPTURE_SESSION_MAX=2)
    def test_limite_de_sesiones(self):
        self.start(), self.start()
        r = self.anon.post('/api/demo/start/', {'name': 'X'}, format='json')
        self.assertEqual((r.status_code, r.data['code']), (503, 'too_many_sessions'))

    def test_nombre_obligatorio_y_limpio(self):
        self.assertEqual(self.anon.post('/api/demo/start/', {'name': '   '}, format='json').status_code, 400)
        r = self.anon.post('/api/demo/start/', {'name': '../../etc/passwd' + 'a' * 100}, format='json')
        self.assertLessEqual(len(r.data['name']), 60)

    def test_demo_es_publico_aunque_el_token_sea_invalido(self):
        self.anon.credentials(HTTP_AUTHORIZATION='Token caducado')
        self.assertEqual(self.anon.post('/api/demo/start/', {'name': 'Ana'}, format='json').status_code, 200)


# ── Registro de empleados + kiosco ────────────────────────────────────────────

@needs_models
class EnrollAndKioskTests(ApiTestCase):
    def enroll(self, emp):
        base = f'/api/employees/{emp.id}/enroll/'
        sid = self.staff.post(base + 'start/').data['session_id']
        for _ in range(30):
            r = self.staff.post(base + 'capture/', {'session_id': sid, 'frame': frame_b64()}, format='json')
            self.assertEqual(r.status_code, 200, r.data)
        return self.staff.post(base + 'finish/', {'session_id': sid}, format='json')

    def kiosk(self, **kw):
        r = self.staff.post('/api/kiosk/recognize/', {'frame': frame_b64(**kw)}, format='json')
        self.assertEqual(r.status_code, 200)
        return r.data['results']

    def test_registro_guarda_solo_embeddings(self):
        emp = Employee.objects.create(first_name='Ana')
        r = self.enroll(emp)
        self.assertEqual(r.status_code, 200, r.data)
        self.assertTrue(r.data['has_face'])
        self.assertEqual(emp.templates.count(), 12)
        self.assertEqual(len(emp.templates.first().embedding), 128 * 4)

    def test_finish_exige_capturas_suficientes(self):
        emp = Employee.objects.create(first_name='Ana')
        sid = self.staff.post(f'/api/employees/{emp.id}/enroll/start/').data['session_id']
        r = self.staff.post(f'/api/employees/{emp.id}/enroll/finish/', {'session_id': sid}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_sesion_de_otro_empleado_no_vale(self):
        a, b = Employee.objects.create(first_name='A'), Employee.objects.create(first_name='B')
        sid = self.staff.post(f'/api/employees/{a.id}/enroll/start/').data['session_id']
        r = self.staff.post(f'/api/employees/{b.id}/enroll/capture/', {'session_id': sid, 'frame': frame_b64()}, format='json')
        self.assertEqual(r.status_code, 404)

    def test_kiosco_concede_y_registra_con_cooldown(self):
        emp = Employee.objects.create(first_name='Ana', last_name='López', department='IT')
        self.enroll(emp)
        res = self.kiosk(flip=True, dim=True)
        self.assertEqual(len(res), 1)
        self.assertEqual((res[0]['result'], res[0]['employee_id'], res[0]['name']), ('GRANTED', emp.id, 'Ana López'))
        self.assertTrue(res[0]['logged'])
        self.assertEqual(AccessLog.objects.get().employee, emp)

        again = self.kiosk()
        self.assertEqual(again[0]['result'], 'GRANTED')
        self.assertFalse(again[0]['logged'])  # cooldown
        self.assertEqual(AccessLog.objects.count(), 1)

    def test_kiosco_deniega_inactivo_y_fuera_de_horario(self):
        emp = Employee.objects.create(first_name='Ana')
        self.enroll(emp)
        emp.is_active = False
        emp.save()
        self.assertEqual(self.kiosk()[0]['reason'], 'INACTIVE')

        now = timezone.localtime()
        emp.is_active = True
        emp.schedule_entry = (now + timedelta(hours=4)).time().replace(microsecond=0)
        emp.schedule_exit = (now + timedelta(hours=5)).time().replace(microsecond=0)
        emp.save()
        res = self.kiosk()
        self.assertEqual((res[0]['result'], res[0]['reason']), ('DENIED', 'OUTSIDE_SCHEDULE'))
        self.assertEqual(AccessLog.objects.filter(result='DENIED').count(), 2)

    def test_kiosco_desconocido(self):
        other = Employee.objects.create(first_name='Otro', face_enrolled_at=timezone.now())
        vec = np.random.default_rng(3).normal(size=128).astype(np.float32)
        t = FaceTemplate(employee=other)
        t.set_vector(vec / np.linalg.norm(vec))
        t.save()
        res = self.kiosk()
        self.assertEqual((res[0]['result'], res[0]['employee_id']), ('UNKNOWN', None))
        self.assertEqual(AccessLog.objects.get().result, 'UNKNOWN')

    def test_borrar_rostro_elimina_los_datos_biometricos(self):
        emp = Employee.objects.create(first_name='Ana')
        self.enroll(emp)
        r = self.staff.delete(f'/api/employees/{emp.id}/face/')
        self.assertFalse(r.data['has_face'])
        self.assertEqual(FaceTemplate.objects.count(), 0)
        self.assertEqual(self.kiosk()[0]['result'], 'UNKNOWN')

    def test_borrar_empleado_lo_saca_del_indice(self):
        emp = Employee.objects.create(first_name='Ana')
        self.enroll(emp)
        self.assertEqual(self.kiosk()[0]['result'], 'GRANTED')
        emp.delete()
        self.assertEqual(self.kiosk()[0]['result'], 'UNKNOWN')

    def test_varios_empleados_conviven(self):
        """Regresión: antes cada registro sobrescribía el modelo y solo se reconocía al último."""
        ana = Employee.objects.create(first_name='Ana')
        self.enroll(ana)
        # segundo empleado con un rostro distinto (vector sintético)
        luis = Employee.objects.create(first_name='Luis', face_enrolled_at=timezone.now())
        vec = np.random.default_rng(9).normal(size=128).astype(np.float32)
        t = FaceTemplate(employee=luis)
        t.set_vector(vec / np.linalg.norm(vec))
        t.save()
        self.assertEqual(self.kiosk()[0]['employee_id'], ana.id)
        self.assertEqual(FaceTemplate.objects.filter(employee=ana).count(), 12)

    def test_kiosco_ignora_frames_sin_cara(self):
        r = self.staff.post('/api/kiosk/recognize/', {'frame': noise_frame()}, format='json')
        self.assertEqual(r.data['results'], [])
        self.assertEqual(AccessLog.objects.count(), 0)


@needs_models
class MyProfileTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.me = Employee.objects.create(first_name='Plain', user=self.plain, email='plain@example.com', is_active=False)

    def enroll_me(self):
        sid = self.user_api.post('/api/me/enroll/start/').data['session_id']
        for _ in range(30):
            self.user_api.post('/api/me/enroll/capture/', {'session_id': sid, 'frame': frame_b64()}, format='json')
        return self.user_api.post('/api/me/enroll/finish/', {'session_id': sid}, format='json')

    def test_perfil(self):
        r = self.user_api.get('/api/me/profile/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['employee']['first_name'], 'Plain')
        self.assertTrue(r.data['employee']['pending'])

    def test_registrar_mi_rostro_y_verificar(self):
        r = self.enroll_me()
        self.assertEqual(r.status_code, 200, r.data)
        self.assertTrue(r.data['has_face'])
        v = self.user_api.post('/api/me/verify/', {'frame': frame_b64(flip=True, dim=True)}, format='json').data
        self.assertTrue(v['verified'], v)
        # cuenta pendiente: identidad verificada pero acceso denegado por inactiva
        self.assertEqual(v['access'], {'result': 'DENIED', 'reason': 'INACTIVE'})
        self.assertTrue(AuditLog.objects.filter(action='face_enrolled').exists())

    def test_verificacion_concede_a_cuenta_aprobada(self):
        self.enroll_me()
        self.me.is_active = True
        self.me.save()
        v = self.user_api.post('/api/me/verify/', {'frame': frame_b64()}, format='json').data
        self.assertEqual(v['access']['result'], 'GRANTED')
        self.assertEqual(AccessLog.objects.filter(employee=self.me, result='GRANTED').count(), 1)

    def test_verificacion_es_1_a_1_no_acepta_rostro_ajeno(self):
        other = Employee.objects.create(first_name='Otro')
        vec = np.random.default_rng(5).normal(size=128).astype(np.float32)
        t = FaceTemplate(employee=self.me)
        t.set_vector(vec / np.linalg.norm(vec))
        t.save()
        v = self.user_api.post('/api/me/verify/', {'frame': frame_b64()}, format='json').data
        self.assertFalse(v['verified'])
        self.assertEqual(AccessLog.objects.count(), 0)
        del other

    def test_sin_rostro_registrado(self):
        v = self.user_api.post('/api/me/verify/', {'frame': frame_b64()}, format='json').data
        self.assertFalse(v['enrolled'])

    def test_borrar_mi_rostro(self):
        self.enroll_me()
        r = self.user_api.delete('/api/me/face/')
        self.assertFalse(r.data['has_face'])
        self.assertEqual(FaceTemplate.objects.count(), 0)

    def test_borrar_mi_cuenta_elimina_todo(self):
        self.enroll_me()
        self.assertEqual(self.user_api.delete('/api/me/profile/').status_code, 204)
        self.assertFalse(User.objects.filter(pk=self.plain.pk).exists())
        self.assertEqual((Employee.objects.count(), FaceTemplate.objects.count()), (0, 0))

    def test_un_admin_no_se_autoelimina(self):
        Employee.objects.create(first_name='Adm', user=self.admin)
        self.assertEqual(self.staff.delete('/api/me/profile/').status_code, 403)

    def test_un_usuario_no_puede_registrar_el_rostro_de_otro(self):
        other = Employee.objects.create(first_name='Otro')
        self.assertEqual(self.user_api.post(f'/api/employees/{other.id}/enroll/start/').status_code, 403)

    def test_cuenta_sin_ficha_no_usa_mi_perfil(self):
        self.me.delete()
        fresh = self.client_for(User.objects.get(pk=self.plain.pk))
        self.assertEqual(fresh.get('/api/me/profile/').status_code, 403)

    def test_kiosco_no_reconoce_a_cuentas_demo(self):
        demo = Employee.objects.create(first_name='Demo', is_demo=True, face_enrolled_at=timezone.now())
        self.enroll_me()
        FaceTemplate.objects.filter(employee=self.me).update(employee=demo)  # plantilla real "disfrazada" de demo
        access.index._fingerprint = None
        r = self.staff.post('/api/kiosk/recognize/', {'frame': frame_b64()}, format='json')
        self.assertEqual(r.data['results'][0]['result'], 'UNKNOWN')
