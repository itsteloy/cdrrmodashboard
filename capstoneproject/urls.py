"""
URL configuration for capstoneproject project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from dashboardapp import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('dashboardapp.urls')), 
    path('logout/', views.logout_view, name='logout'),
    path('login/', views.login_view, name='login'),
    path('register/', views.register_view, name='register'),
    path('dashboard/', views.dashboard, {'tab': 'dashboard_overview'}, name='dashboard'), 
    path('delete_emergency_record/delete/<str:document_id>/', views.delete_emergency_record, name='delete_emergency_record'),
    path('edit_emergency_record/edit/<str:document_id>/', views.edit_emergency_record, name='edit_emergency_record'),
    path('delete_referral_record/delete/<str:document_id>/', views.delete_referral_record, name='delete_referral_record'),
    path('edit_referral_record/edit/<str:document_id>/', views.edit_referral_record, name='edit_referral_record'),
    path('dashboard/<str:tab>/', views.dashboard, name='dashboard_tab'),
    path('resident_reports/<str:document_id>/update-status/', views.update_resident_report_status, name='update_resident_report_status'),
    path('get_weekly_cases_ajax/', views.get_weekly_cases_ajax, name='get_weekly_cases_ajax'),
    path('train-model/', views.train_prediction_model, name='train_prediction_model'),
    path('update-account/', views.update_account, name='update_account'),
    path('get-profile-info/', views.get_profile_info, name='get_profile_info'),
    path('register-responder/', views.register_responder, name='register_responder'),
    path('api/notifications/create/', views.create_ui_notification, name='create_ui_notification'),
    path('api/notifications/mark-read/', views.mark_ui_notifications_read, name='mark_ui_notifications_read'),
    path('api/notifications/delete/', views.delete_ui_notification, name='delete_ui_notification'),
]