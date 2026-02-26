from django.contrib import admin
from django.urls import include, path, re_path
from django.views.generic import TemplateView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('core.urls')),
    # Catch-all para servir el SPA de React en cualquier ruta (client-side routing)
    re_path(r'^.*$', TemplateView.as_view(template_name='index.html'), name='spa'),
]
