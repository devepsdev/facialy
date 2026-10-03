from django.contrib import admin
from django.urls import include, path, re_path
from django.views.generic import TemplateView

admin.site.site_header = 'Facialy · Administración'
admin.site.site_title = 'Facialy'

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('core.urls')),
    # Catch-all para servir el SPA de React en cualquier ruta (client-side routing)
    re_path(r'^(?!api/|admin/|static/).*$', TemplateView.as_view(template_name='index.html'), name='spa'),
]
