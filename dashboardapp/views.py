
from django.shortcuts import render
from .firestore_service import fetch_collection, delete_document, update_document
from django.contrib import messages
from django.utils import timezone
from datetime import datetime, timedelta
from django.http import JsonResponse
import calendar
from calendar import month_name
from collections import Counter, defaultdict
import math
from django.shortcuts import redirect
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
import joblib
from datetime import datetime, timedelta
from django.conf import settings
import os
from django.contrib.auth.decorators import user_passes_test
from django.http import JsonResponse
import matplotlib 
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import io
import base64
from django.core.files.base import ContentFile
from django.shortcuts import render, redirect
from django.http import HttpResponse
from django.contrib import messages
from dashboardapp.firestore_service import fetch_document_by_field
from django.views.decorators.csrf import csrf_exempt
import hashlib
from django.views.decorators.http import require_POST
from django.http import JsonResponse
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from dashboardapp.firestore_service import firestore
import hashlib
import secrets
from dashboardapp.firestore_service import add_document


def register_view(request):
    if request.method == 'POST':
        from django.contrib.auth.models import User
        email = request.POST.get('email', '').strip()
        password = request.POST.get('password', '').strip()
        username = request.POST.get('username', '').strip()
        profile_picture = request.FILES.get('profile_picture')

        if not email or not password or not username:
            return render(request, 'dashboardapp/register.html', {'error': 'All fields except profile picture are required.'})

        if User.objects.filter(username=username).exists():
            return render(request, 'dashboardapp/register.html', {'error': 'Username already taken.'})
        if User.objects.filter(email=email).exists():
            return render(request, 'dashboardapp/register.html', {'error': 'Email already registered.'})

        user = User.objects.create_user(username=username, email=email, password=password)
        login(request, user)
        return redirect('dashboard')
    return render(request, 'dashboardapp/register.html')


@login_required
def register_responder(request):
    """Handle responder registration: save fullname, email, hashed password, createdAt to Firestore."""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Invalid request method'})

    try:
        fullname = (request.POST.get('fullname') or '').strip()
        email = (request.POST.get('email') or '').strip()
        password = request.POST.get('password') or ''

        if not fullname or not email or not password:
            return JsonResponse({'success': False, 'error': 'All fields are required'})

        # Hash password using salted SHA-256 (store salt + hash)
        salt = secrets.token_hex(16)
        hash_obj = hashlib.sha256()
        hash_obj.update((salt + password).encode('utf-8'))
        password_hash = hash_obj.hexdigest()

        # Check for duplicate email in responder_credentials
        db = firestore.client()
        existing = db.collection('responder_credentials').where('email', '==', email).limit(1).stream()
        for _ in existing:
            return JsonResponse({'success': False, 'error': 'Email already registered for a responder.'})

        data = {
            'fullname': fullname,
            'email': email,
            # Store salted SHA-256 hash and the salt used
            'password': password_hash,
            'salt': salt,
            # Use Firestore server timestamp constant
            'createdAt': firestore.SERVER_TIMESTAMP
        }

        result = add_document('responder_credentials', data)
        if result.get('success'):
            return JsonResponse({'success': True, 'message': 'Responder registered successfully'})
        else:
            return JsonResponse({'success': False, 'error': result.get('error')})

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})


def login_view(request):
    if request.method == 'POST':
        from django.contrib.auth.models import User
        email = (request.POST.get('email') or '').strip()
        password = request.POST.get('password')
        if not email or not password:
            return render(request, 'dashboardapp/login.html', {'error': 'Email and password are required'})
        user_by_email = User.objects.filter(email__iexact=email).first()
        if not user_by_email:
            return render(request, 'dashboardapp/login.html', {'error': 'Invalid credentials'})
        user = authenticate(request, username=user_by_email.username, password=password)
        if user is not None:
            login(request, user)
            return redirect('dashboard')
        else:
            return render(request, 'dashboardapp/login.html', {'error': 'Invalid credentials'})
    return render(request, 'dashboardapp/login.html')


def logout_view(request):
    logout(request)
    return redirect('login')


def get_profile_info(request):
    if not request.user.is_authenticated:
        return JsonResponse({'success': False, 'error': 'Not authenticated'})
    user = request.user

    # Fetch profile document keyed by Django user id
    user_id = str(user.id)
    db = firestore.client()
    doc = db.collection('admin_user_profiles').document(user_id).get()
    profile = doc.to_dict() if doc.exists else {}

    display_name = profile.get('display_name') if profile else None
    profile_picture = profile.get('profile_picture') if profile else ''

    return JsonResponse({
        'success': True,
        'username': display_name or user.get_username(),
        'profile_picture': profile_picture or ''
    })


@require_POST
def create_ui_notification(request):
    """Server-side endpoint to create a UI notification in Firestore using admin SDK.
    Expects POST fields: type, message
    """
    if not request.user.is_authenticated:
        return JsonResponse({'success': False, 'error': 'Authentication required'}, status=403)
    try:
        ntype = (request.POST.get('type') or 'info').strip()
        message = (request.POST.get('message') or '').strip()
        if not message:
            return JsonResponse({'success': False, 'error': 'Message required'}, status=400)
        db = firestore.client()
        # Use firebase-admin firestore to create the document with server timestamp
        doc_ref = db.collection('ui_notifications').document()
        data = {
            'type': ntype,
            'message': message,
            'createdAt': firestore.SERVER_TIMESTAMP,
            'read': False,
            'createdBy': str(request.user.id)
        }
        doc_ref.set(data)
        return JsonResponse({'success': True, 'id': doc_ref.id})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@require_POST
def mark_ui_notifications_read(request):
    """Mark one or more ui_notifications as read. Accepts POST field 'ids' containing comma-separated doc ids."""
    if not request.user.is_authenticated:
        return JsonResponse({'success': False, 'error': 'Authentication required'}, status=403)
    try:
        ids_raw = (request.POST.get('ids') or '').strip()
        ids = [i.strip() for i in ids_raw.split(',') if i.strip()]
        if not ids:
            return JsonResponse({'success': False, 'error': 'No ids provided'}, status=400)
        db = firestore.client()
        batch = db.batch()
        for doc_id in ids:
            doc_ref = db.collection('ui_notifications').document(doc_id)
            batch.update(doc_ref, {'read': True})
        batch.commit()
        return JsonResponse({'success': True, 'updated': len(ids)})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@require_POST
def delete_ui_notification(request):
    """Delete a ui_notification by id. POST field: id"""
    if not request.user.is_authenticated:
        return JsonResponse({'success': False, 'error': 'Authentication required'}, status=403)
    try:
        doc_id = (request.POST.get('id') or '').strip()
        if not doc_id:
            return JsonResponse({'success': False, 'error': 'No id provided'}, status=400)
        db = firestore.client()
        db.collection('ui_notifications').document(doc_id).delete()
        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@require_POST
def update_account(request):
    if not request.user.is_authenticated:
        return JsonResponse({'success': False, 'error': 'Not authenticated'})

    user = request.user

    display_name = request.POST.get('username', '').strip()
    new_email = (request.POST.get('email', '') or '').strip()
    current_password = request.POST.get('current_password', '')
    new_password = request.POST.get('new_password', '')
    profile_picture_file = request.FILES.get('profile_picture')

    feedback = []

    # Update Firestore profile for display name and profile picture
    db = firestore.client()
    user_id = str(user.id)
    profile_updates = {}

    if display_name:
        profile_updates['display_name'] = display_name
        feedback.append('Display name updated.')

    if profile_picture_file:
        try:
            img_data = profile_picture_file.read()
            img_b64 = base64.b64encode(img_data).decode('utf-8')
            profile_updates['profile_picture'] = img_b64
            feedback.append('Profile picture updated.')
        except Exception:
            return JsonResponse({'success': False, 'error': 'Failed to process profile picture.'})

    if profile_updates:
        db.collection('admin_user_profiles').document(user_id).set(profile_updates, merge=True)

    # Update Django user email if provided and changed (case-insensitive)
    if new_email and (user.email or '').strip().lower() != new_email.lower():
        # Optional: enforce uniqueness
        from django.contrib.auth.models import User
        if User.objects.filter(email__iexact=new_email).exclude(pk=user.pk).exists():
            return JsonResponse({'success': False, 'error': 'Email is already in use.'})
        user.email = new_email
        feedback.append('Email updated.')

    # Update Django user password if requested
    if new_password:
        if not user.check_password(current_password):
            return JsonResponse({'success': False, 'error': 'Current password incorrect.'})
        user.set_password(new_password)
        feedback.append('Password updated.')

    if feedback:
        user.save()
    else:
        return JsonResponse({'success': False, 'error': 'No changes detected.'})

    # Return updated display info
    doc = db.collection('admin_user_profiles').document(user_id).get()
    profile = doc.to_dict() if doc.exists else {}
    return JsonResponse({
        'success': True,
        'message': ' '.join(feedback),
        'username': (profile.get('display_name') if profile else None) or user.get_username(),
        'profile_picture': (profile.get('profile_picture') if profile else '')
    })


@user_passes_test(lambda u: u.is_superuser)
def train_prediction_model(request):
    if request.method == 'POST':
        try:
            # Import the management command
            from django.core.management import call_command
            call_command('train_emergency_model')
            return JsonResponse({'success': True, 'message': 'Model trained successfully'})
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})
    
    return JsonResponse({'success': False, 'error': 'Invalid request method'})


def generate_predictions():
    """Generate emergency predictions using the trained model"""
    model_path = os.path.join(settings.BASE_DIR, 'emergency_prediction_model.pkl')
    dates_path = os.path.join(settings.BASE_DIR, 'model_dates.pkl')
    
    if not os.path.exists(model_path) or not os.path.exists(dates_path):
        return None
    
    try:
        # Load model and dates
        model = joblib.load(model_path)
        dates_data = joblib.load(dates_path)
        
        # Get the last date from training data
        last_date = datetime.fromisoformat(dates_data['last_date']).date()
        
        # Generate predictions for next 7 days
        predictions = []
        actual_data = []
        
        # Prepare recent data for prediction
        emergency_data = fetch_collection('emergency_form')
        daily_counts = process_daily_counts_for_prediction(emergency_data, last_date)
        
        # Get the most recent 7 days of data
        recent_dates = sorted(daily_counts.keys())[-7:]
        recent_counts = [daily_counts[date] for date in recent_dates]
        
        # Generate predictions for next 7 days
        for i in range(7):
            prediction_date = last_date + timedelta(days=i+1)
            
            # Prepare features for prediction
            day_of_week = prediction_date.weekday()
            day_of_month = prediction_date.day
            month = prediction_date.month
            
            # Use recent counts (shifting window)
            if i < 7:
                features = recent_counts[i:] + recent_counts[:i]
            else:
                features = recent_counts[-7:]
            
            features = features + [day_of_week, day_of_month, month]
            
            # Make prediction
            prediction = max(0, round(model.predict([features])[0]))
            predictions.append({
                'date': prediction_date.isoformat(),
                'predicted_count': prediction
            })
        
        return predictions
        
    except Exception as e:
        print(f"Prediction error: {e}")
        return None


def generate_prediction_chart(predictions):
    """Generate a matplotlib chart for predictions and return as base64 image"""
    if not predictions:
        return None
    
    # Extract dates and counts
    dates = [pred['date'] for pred in predictions]
    counts = [pred['predicted_count'] for pred in predictions]
    
    # Create the plot
    plt.figure(figsize=(10, 6))
    plt.plot(dates, counts, marker='o', linestyle='-', color='#ff6384', linewidth=2, markersize=8)
    plt.fill_between(dates, counts, alpha=0.2, color='#ff6384')
    plt.title('7-Day Emergency Forecast', fontsize=16, fontweight='bold')
    plt.xlabel('Date', fontsize=12)
    plt.ylabel('Number of Emergencies', fontsize=12)
    plt.grid(True, alpha=0.3)
    plt.xticks(rotation=45)
    plt.tight_layout()
    
    # Convert plot to base64 image
    buffer = io.BytesIO()
    plt.savefig(buffer, format='png', dpi=100, bbox_inches='tight')
    buffer.seek(0)
    image_png = buffer.getvalue()
    buffer.close()
    plt.close()
    
    # Encode to base64
    graphic = base64.b64encode(image_png)
    graphic = graphic.decode('utf-8')
    
    return graphic


def process_daily_counts_for_prediction(emergency_data, last_date):
    """Process daily counts for prediction (simplified version)"""
    daily_counts = defaultdict(int)
    start_date = last_date - timedelta(days=14)  # Get data from 2 weeks back
    
    # Initialize with zeros
    current_date = start_date
    while current_date <= last_date:
        daily_counts[current_date.isoformat()] = 0
        current_date += timedelta(days=1)
    
    # Count actual emergencies
    for doc in emergency_data:
        ts = doc.get('timestamp', None)
        if hasattr(ts, 'date'):
            doc_date = ts.date()
        elif isinstance(ts, str):
            try:
                doc_date = datetime.fromisoformat(ts.replace('Z', '+00:00')).date()
            except Exception:
                continue
        else:
            continue
        
        if start_date <= doc_date <= last_date:
            daily_counts[doc_date.isoformat()] += 1
    
    return daily_counts


def get_ts(x):
    ts = x.get('timestamp', '')
    if hasattr(ts, 'isoformat'):
        return ts.isoformat()
    return str(ts)


@login_required
def dashboard(request, tab=None):
    # Define all dashboard tabs and their display names for sidebar navigation
    collections = {
        "dashboard_overview": "Dashboard Overview",
        "emergency_form": "Emergency Records",
        "resident_reports": "Resident Reports",
        "referral": "Referral",
        "responding_team": "Responding Team",
        "statistics": "Statistics",
        "user_types": "Activity Logs",
    }

    error = None
    data = []
    overview_data = {}
    stats = {}
    

    # Block for handling the Dashboard Overview tab
    if tab == "dashboard_overview":
        # For each collection, fetch the data and keep only the 5 most recent cases
        for key in ["emergency_form", "resident_reports", "referral", "responding_team"]:
            result = fetch_collection(key)
            if isinstance(result, dict) and "error" in result:
                overview_data[key] = {"error": result["error"]}
            else:
                sorted_data = sorted(result, key=get_ts, reverse=True)
                overview_data[key] = sorted_data[:5]
                
                # For emergency_form, calculate statistics for total, daily, and weekly cases
                if key == "emergency_form":
                    total_cases = len(result)
                    today = timezone.localdate()
                    week_start = today - timedelta(days=today.weekday())
                    daily_cases = weekly_cases = 0
                    for doc in result:
                        ts = doc.get('timestamp', None)
                        if hasattr(ts, 'date'):
                            doc_date = ts.date()
                        elif isinstance(ts, str):
                            try:
                                doc_date = datetime.fromisoformat(ts).date()
                            except Exception:
                                continue
                        else:
                            continue
                        if doc_date == today:
                            daily_cases += 1
                        if week_start <= doc_date <= today:
                            weekly_cases += 1
                    stats = {
                        "total": total_cases,
                        "daily": daily_cases,
                        "weekly": weekly_cases
                    }
        # Prepare context for the overview tab and render the template
        context = {
            "collections": collections,
            "active_tab": tab,
            "tab_name": collections.get(tab),
            "overview_data": overview_data,
            "stats": stats,
            "data": [],
            "error": error
        }
        return render(request, "dashboardapp/dashboard.html", context)
    
    # Block for handling the Statistics tab
    if tab == "statistics":
    # Fetch statistics data from Firestore
        stats_data = {}
        stats_summary = {}
        nature_of_call_counts = Counter()

        # Initialize data structures
        monthly_cases = {
            "emergency_form": [0] * 12,
            "resident_reports": [0] * 12,
            "referral": [0] * 12,
        }

        monthly_avg_daily = {
            "emergency_form": [0] * 12,
            "resident_reports": [0] * 12,
            "referral": [0] * 12,
        }

        weekly_cases = {
            "emergency_form": [0] * 5,  # 5 weeks maximum
            "resident_reports": [0] * 5,
        }

        selected_month = timezone.localdate().month
        selected_year = timezone.localdate().year
        
        days_in_months = {m: calendar.monthrange(selected_year, m)[1] for m in range(1, 13)}

        # Pre-fetch collections to avoid multiple calls
        collections_data = {}
        for key in ["emergency_form", "resident_reports", "referral"]:
            result = fetch_collection(key)
            collections_data[key] = result
            if isinstance(result, dict) and "error" in result:
                stats_data[key] = {"error": result["error"]}
            else:
                stats_data[key] = sorted(result, key=get_ts, reverse=True)

        today = timezone.localdate()
        week_start = today - timedelta(days=today.weekday())  # Monday

        # Process each collection
        for key in ["emergency_form", "resident_reports", "referral"]:
            result = collections_data[key]
            if isinstance(result, dict) and "error" in result:
                # Set appropriate zero values for each collection type
                if key == "emergency_form":
                    stats_summary[key] = {"total_cases": 0, "weekly_cases": 0, "weekly_average": 0}
                elif key == "resident_reports":
                    stats_summary[key] = {"total_reports": 0, "weekly_cases": 0, "weekly_average": 0}
                elif key == "referral":
                    stats_summary[key] = {"total_referral": 0}
                continue

            weekly_cases_count = 0

            for doc in result:
                ts = doc.get('timestamp', None)
                if hasattr(ts, 'date'):
                    doc_date = ts.date()
                elif isinstance(ts, str):
                    try:
                        doc_date = datetime.fromisoformat(ts).date()
                    except Exception:
                        continue
                else:
                    continue

                # Count monthly cases for all collections
                if doc_date.year == selected_year:
                    month_index = doc_date.month - 1
                    monthly_cases[key][month_index] += 1

                # Count weekly cases for emergency and reports only
                if key in ["emergency_form", "resident_reports"]:
                    if doc_date.month == selected_month and doc_date.year == selected_year:
                        week_of_month = min((doc_date.day - 1) // 7, 4)  # Ensure index 0-4
                        weekly_cases[key][week_of_month] += 1

                    if week_start <= doc_date <= today:
                        weekly_cases_count += 1

            if key == "emergency_form":
                stats_summary[key] = {
                    "total_cases": len(result),
                    "weekly_cases": weekly_cases_count,
                }
            elif key == "resident_reports":
                stats_summary[key] = {
                    "total_reports": len(result),
                    "weekly_cases": weekly_cases_count,
                    }
            elif key == "referral":
                stats_summary[key] = {"total_referral": len(result)}

        # Calculate monthly averages
        for key in ["emergency_form", "resident_reports", "referral"]:
            for m in range(12):
                total_cases_month = monthly_cases[key][m]
                days_in_this_month = days_in_months[m + 1]
                if days_in_this_month > 0:
                    # Use ceiling to always round up to the nearest whole person and ensure integer
                    monthly_avg_daily[key][m] = int(math.ceil(total_cases_month / days_in_this_month))
                else:
                    monthly_avg_daily[key][m] = 0

        # Count nature of call from already fetched data
        emergency_data = collections_data["emergency_form"]
        if not isinstance(emergency_data, dict):  # Only if no error
            for doc in emergency_data:
                nature = doc.get("nature_of_call", "").strip()
                if nature:
                    nature_of_call_counts[nature] += 1

        nature_of_call_list = [{"nature": k, "count": v} for k, v in nature_of_call_counts.items()]

        months_list = [(i, month_name[i]) for i in range(1, 13)]
        month_names = [month_name[i] for i in range(1, 13)]
        predictions = generate_predictions()
        prediction_chart = generate_prediction_chart(predictions) if predictions else None

        # Prepare context for the statistics tab and render the template

        context = {
            "collections": collections,
            "active_tab": tab,
            "tab_name": collections.get(tab),
            "stats_data": stats_data,
            "stats_summary": stats_summary,
            "monthly_cases": monthly_cases,
            "monthly_avg_daily": monthly_avg_daily,
            "month_names": month_names,
            "weekly_cases": weekly_cases,
            "months_list": months_list,
            "current_month": selected_month,
            "nature_of_call_list": nature_of_call_list,
            "predictions": predictions,
            "prediction_chart": prediction_chart,
            "data": [],
            "error": None
        }

        return render(request, "dashboardapp/dashboard.html", context)
    
    # Block for handling all other tabs except dashboard_overview
    if tab in collections and tab != "dashboard_overview":
        result = fetch_collection(tab)
        if isinstance(result, dict) and "error" in result:
            error = result["error"]
        else:
            # Ensure each document has an ID for real-time updates
            for doc in result:
                if 'id' not in doc:
                    doc['id'] = doc.get('document_id', '')  # Use appropriate field for ID
            data = sorted(result, key=get_ts, reverse=True)
            
    elif tab is None and request.path.rstrip('/') == '/dashboard':
        tab = None
    else:
        from django.http import Http404
        raise Http404("Tab not found")

    context = {
        "collections": collections,
        "active_tab": tab,
        "tab_name": collections.get(tab),
        "data": data,
        "error": error
    }
    return render(request, "dashboardapp/dashboard.html", context)


def get_weekly_cases_ajax(request):
    month = int(request.GET.get('month', timezone.localdate().month))
    year = int(request.GET.get('year', timezone.localdate().year))

    weekly_cases = {
        "emergency_form": [0] * 5,
        "resident_reports": [0] * 5,
    }

    for key in ["emergency_form", "resident_reports"]:
        result = fetch_collection(key)

        if isinstance(result, dict) and "error" in result:
            continue

        for doc in result:
            ts = doc.get('timestamp', None)
            if hasattr(ts, 'date'):
                doc_date = ts.date()
            elif isinstance(ts, str):
                try:
                    doc_date = datetime.fromisoformat(ts).date()
                except Exception:
                    continue
            else:
                continue
        
            if doc_date.month == month and doc_date.year == year:
                week_of_month = ((doc_date.day - 1) // 7)
                weekly_cases[key][week_of_month] += 1

    return JsonResponse(weekly_cases)


def delete_emergency_record(request, document_id):
    if request.method == 'POST':
        result = delete_document('emergency_form', document_id)
        if result.get("success"):
            messages.success(request, "Emergency record deleted successfully.")
        else:
            messages.error(request, f"Error deleting record: {result.get('error')}")
    return redirect('dashboard_tab', tab = "emergency_form")


def edit_emergency_record(request, document_id):
    if request.method == 'POST':

        treatments = list(set(request.POST.getlist('treatments_given')))
        other_treatment = request.POST.get('other_treatment', '').strip()
        if other_treatment and other_treatment not in treatments:
            treatments.append(other_treatment)

        equipment = list(set(request.POST.getlist('equipment_used')))
        other_equipment = request.POST.get('other_equipment', '').strip()
        if other_equipment and other_equipment not in equipment:
            equipment.append(other_equipment)

        data = {
            'age': request.POST.get('age'),
            'allergy_status': request.POST.get('allergy_status'),
            'appearance_observation': request.POST.get('appearance_observation'),
            'asthma_status': request.POST.get('asthma_status'),
            'barangay': request.POST.get('barangay'),
            'bloodloss_observation': request.POST.get('bloodloss_observation'),
            'capillary_refill_time': request.POST.get('capillary_refill_time'),
            'chief_complaint': request.POST.get('chief_complaint'),
            'consent_to_care': request.POST.get('consent_to_care'),
            'contact_number': request.POST.get('contact_number'),
            'date_of_birth': request.POST.get('date_of_birth'),
            'date_of_incident': request.POST.get('date_of_incident'),
            'destination': request.POST.get('destination'),
            'device_id': request.POST.get('device_id'),
            'diabetes_status': request.POST.get('diabetes_status'),
            'diastolic_bp': request.POST.get('diastolic_bp'),
            'equipment_used': equipment,
            'eye_score': request.POST.get('eye_score'),
            'gcs_total': request.POST.get('gcs_total'),
            'hypertension_status': request.POST.get('hypertension_status'),
            'incident_number': request.POST.get('incident_number'),
            'left_pupil_reaction': request.POST.get('left_pupil_reaction'),
            'left_pupil_size': request.POST.get('left_pupil_size'),
            'medications': request.POST.get('medications'),
            'motor_score': request.POST.get('motor_score'),
            'nature_of_call': request.POST.get('nature_of_call'),
            'noted_by': request.POST.get('noted_by'),
            'other_medical_history': request.POST.get('other_medical_history'),
            'patient_name': request.POST.get('patient_name'),
            'pickup_point': request.POST.get('pickup_point'),
            'pulse_ox': request.POST.get('pulse_ox'),
            'pulse_rate': request.POST.get('pulse_rate'),
            'purok': request.POST.get('purok'),
            'remarks': request.POST.get('remarks'),
            'respiratory_rate': request.POST.get('respiratory_rate'),
            'responding_unit': request.POST.get('responding_unit'),
            'right_pupil_reaction': request.POST.get('right_pupil_reaction'),
            'right_pupil_size': request.POST.get('right_pupil_size'),
            'seizures_status': request.POST.get('seizures_status'),
            'sex': request.POST.get('sex'),
            'systolic_bp': request.POST.get('systolic_bp'),
            'team_leader': request.POST.get('team_leader'),
            'team_member': request.POST.get('team_member'),
            'team_operator': request.POST.get('team_operator'),
            'temperature': request.POST.get('temperature'),
            'treatments_given': treatments,
            'verbal_score': request.POST.get('verbal_score'),
            'waiver': request.POST.get('waiver'),
        }


        result = update_document('emergency_form', document_id, data)
        if result.get("success"):
            messages.success(request, "Emergency record updated successfully.")
        else:
            messages.error(request, f"Error updating record: {result.get('error')}")

    return redirect('dashboard_tab', tab='emergency_form')


def edit_referral_record(request, document_id):
    if request.method == 'POST':

        consent_to_care = 'yes' if request.POST.get('consent_to_care') == 'on' else 'no'
        waiver = 'yes' if request.POST.get('waiver') == 'on' else 'no'


        data = {
            'patient_name': request.POST.get('patient_name'),
            'reason_for_referral': request.POST.get('reason_for_referral'),
            'receiving_institution': request.POST.get('receiving_institution'),
            'referring_institution': request.POST.get('referring_institution'),
            'endorsed_by': request.POST.get('endorsed_by'),
            'endorsed_to': request.POST.get('endorsed_to'),
            'consent_to_care': consent_to_care,
            'waiver': waiver, 
            'remarks': request.POST.get('remarks'),
        }

        result = update_document('referral', document_id, data)
        if result.get("success"):
            messages.success(request, "Referral record updated successfully.")
        else:
            messages.error(request, f"Error updating record: {result.get('error')}")

    return redirect('dashboard_tab', tab='referral')


def delete_referral_record(request, document_id):
    if request.method == 'POST':
        result = delete_document('referral', document_id)
        if result.get("success"):
            messages.success(request, "Referral record deleted successfully.")
        else:
            messages.error(request, f"Error deleting record: {request.get('error')}")
    return redirect('dashboard_tab', tab = "referral")


@require_POST
def update_resident_report_status(request, document_id):
    try:
        # Get the new status from the request
        new_status = request.POST.get('status')
        
        if not new_status:
            return JsonResponse({'success': False, 'error': 'No status provided'})
        
        # Update the document in Firestore
        result = update_document('resident_reports', document_id, {'status': new_status})
        
        if result.get("success"):
            return JsonResponse({'success': True, 'new_status': new_status})
        else:
            return JsonResponse({'success': False, 'error': result.get('error')})
            
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})
    
    
def set_default_status():


    reports = fetch_collection('resident_reports')
    for report in reports:
        if 'status' not in report or not report['status']:
            update_document('resident_reports', report['id'], {'status': 'Pending'})



