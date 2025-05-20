# serializers.py
from rest_framework import serializers
from .models import Company, User, Controller, Sensor, Message

class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = ['id', 'name', 'created_at']
        read_only_fields = ['id', 'created_at']


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'role', 'company']
        read_only_fields = ['id']
    
    def validate(self, data):
        user = self.context['request'].user
        if user.role != 'SUPERUSER':
            data['company'] = user.company  # менеджеры могут создавать пользователей только в своей компании
            if data.get('role') == 'SUPERUSER':
                raise serializers.ValidationError("Менеджеры не могут создавать суперпользователей.")
        return data


class ControllerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Controller
        fields = ['id', 'name', 'api_key', 'company', 'created_at']
        read_only_fields = ['id', 'api_key', 'created_at']

    def validate(self, data):
        user = self.context['request'].user
        if user.role != 'SUPERUSER':
            data['company'] = user.company
        return data


class SensorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Sensor
        fields = ['id', 'name', 'type', 'controller']
        read_only_fields = ['id']

    def validate(self, data):
        user = self.context['request'].user
        if user.role != 'SUPERUSER' and data['controller'].company != user.company:
            raise serializers.ValidationError("Вы не можете создать датчик для чужой компании.")
        return data


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ['id', 'sensor', 'value', 'status', 'timestamp']
        read_only_fields = ['id', 'timestamp']
