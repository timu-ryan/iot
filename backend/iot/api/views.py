import json
from rest_framework import viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError
from django.utils.dateparse import parse_datetime

import paho.mqtt.publish as publish

from .models import Company, Relay, User, Controller, Sensor, Message, ManualControlLog
from .serializers import (
    CompanySerializer, UserSerializer, RelaySerializer,
    ControllerSerializer, SensorSerializer, MessageSerializer
)
from .permissions import IsSuperUser, IsCompanyUser

class CompanyViewSet(viewsets.ModelViewSet):
    queryset = Company.objects.all()
    serializer_class = CompanySerializer
    permission_classes = [IsAuthenticated, IsSuperUser]

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'SUPERUSER':
            return User.objects.all()
        return User.objects.filter(company=user.company)

class ControllerViewSet(viewsets.ModelViewSet):
    serializer_class = ControllerSerializer
    permission_classes = [IsAuthenticated, IsCompanyUser]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'SUPERUSER':
            return Controller.objects.all()
        return Controller.objects.filter(company=user.company)

class SensorViewSet(viewsets.ModelViewSet):
    serializer_class = SensorSerializer
    permission_classes = [IsAuthenticated, IsCompanyUser]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'SUPERUSER':
            return Sensor.objects.all()
        return Sensor.objects.filter(controller__company=user.company)


class RelayViewSet(viewsets.ModelViewSet):
    serializer_class = RelaySerializer
    permission_classes = [IsAuthenticated, IsCompanyUser]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'SUPERUSER':
            return Relay.objects.all()
        return Relay.objects.filter(controller__company=user.company)

class MessageViewSet(viewsets.ModelViewSet):
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated, IsCompanyUser]

    def get_queryset(self):
        user = self.request.user
        queryset = Message.objects.all()

        if user.role != 'SUPERUSER':
            queryset = queryset.filter(sensor__controller__company=user.company)

        # валидация по sensor uuid
        sensor_uuid = self.request.query_params.get('sensor')

        if sensor_uuid:
            try:
                sensor = Sensor.objects.get(uuid=sensor_uuid)
                queryset = queryset.filter(sensor=sensor)
            except Sensor.DoesNotExist:
                raise ValidationError({"sensor": "Sensor with this UUID does not exist."})


        # валидация по controller uuid
        controller_uuid = self.request.query_params.get('controller')
        if controller_uuid:
            queryset = queryset.filter(sensor__controller__uuid=controller_uuid)

        # кастомная фильтрация по дате
        start = self.request.query_params.get('start')
        end = self.request.query_params.get('end')

        if start:
            start_date = parse_datetime(start)
            if start_date:
                queryset = queryset.filter(timestamp__gte=start_date)

        if end:
            end_date = parse_datetime(end)
            if end_date:
                queryset = queryset.filter(timestamp__lte=end_date)

        return queryset
    

class LatestSensorMessageView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        sensor_uuid = request.query_params.get("sensor")
        if not sensor_uuid:
            raise ValidationError({"sensor": "sensor UUID is required"})

        try:
            sensor = Sensor.objects.get(uuid=sensor_uuid)
        except Sensor.DoesNotExist:
            raise ValidationError({"sensor": "Sensor not found"})

        # фильтрация доступа
        if not request.user.is_superuser and sensor.controller.company != request.user.company:
            return Response({"error": "Access denied"}, status=403)

        message = sensor.messages.order_by('-timestamp').first()

        if not message:
            return Response({"message": "No data yet"}, status=204)

        serializer = MessageSerializer(message)
        return Response(serializer.data)


class RelayControlView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, controller_uuid):
        relay_uuid = request.data.get("relay_uuid")  # relay uuid
        is_working_raw = request.data.get("is_working")

        if str(is_working_raw).lower() in ["1", "true"]:
            is_working = True
        elif str(is_working_raw).lower() in ["0", "false"]:
            is_working = False
        else:
            return Response({"error": "is_working must be a boolean or 0/1"}, status=400)

        if not isinstance(is_working, bool):
            return Response({"error": "is_working must be boolean"}, status=400)

        try:
            controller = Controller.objects.get(uuid=controller_uuid)
        except Controller.DoesNotExist:
            return Response({"error": "Controller not found"}, status=404)

        try:
            relay = Relay.objects.get(uuid=relay_uuid, controller=controller)
        except Relay.DoesNotExist:
            return Response({"error": "Relay not found or does not belong to this controller"}, status=404)


        if not request.user.is_superuser and controller.company != request.user.company:
            return Response({"error": "Access denied"}, status=403)
        
        if controller.control_mode != "manual":
            return Response({"error": "Controller in auto mode. Manual control not allowed."}, status=400)

        # MQTT publish
        topic = f"controller/{controller.uuid}/commands/{relay_uuid}"
        payload = {
            "is_working": is_working
        }

        publish.single(
            topic,
            json.dumps(payload),
            hostname="localhost",
            port=1883
        )

        relay.is_working = is_working
        relay.save(update_fields=["is_working"])

        # Логирование
        ManualControlLog.objects.create(
            controller=controller,
            relay=relay,
            action="on" if is_working else "off",
            performed_by=request.user
        )

        return Response({"message": f"{relay_uuid} turned {'on' if is_working else 'off'}"})


