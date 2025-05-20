from rest_framework.permissions import BasePermission, SAFE_METHODS

class IsSuperUser(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_superuser or request.user.role == 'SUPERUSER'


class IsCompanyUser(BasePermission):
    """
    Разрешает доступ только к объектам своей компании.
    """
    def has_object_permission(self, request, view, obj):
        if request.user.role == 'SUPERUSER':
            return True
        if hasattr(obj, 'company'):
            return obj.company == request.user.company
        if hasattr(obj, 'controller'):  # Sensor
            return obj.controller.company == request.user.company
        if hasattr(obj, 'sensor'):  # Message
            return obj.sensor.controller.company == request.user.company
        return False
