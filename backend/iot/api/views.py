from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import Company, User, Controller, Sensor, Message
from .serializers import (
    CompanySerializer, UserSerializer,
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

class MessageViewSet(viewsets.ModelViewSet):
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated, IsCompanyUser]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'SUPERUSER':
            return Message.objects.all()
        return Message.objects.filter(sensor__controller__company=user.company)
