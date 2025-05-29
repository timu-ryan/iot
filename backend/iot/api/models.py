from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
import uuid


class Company(models.Model):
    name = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email must be set')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', User.Role.SUPERUSER)

        if not extra_fields.get('is_staff'):
            raise ValueError('Superuser must have is_staff=True.')
        if not extra_fields.get('is_superuser'):
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(email, password, **extra_fields)


class User(AbstractUser):
    class Role(models.TextChoices):
        SUPERUSER = "SUPERUSER", "Superuser"
        MANAGER = "MANAGER", "Manager"
        EMPLOYEE = "EMPLOYEE", "Employee"

    role = models.CharField(max_length=10, choices=Role.choices, default=Role.EMPLOYEE)
    company = models.ForeignKey(Company, on_delete=models.SET_NULL, null=True, blank=True)
    telegram_id = models.CharField(max_length=64, null=True, blank=True)

    username = None
    email = models.EmailField(unique=True)
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    objects = UserManager()

    def __str__(self):
        return f"{self.email} ({self.role})"


class Controller(models.Model):
    company = models.ForeignKey(Company, on_delete=models.CASCADE)
    uuid = models.UUIDField(unique=True, default=uuid.uuid4)
    name = models.CharField(max_length=100)
    api_key = models.CharField(max_length=100, unique=True, blank=True)
    control_mode = models.CharField(
        max_length=10,
        choices=(("manual", "Manual"), ("auto", "Auto")),
        default="manual"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.company.name})"

    def save(self, *args, **kwargs):
        if not self.api_key:
            self.api_key = uuid.uuid4().hex
        super().save(*args, **kwargs)


class Sensor(models.Model):
    class SensorType(models.TextChoices):
        TEMPERATURE = "temperature", "Temperature"
        PRESSURE = "pressure", "Pressure"
        HUMIDITY = "humidity", "Humidity"

    uuid = models.UUIDField(unique=True, default=uuid.uuid4)
    controller = models.ForeignKey(Controller, on_delete=models.CASCADE, related_name='sensors')
    name = models.CharField(max_length=100)
    type = models.CharField(max_length=50, choices=SensorType.choices)
    description = models.TextField(blank=True, default='')

    critical_min = models.FloatField(null=True, blank=True)
    critical_max = models.FloatField(null=True, blank=True)

    def __str__(self):
        return f"{self.name} [{self.type}]"

    @property
    def company(self):
        return self.controller.company if self.controller else None


class Relay(models.Model):
    class RelayType(models.TextChoices):
        PUMP = "pump", "Pump"
        LIGHT = "light", "Light"
        FAN = "fan", "Fan"

    uuid = models.UUIDField(default=uuid.uuid4, unique=True)
    controller = models.ForeignKey(Controller, on_delete=models.CASCADE, related_name='relays')
    name = models.CharField(max_length=50)  # e.g. "pump1", "light2"
    type = models.CharField(max_length=20, choices=RelayType.choices)
    is_working = models.BooleanField(default=False)
    description = models.TextField(blank=True, null=True)  # ← необязательное описание

    class Meta:
        unique_together = ("controller", "name")

    def __str__(self):
        return f"{self.name} ({self.type}) - {'ON' if self.is_working else 'OFF'}"


class Message(models.Model):
    class Status(models.TextChoices):
        OK = "ok", "OK"
        WARNING = "warning", "Warning"
        ERROR = "error", "Error"

    sensor = models.ForeignKey(Sensor, on_delete=models.CASCADE, related_name='messages')
    value = models.FloatField()
    timestamp = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OK)

    def __str__(self):
        return f"{self.sensor.name}: {self.value} ({self.status})"


class ManualControlLog(models.Model):
    controller = models.ForeignKey(Controller, on_delete=models.CASCADE, related_name='manual_logs')
    relay = models.ForeignKey(Relay, on_delete=models.CASCADE)
    action = models.CharField(max_length=10, choices=(("on", "On"), ("off", "Off")))
    performed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.timestamp}: {self.relay.name} -> {self.action}"
