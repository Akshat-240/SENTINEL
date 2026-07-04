import os
import sys
import sqlite3
import numpy as np

# Ensure the project root is in sys.path to allow importing config
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from config import settings

def get_recent_readings(zone_id, n=5):
    """
    Queries the SQLite sensor_readings table to get the last `n` gas_ppm readings
    for the specified zone, returned as a list of floats ordered with the most recent last.
    """
    db_path = os.path.join(PROJECT_ROOT, settings.DATABASE_PATH)
    if not os.path.exists(db_path):
        return []
        
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute('''
            SELECT gas_ppm
            FROM sensor_readings
            WHERE zone_id = ?
            ORDER BY timestamp DESC
            LIMIT ?
        ''', (zone_id, n))
        rows = cursor.fetchall()
        
        # Extract floats
        readings = [float(row[0]) if row[0] is not None else 0.0 for row in rows]
        
        # Reverse to have the most recent reading at the end (chronological order)
        readings.reverse()
        return readings
    except sqlite3.Error:
        return []
    finally:
        if 'conn' in locals() and conn:
            conn.close()

def calculate_slope(readings):
    """
    Uses numpy linear regression (polyfit degree 1) to calculate the slope of the readings.
    Positive slope = rising, Negative slope = falling.
    """
    if len(readings) < 2:
        return 0.0
    x = np.arange(len(readings))
    y = np.array(readings)
    slope, intercept = np.polyfit(x, y, 1)
    return float(slope)

def classify_trend(slope):
    """
    Classifies the trend based on the calculated slope.
    """
    if slope > 2:
        return "RISING"
    elif slope < -2:
        return "FALLING"
    else:
        return "STABLE"

def project_future(readings, minutes_ahead=15):
    """
    Projects the future gas_ppm value using linear regression.
    Since each reading interval is 30 seconds, projecting 15 minutes ahead
    requires jumping ahead by (minutes_ahead * 2) steps.
    """
    if len(readings) < 2:
        return float(readings[-1]) if readings else 0.0
        
    x = np.arange(len(readings))
    y = np.array(readings)
    slope, intercept = np.polyfit(x, y, 1)
    
    # 1 step = 30 seconds -> 2 steps = 1 minute
    steps_ahead = minutes_ahead * 2
    # The current x index is len(readings) - 1, so future x is that plus steps_ahead
    future_x = (len(readings) - 1) + steps_ahead
    
    projected = (slope * future_x) + intercept
    return max(0.0, float(projected))

def time_to_critical(readings, slope, critical_threshold=500):
    """
    Calculates the time (in minutes) remaining until gas_ppm reaches the critical threshold.
    Returns None if not rising or if already above threshold.
    """
    if not readings:
        return None
        
    current = readings[-1]
    if slope <= 0:
        return None  # Not rising
        
    # How many steps until it reaches critical threshold?
    steps_to_critical = (critical_threshold - current) / slope
    
    # 1 step = 30 seconds = 0.5 minutes
    minutes_to_critical = steps_to_critical * 0.5
    
    if minutes_to_critical < 0:
        return None  # Already passed threshold
        
    return round(float(minutes_to_critical), 1)

def get_trend_prediction(zone_id):
    """
    Aggregates trend analysis for a zone, returning predictions, slopes,
    and alert flags if the critical threshold is approaching rapidly.
    """
    readings = get_recent_readings(zone_id, n=5)
    
    # Handle insufficient data edge case
    if len(readings) < 3:
        return {
            "zone_id": zone_id,
            "current_gas_ppm": readings[-1] if readings else 0.0,
            "trend": "INSUFFICIENT_DATA",
            "slope": 0.0,
            "predicted_in_15min": 0.0,
            "minutes_to_critical": None,
            "alert": False
        }
        
    current_gas_ppm = readings[-1]
    slope = calculate_slope(readings)
    trend = classify_trend(slope)
    predicted_in_15min = project_future(readings, minutes_ahead=15)
    
    # Use settings defaults or fallback to 500
    critical_threshold = getattr(settings, "TREND_CRITICAL_GAS", 500)
    minutes_to_critical = time_to_critical(readings, slope, critical_threshold=critical_threshold)
    
    alert = False
    if minutes_to_critical is not None and minutes_to_critical < 30:
        alert = True
        
    return {
        "zone_id": zone_id,
        "current_gas_ppm": current_gas_ppm,
        "trend": trend,
        "slope": slope,
        "predicted_in_15min": predicted_in_15min,
        "minutes_to_critical": minutes_to_critical,
        "alert": alert
    }
