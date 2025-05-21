from django.core.management.base import BaseCommand
from api.mqtt_client import start

class Command(BaseCommand):
    help = 'Запускает MQTT клиент'

    def handle(self, *args, **kwargs):
        self.stdout.write("Запуск MQTT клиента...")
        start()
