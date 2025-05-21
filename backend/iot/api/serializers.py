# serializers.py
from rest_framework import serializers
from .models import Company, User, Controller, Sensor, Message, Relay, ManualControlLog


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
        if user.role != User.Role.SUPERUSER:
            data['company'] = user.company
            if data.get('role') == User.Role.SUPERUSER:
                raise serializers.ValidationError("Менеджеры не могут создавать суперпользователей.")
        return data


class ControllerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Controller
        fields = ['id', 'name', 'uuid', 'api_key', 'company', 'created_at', 'control_mode']
        read_only_fields = ['id', 'uuid', 'api_key', 'created_at']

    def validate(self, data):
        user = self.context['request'].user
        if user.role != User.Role.SUPERUSER:
            data['company'] = user.company
        return data


class SensorSerializer(serializers.ModelSerializer):
    uuid = serializers.UUIDField(read_only=True)

    class Meta:
        model = Sensor
        fields = ['id', 'uuid', 'name', 'type', 'controller', 'description']
        read_only_fields = ['id', 'uuid']

    def validate(self, data):
        user = self.context['request'].user
        if user.role != User.Role.SUPERUSER:
            if data['controller'].company != user.company:
                raise serializers.ValidationError("Вы не можете создать датчик для чужой компании.")
        return data


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ['id', 'sensor', 'value', 'status', 'timestamp']
        read_only_fields = ['id', 'timestamp']


class RelaySerializer(serializers.ModelSerializer):
    class Meta:
        model = Relay
        fields = ['id', 'name', 'controller', 'is_working']
        read_only_fields = ['id']

    def validate(self, data):
        user = self.context['request'].user
        if user.role != User.Role.SUPERUSER:
            if data['controller'].company != user.company:
                raise serializers.ValidationError("Вы не можете создать реле для чужой компании.")
        return data


class ManualControlLogSerializer(serializers.ModelSerializer):
    performed_by = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = ManualControlLog
        fields = ['id', 'controller', 'relay', 'action', 'performed_by', 'timestamp']
        read_only_fields = ['id', 'performed_by', 'timestamp']
