from django.db import models

class Employee(models.Model):
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email = models.EmailField(unique=True)
    department = models.CharField(max_length=100)
    schedule_entry = models.TimeField()
    schedule_exit = models.TimeField()
    profile_photo = models.ImageField(upload_to='profiles/', blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.first_name} {self.last_name}"


class AccessLog(models.Model):
    RESULT_CHOICES = [
        ('GRANTED', 'Granted'),
        ('DENIED', 'Denied'),
        ('UNKNOWN', 'Unknown'),
    ]

    employee = models.ForeignKey(Employee, on_delete=models.SET_NULL, null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    result = models.CharField(max_length=10, choices=RESULT_CHOICES)
    confidence = models.FloatField(default=0.0)

    def __str__(self):
        return f"{self.timestamp} - {self.result}"