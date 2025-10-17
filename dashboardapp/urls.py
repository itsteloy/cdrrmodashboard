from django.urls import path
from . import views

urlpatterns = [
    path('', views.dashboard, {'tab': 'dashboard_overview'}, name='home'),

]

