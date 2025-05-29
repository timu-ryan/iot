import os
import json
import uuid
import django
import logging
import paho.mqtt.client as mqtt

from django.conf import settings

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "iot.settings")
django.setup()

from api.models import Controller, Sensor, Message, Company, Relay

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BROKER_HOST = 'localhost'
BROKER_PORT = 1883

client = mqtt.Client()

# Подключение

def on_connect(client, userdata, flags, rc):
    logger.info(f"Connected to MQTT broker with result code {rc}")

    client.subscribe("init/+")
    client.subscribe("controller/+/sensors/+")
    client.subscribe("controller/+/commands/+")
    client.subscribe("controller/+/relays/+/status")

# Обработчики сообщений

import json
import logging

logger = logging.getLogger(__name__)

def handle_init(client, userdata, msg):
    controller_uuid = msg.topic.split("/")[1]  # "init/{uuid}"
    logger.info(f"Received init message on topic '{msg.topic}' with payload: {msg.payload!r}\n\n")

    try:
        # Попытка декодировать JSON
        try:
            payload = json.loads(msg.payload.decode())
        except json.JSONDecodeError as e:
            logger.error(f"Failed to decode JSON: {e}")
            return

        if not isinstance(payload, dict):
            logger.error(f"Expected JSON object, got: {type(payload).__name__}")
            return

        api_key = payload.get("api_key")
        name = payload.get("name")
        company_name = payload.get("company_name")
        sensors = payload.get("sensors", [])
        relays = payload.get("relays", [])

        if not company_name:
            logger.warning("company_name not provided")
            return

        company, _ = Company.objects.get_or_create(name=company_name)

        controller, created = Controller.objects.get_or_create(
            uuid=controller_uuid,
            defaults={
                "api_key": api_key,
                "name": name,
                "company": company
            }
        )

        for sensor in sensors:
            try:
                Sensor.objects.get_or_create(
                    controller=controller,
                    name=sensor["name"],
                    type=sensor["type"],
                    uuid=sensor["uuid"]
                )
            except KeyError as e:
                logger.warning(f"Missing sensor field: {e}")
            except Exception as e:
                logger.error(f"Error creating sensor: {e}")

        for relay in relays:
            try:
                Relay.objects.get_or_create(
                    controller=controller,
                    name=relay["name"],
                    uuid=relay["uuid"],
                    defaults={"description": relay.get("description", "")}
                )
            except KeyError as e:
                logger.warning(f"Missing relay field: {e}")
            except Exception as e:
                logger.error(f"Error creating relay: {e}")

        logger.info(f"Controller '{controller.name}' initialized under company '{company.name}'\n\n")

    except Exception as e:
        logger.exception("Init handling error")


def handle_sensor_data(client, userdata, msg):
    topic_parts = msg.topic.split("/")
    controller_uuid = topic_parts[1]
    sensor_uuid = topic_parts[3]

    try:
        controller = Controller.objects.get(uuid=controller_uuid)
        sensor = Sensor.objects.get(uuid=sensor_uuid, controller=controller)

        payload = json.loads(msg.payload.decode())
        value = float(payload["value"])

        Message.objects.create(sensor=sensor, value=value, status=Message.Status.OK)
        logger.info(f"Saved sensor data: {sensor.name} = {value}")
    except Exception as e:
        logger.exception("Sensor data handling error")

def handle_command(client, userdata, msg):
    topic_parts = msg.topic.split("/")
    controller_uuid = topic_parts[1]
    relay_uuid = topic_parts[3]

    try:
        payload = json.loads(msg.payload.decode())
        is_working = payload.get("is_working")

        controller = Controller.objects.get(uuid=controller_uuid)
        relay = Relay.objects.get(controller=controller, uuid=relay_uuid)

        relay.is_working = is_working
        relay.save()

        logger.info(f"Relay '{relay.name}' updated: is_working = {relay.is_working}")
    except Exception as e:
        logger.exception("Command handling error")

def handle_relay_status(client, userdata, msg):
    topic_parts = msg.topic.split("/")
    controller_uuid = topic_parts[1]
    relay_uuid = topic_parts[3]

    try:
        payload = json.loads(msg.payload.decode())
        is_working = payload.get("is_working")

        controller = Controller.objects.get(uuid=controller_uuid)
        relay = Relay.objects.get(controller=controller, uuid=relay_uuid)

        relay.is_working = is_working
        relay.save()

        logger.info(f"Relay '{relay.name}' status synced: is_working = {is_working}")
    except Exception as e:
        logger.exception("Relay status handling error")

# Главный запуск

def start():
    client.on_connect = on_connect

    client.message_callback_add("init/+", handle_init)
    client.message_callback_add("controller/+/sensors/+", handle_sensor_data)
    client.message_callback_add("controller/+/commands/+", handle_command)
    client.message_callback_add("controller/+/relays/+/status", handle_relay_status)

    client.connect(BROKER_HOST, BROKER_PORT, 60)
    client.loop_forever()

if __name__ == "__main__":
    start()
