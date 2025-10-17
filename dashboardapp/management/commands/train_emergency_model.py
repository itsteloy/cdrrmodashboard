from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import datetime, timedelta
from collections import defaultdict
import numpy as np
from sklearn.linear_model import LinearRegression
import joblib
import os
from django.conf import settings
from ...firestore_service import fetch_collection
from ...firestore_service import fetch_collection

class Command(BaseCommand):
    help = 'Train a Linear Regression model to predict emergency occurrences'
    
    def handle(self, *args, **options):
        self.stdout.write('Training emergency prediction model...')
        
        # Fetch emergency data
        emergency_data = fetch_collection('emergency_form')
        if isinstance(emergency_data, dict) and 'error' in emergency_data:
            self.stdout.write(self.style.ERROR('Error fetching data: ' + emergency_data['error']))
            return
        
        # Process data into daily counts
        daily_counts = self.process_daily_counts(emergency_data)
        
        # Prepare data for training
        X, y, dates = self.prepare_training_data(daily_counts)
        
        if len(X) < 7:  # Need at least a week of data
            self.stdout.write(self.style.WARNING('Not enough data to train model (need at least 7 days)'))
            return
        
        # Train the model
        model = LinearRegression()
        model.fit(X, y)
        
        # Save the model
        model_path = os.path.join(settings.BASE_DIR, 'emergency_prediction_model.pkl')
        joblib.dump(model, model_path)
        
        # Save the dates for reference
        dates_path = os.path.join(settings.BASE_DIR, 'model_dates.pkl')
        joblib.dump({'last_date': max(dates), 'dates_list': dates}, dates_path)
        
        self.stdout.write(self.style.SUCCESS(f'Model trained successfully with {len(X)} data points'))
        self.stdout.write(f'Model saved to {model_path}')
    
    def process_daily_counts(self, emergency_data):
        """Convert emergency data to daily counts with zero-filled days"""
        daily_counts = defaultdict(int)
        
        # Get date range (last 90 days)
        end_date = timezone.localdate()
        start_date = end_date - timedelta(days=90)
        
        # Initialize all days in range with zero
        current_date = start_date
        while current_date <= end_date:
            daily_counts[current_date.isoformat()] = 0
            current_date += timedelta(days=1)
        
        # Count actual emergencies
        for doc in emergency_data:
            ts = doc.get('timestamp', None)
            if hasattr(ts, 'date'):
                doc_date = ts.date()
            elif isinstance(ts, str):
                try:
                    # Handle different timestamp formats
                    if 'Z' in ts:
                        doc_date = datetime.fromisoformat(ts.replace('Z', '+00:00')).date()
                    else:
                        doc_date = datetime.fromisoformat(ts).date()
                except Exception:
                    continue
            else:
                continue
            
            if start_date <= doc_date <= end_date:
                daily_counts[doc_date.isoformat()] += 1
        
        return daily_counts
    
    def prepare_training_data(self, daily_counts):
        """Prepare features (X) and target (y) for training"""
        # Sort dates chronologically
        sorted_dates = sorted(daily_counts.keys())
        counts = [daily_counts[date] for date in sorted_dates]
        
        # Create features: day of week, day of month, month, and previous days
        X = []
        y = []
        dates = []
        
        for i in range(7, len(sorted_dates)):
            # Extract date features
            current_date = datetime.fromisoformat(sorted_dates[i]).date()
            day_of_week = current_date.weekday()
            day_of_month = current_date.day
            month = current_date.month
            
            # Use previous 7 days as features
            previous_counts = counts[i-7:i]
            
            # Combine all features
            features = previous_counts + [day_of_week, day_of_month, month]
            X.append(features)
            y.append(counts[i])
            dates.append(sorted_dates[i])
        
        return np.array(X), np.array(y), dates