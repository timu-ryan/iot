from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from .models import Controller

class ControllerAPIKeyAuthentication(BaseAuthentication):
    def authenticate(self, request):
        api_key = request.headers.get("x-api-key")
        if not api_key:
            return None
        try:
            controller = Controller.objects.get(api_key=api_key)
        except Controller.DoesNotExist:
            raise AuthenticationFailed("Invalid API Key")
        return (controller, None)
