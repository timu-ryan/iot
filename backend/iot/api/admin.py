import uuid
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, Company, Controller, Sensor, Message, Relay, ManualControlLog

# --- Фильтр по компании ---
class CompanyFilter(admin.SimpleListFilter):
    title = 'Company'
    parameter_name = 'company'

    def lookups(self, request, model_admin):
        if request.user.is_superuser:
            return [(c.id, c.name) for c in Company.objects.all()]
        if request.user.company:
            return [(request.user.company.id, request.user.company.name)]
        return []

    def queryset(self, request, queryset):
        if request.user.is_superuser:
            return queryset
        if request.user.company:
            return queryset.filter(company=request.user.company)
        return queryset.none()


# --- Админка пользователя ---
@admin.register(User)
class CustomUserAdmin(BaseUserAdmin):
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal info', {'fields': ('first_name', 'last_name')}),
        ('Permissions', {
            'fields': ('is_active', 'is_staff', 'is_superuser', 'role', 'groups', 'user_permissions'),
        }),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
        ('Company', {'fields': ('company',)}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'password1', 'password2', 'role'),
        }),
    )
    list_display = ('email', 'first_name', 'last_name', 'role', 'company', 'is_staff')
    list_filter = (CompanyFilter, 'role', 'is_staff')
    search_fields = ('email', 'first_name', 'last_name')
    ordering = ('email',)

    def get_form(self, request, obj=None, **kwargs):
        form = super().get_form(request, obj, **kwargs)
        form.base_fields.pop('username', None)

        if not request.user.is_superuser:
            form.base_fields.pop('company', None)
        return form

    def save_model(self, request, obj, form, change):
        if not request.user.is_superuser:
            if not request.user.company:
                raise ValueError("Менеджер должен быть привязан к компании.")
            obj.company = request.user.company
            if obj.role == obj.Role.SUPERUSER:
                obj.role = obj.Role.MANAGER

        if obj.role == obj.Role.MANAGER:
            obj.is_staff = True

        super().save_model(request, obj, form, change)

        if obj.role == obj.Role.MANAGER:
            from django.contrib.auth.models import Permission
            from django.contrib.contenttypes.models import ContentType
            from .models import Company, Controller, Sensor, Message, Relay, ManualControlLog

            models_to_grant = [User, Company, Controller, Sensor, Message, Relay, ManualControlLog]
            for model in models_to_grant:
                content_type = ContentType.objects.get_for_model(model)
                permissions = Permission.objects.filter(content_type=content_type)
                obj.user_permissions.add(*permissions)

    def formfield_for_choice_field(self, db_field, request, **kwargs):
        if db_field.name == 'role' and not request.user.is_superuser:
            kwargs['choices'] = (
                (User.Role.MANAGER, 'Manager'),
                (User.Role.EMPLOYEE, 'Employee'),
            )
        return super().formfield_for_choice_field(db_field, request, **kwargs)

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if not request.user.is_superuser and request.user.company:
            return qs.filter(company=request.user.company)
        return qs

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "company" and not request.user.is_superuser:
            kwargs["queryset"] = Company.objects.filter(id=request.user.company.id)
        return super().formfield_for_foreignkey(db_field, request, **kwargs)


# --- Вложенная админка контроллеров ---
class ControllerInline(admin.TabularInline):
    model = Controller
    extra = 0
    fields = ('name', 'api_key')
    readonly_fields = ('api_key',)


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ('name', 'created_at')
    inlines = [ControllerInline]

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if not request.user.is_superuser and request.user.company:
            return qs.filter(id=request.user.company.id)
        return qs


@admin.register(Controller)
class ControllerAdmin(admin.ModelAdmin):
    list_display = ('uuid', 'name', 'company', 'control_mode', 'created_at')
    list_filter = (CompanyFilter,)
    readonly_fields = ('api_key', 'uuid')  # UUID readonly

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if not request.user.is_superuser and request.user.company:
            return qs.filter(company=request.user.company)
        return qs

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "company" and not request.user.is_superuser:
            kwargs["queryset"] = Company.objects.filter(id=request.user.company.id)
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    def save_model(self, request, obj, form, change):
        if not obj.api_key:
            obj.api_key = uuid.uuid4().hex
        super().save_model(request, obj, form, change)


@admin.register(Sensor)
class SensorAdmin(admin.ModelAdmin):
    list_display = ('id', 'uuid', 'name', 'type', 'controller', 'company')
    list_filter = ('controller__company', 'controller')
    readonly_fields = ('uuid',)

    def company(self, obj):
        return obj.controller.company
    company.short_description = 'Company'

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if not request.user.is_superuser and request.user.company:
            return qs.filter(controller__company=request.user.company)
        return qs


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ('sensor', 'controller', 'company', 'value', 'status', 'timestamp')
    list_filter = ('sensor__controller__company', 'sensor__controller', 'sensor')
    readonly_fields = ('timestamp', )

    def controller(self, obj):
        return obj.sensor.controller
    controller.short_description = 'Controller'

    def company(self, obj):
        return obj.sensor.controller.company
    company.short_description = 'Company'

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if not request.user.is_superuser and request.user.company:
            return qs.filter(sensor__controller__company=request.user.company)
        return qs


@admin.register(Relay)
class RelayAdmin(admin.ModelAdmin):
    list_display = ('uuid', 'name', 'controller', 'company', 'is_working', 'description')
    list_filter = ('controller__company', 'controller', 'uuid',)

    def company(self, obj):
        return obj.controller.company
    company.short_description = 'Company'

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if not request.user.is_superuser and request.user.company:
            return qs.filter(controller__company=request.user.company)
        return qs


@admin.register(ManualControlLog)
class ManualControlLogAdmin(admin.ModelAdmin):
    list_display = ('controller', 'relay', 'action', 'performed_by', 'timestamp')
    list_filter = ('controller__company', 'controller', 'relay')
    readonly_fields = ('timestamp',)

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if not request.user.is_superuser and request.user.company:
            return qs.filter(controller__company=request.user.company)
        return qs
