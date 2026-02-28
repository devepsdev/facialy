from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from .models import Employee, AccessLog


class EmployeeModelTests(TestCase):
    """Tests para el modelo Employee."""

    def test_crear_employee_con_campos_obligatorios(self):
        """Test: crear un empleado solo con first_name (campo obligatorio)."""
        emp = Employee.objects.create(first_name="Juan")
        self.assertEqual(emp.first_name, "Juan")
        self.assertEqual(emp.last_name, "")
        self.assertIsNone(emp.email)
        self.assertEqual(emp.department, "")
        self.assertIsNone(emp.schedule_entry)
        self.assertIsNone(emp.schedule_exit)
        self.assertTrue(emp.is_active)
        self.assertIsNotNone(emp.created_at)

    def test_crear_employee_con_todos_los_campos(self):
        """Test: crear un empleado con todos los campos."""
        emp = Employee.objects.create(
            first_name="María",
            last_name="García",
            email="maria@example.com",
            department="Ventas",
            is_active=True,
        )
        self.assertEqual(emp.first_name, "María")
        self.assertEqual(emp.last_name, "García")
        self.assertEqual(emp.email, "maria@example.com")
        self.assertEqual(emp.department, "Ventas")
        self.assertTrue(emp.is_active)

    def test_email_unico(self):
        """Test: el email debe ser único."""
        Employee.objects.create(first_name="Juan", email="juan@example.com")
        with self.assertRaises(Exception):
            Employee.objects.create(first_name="José", email="juan@example.com")

    def test_str_representation(self):
        """Test: verificar la representación string del modelo."""
        emp = Employee.objects.create(first_name="Carlos", last_name="López")
        self.assertEqual(str(emp), "Carlos López")


class AccessLogModelTests(TestCase):
    """Tests para el modelo AccessLog."""

    def test_crear_access_log_con_employee(self):
        """Test: crear un log de acceso asociado a un empleado."""
        emp = Employee.objects.create(first_name="Ana")
        log = AccessLog.objects.create(
            employee=emp,
            result="GRANTED",
            confidence=3500.0,
        )
        self.assertEqual(log.employee, emp)
        self.assertEqual(log.result, "GRANTED")
        self.assertEqual(log.confidence, 3500.0)
        self.assertIsNotNone(log.timestamp)

    def test_crear_access_log_sin_employee(self):
        """Test: crear un log de acceso sin empleado (para rostros desconocidos)."""
        log = AccessLog.objects.create(
            employee=None,
            result="UNKNOWN",
            confidence=15000.0,
        )
        self.assertIsNone(log.employee)
        self.assertEqual(log.result, "UNKNOWN")
        self.assertEqual(log.confidence, 15000.0)

    def test_access_log_result_choices(self):
        """Test: verificar que solo se aceptan valores válidos en result."""
        emp = Employee.objects.create(first_name="Pedro")

        # Estos deben funcionar
        log1 = AccessLog.objects.create(employee=emp, result="GRANTED")
        log2 = AccessLog.objects.create(employee=emp, result="DENIED")
        log3 = AccessLog.objects.create(employee=emp, result="UNKNOWN")

        self.assertEqual(log1.result, "GRANTED")
        self.assertEqual(log2.result, "DENIED")
        self.assertEqual(log3.result, "UNKNOWN")

    def test_access_log_timestamp_auto(self):
        """Test: verificar que timestamp se asigna automáticamente."""
        log = AccessLog.objects.create(result="GRANTED")
        self.assertIsNotNone(log.timestamp)
        # Verificar que está cerca de ahora (dentro de 1 segundo)
        time_diff = abs((timezone.now() - log.timestamp).total_seconds())
        self.assertLess(time_diff, 1)


class EmployeeAPITests(TestCase):
    """Tests para los endpoints de Employee."""

    def setUp(self):
        self.client = APIClient()
        self.list_url = "/api/employees/"

    def test_listar_empleados_vacio(self):
        """Test: GET /api/employees/ cuando no hay empleados."""
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

    def test_listar_empleados_con_datos(self):
        """Test: GET /api/employees/ con empleados en la BD."""
        Employee.objects.create(first_name="Ana", last_name="López")
        Employee.objects.create(first_name="Luis", last_name="García")

        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        self.assertEqual(response.data[0]["first_name"], "Ana")
        self.assertEqual(response.data[1]["first_name"], "Luis")

    def test_crear_employee_via_api(self):
        """Test: POST /api/employees/ para crear un nuevo empleado."""
        data = {
            "first_name": "Roberto",
            "last_name": "Martínez",
            "email": "roberto@example.com",
            "department": "IT",
        }
        response = self.client.post(self.list_url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["first_name"], "Roberto")
        self.assertEqual(Employee.objects.count(), 1)

    def test_obtener_empleado_por_id(self):
        """Test: GET /api/employees/{id}/ para obtener un empleado específico."""
        emp = Employee.objects.create(first_name="Sofia", email="sofia@example.com")
        detail_url = f"{self.list_url}{emp.id}/"

        response = self.client.get(detail_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["first_name"], "Sofia")
        self.assertEqual(response.data["email"], "sofia@example.com")

    def test_actualizar_employee_parcial(self):
        """Test: PATCH /api/employees/{id}/ para actualizar un empleado."""
        emp = Employee.objects.create(first_name="Diego", department="Ventas")
        detail_url = f"{self.list_url}{emp.id}/"

        data = {"department": "Marketing"}
        response = self.client.patch(detail_url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        emp.refresh_from_db()
        self.assertEqual(emp.department, "Marketing")
        self.assertEqual(emp.first_name, "Diego")  # No cambió

    def test_eliminar_employee(self):
        """Test: DELETE /api/employees/{id}/ para eliminar un empleado."""
        emp = Employee.objects.create(first_name="Laura")
        detail_url = f"{self.list_url}{emp.id}/"

        response = self.client.delete(detail_url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Employee.objects.count(), 0)


class DashboardAPITests(TestCase):
    """Tests para el endpoint de Dashboard."""

    def setUp(self):
        self.client = APIClient()
        self.dashboard_url = "/api/dashboard/"

    def test_dashboard_endpoint_responde_200(self):
        """Test: GET /api/dashboard/ devuelve status 200."""
        response = self.client.get(self.dashboard_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_dashboard_tiene_campos_requeridos(self):
        """Test: GET /api/dashboard/ devuelve todas las métricas esperadas."""
        response = self.client.get(self.dashboard_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        expected_keys = {
            "total_employees",
            "accesses_today",
            "granted_today",
            "denied_today",
            "unknown_today",
            "recent_logs",
        }
        self.assertEqual(set(response.data.keys()), expected_keys)

    def test_dashboard_metricas_iniciales(self):
        """Test: verificar que las métricas son 0 cuando no hay datos."""
        response = self.client.get(self.dashboard_url)
        self.assertEqual(response.data["total_employees"], 0)
        self.assertEqual(response.data["accesses_today"], 0)
        self.assertEqual(response.data["granted_today"], 0)
        self.assertEqual(response.data["denied_today"], 0)
        self.assertEqual(response.data["unknown_today"], 0)
        self.assertEqual(response.data["recent_logs"], [])

    def test_dashboard_cuenta_empleados_activos(self):
        """Test: dashboard cuenta solo los empleados activos."""
        Employee.objects.create(first_name="Elena", is_active=True)
        Employee.objects.create(first_name="Francisco", is_active=True)
        Employee.objects.create(first_name="Graciela", is_active=False)

        response = self.client.get(self.dashboard_url)
        self.assertEqual(response.data["total_employees"], 2)

    def test_dashboard_cuenta_accesos_del_dia(self):
        """Test: dashboard solo cuenta accesos de hoy."""
        emp = Employee.objects.create(first_name="Héctor")

        # Crear logs de hoy y de ayer
        AccessLog.objects.create(
            employee=emp,
            result="GRANTED",
            timestamp=timezone.now(),
        )
        AccessLog.objects.create(
            employee=emp,
            result="GRANTED",
            timestamp=timezone.now() - timezone.timedelta(days=1),
        )

        response = self.client.get(self.dashboard_url)
        self.assertEqual(response.data["accesses_today"], 1)
        self.assertEqual(response.data["granted_today"], 1)


class CaptureFrameAPITests(TestCase):
    """Tests para el endpoint de captura de frames."""

    def setUp(self):
        self.client = APIClient()
        self.capture_url = "/api/capture-frame/"

    def test_capture_frame_sin_datos_devuelve_error(self):
        """Test: POST /api/capture-frame/ sin frame debe devolver error 400."""
        response = self.client.post(self.capture_url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)

    def test_capture_frame_sin_visitor_name_devuelve_error(self):
        """Test: POST /api/capture-frame/ sin visitor_name debe devolver error."""
        data = {"frame": "data:image/jpeg;base64,invaliddata"}
        response = self.client.post(self.capture_url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)

    def test_capture_frame_sin_frame_devuelve_error(self):
        """Test: POST /api/capture-frame/ sin frame pero con visitor_name devuelve error."""
        data = {"visitor_name": "Juan Pérez"}
        response = self.client.post(self.capture_url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)

    def test_capture_frame_con_frame_invalido(self):
        """Test: POST /api/capture-frame/ con base64 inválido devuelve response con face_detected=false."""
        data = {
            "visitor_name": "María",
            "frame": "data:image/jpeg;base64,notvalidbase64!!!",
        }
        response = self.client.post(self.capture_url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class CleanupAPITests(TestCase):
    """Tests para el endpoint de limpieza."""

    def setUp(self):
        self.client = APIClient()
        self.cleanup_url = "/api/cleanup/"

    def test_cleanup_devuelve_200(self):
        """Test: POST /api/cleanup/ devuelve status 200 y success=true."""
        response = self.client.post(self.cleanup_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data.get("success"))
        self.assertIn("message", response.data)

    def test_cleanup_sin_datos_no_falla(self):
        """Test: POST /api/cleanup/ no falla aunque no haya datos que limpiar."""
        # Llamar cleanup sin haber capturado nada
        response = self.client.post(self.cleanup_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Llamar de nuevo debe funcionar igual
        response2 = self.client.post(self.cleanup_url)
        self.assertEqual(response2.status_code, status.HTTP_200_OK)
