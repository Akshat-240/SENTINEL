import os
import sys
import json
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

# Ensure the project root is in sys.path to allow importing config
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from config import settings

def load_disaster_profiles():
    """
    Loads all disaster profile JSON files from data/corpus/disaster_profiles/
    and returns them as a list of dictionaries.
    """
    profiles_dir = os.path.join(PROJECT_ROOT, "data", "corpus", "disaster_profiles")
    profiles = []
    
    if not os.path.exists(profiles_dir):
        return profiles
        
    for filename in os.listdir(profiles_dir):
        if filename.endswith(".json"):
            filepath = os.path.join(profiles_dir, filename)
            try:
                with open(filepath, 'r') as f:
                    data = json.load(f)
                    profiles.append(data)
            except Exception:
                pass
                
    return profiles

def extract_state_vector(zone_snapshot, trend_data):
    """
    Extracts and normalizes features from the zone snapshot and trend data 
    into a 0-10 scale state vector.
    Features: gas_ppm_trend, temp_trend, permit_complexity, worker_count_normalized, shift_type, history_score
    """
    # 1. gas_ppm_trend
    gas_ppm = zone_snapshot.get("gas_ppm", 0.0)
    gas_ppm_trend = min(10.0, (gas_ppm / 500.0) * 10.0)
    
    # 2. temp_trend
    temperature = zone_snapshot.get("temperature", 0.0)
    temp_trend = min(10.0, (temperature / 80.0) * 10.0)
    
    # 3. permit_complexity
    active_permits = zone_snapshot.get("active_permits", [])
    types = [p.get("type", "") for p in active_permits]
    if "Hot Work" in types and "Confined Space" in types:
        permit_complexity = 10.0
    elif len(types) > 0:
        permit_complexity = 5.0
    else:
        permit_complexity = 0.0
        
    # 4. worker_count_normalized
    zone_id = zone_snapshot.get("zone_id")
    worker_count = zone_snapshot.get("worker_count", 0)
    max_workers = 1
    
    zones_path = os.path.join(PROJECT_ROOT, "config", "zones.json")
    try:
        with open(zones_path, 'r') as f:
            zones_data = json.load(f)
            for z in zones_data:
                if z.get("zone_id") == zone_id:
                    max_workers = z.get("max_workers", 1)
                    if max_workers <= 0:
                        max_workers = 1
                    break
    except Exception:
        pass
        
    worker_count_normalized = min(10.0, (worker_count / float(max_workers)) * 10.0)
    
    # 5. shift_type
    shift_type_str = zone_snapshot.get("shift_type", "DAY")
    shift_type = 1.0 if shift_type_str == "NIGHT" else 0.0
    
    # 6. history_score
    history_score = float(zone_snapshot.get("history_score", 0.0))
    
    return [
        gas_ppm_trend,
        temp_trend,
        permit_complexity,
        worker_count_normalized,
        shift_type,
        history_score
    ]

def calculate_similarity(state_vector, profile_vector):
    """
    Calculates cosine similarity between the current state vector and a historical
    disaster profile vector using scikit-learn. Returns a percentage (0-100) rounded
    to 1 decimal.
    """
    state_arr = np.array(state_vector).reshape(1, -1)
    prof_arr = np.array(profile_vector).reshape(1, -1)
    
    # Handle the zero-vector case to prevent division by zero in cosine similarity
    if np.all(state_arr == 0) and np.all(prof_arr == 0):
        return 100.0
    if np.all(state_arr == 0) or np.all(prof_arr == 0):
        return 0.0
        
    sim = cosine_similarity(state_arr, prof_arr)[0][0]
    
    # Ensure range is strictly 0 to 100 (cosine sim can occasionally be slightly negative due to precision)
    sim = max(0.0, min(1.0, float(sim)))
    return round(sim * 100.0, 1)

def get_similarity_scores(zone_snapshot, trend_data):
    """
    Loads all disaster profiles, extracts the state vector, and calculates
    similarity against each profile. Finds the highest match and returns the full report.
    """
    profiles = load_disaster_profiles()
    state_vector = extract_state_vector(zone_snapshot, trend_data)
    
    highest_similarity = 0.0
    matched_profile = None
    intervention_window_hours = None
    all_scores = []
    
    if not profiles:
        # Default behavior if no profiles are loaded
        return {
            "zone_id": zone_snapshot.get("zone_id"),
            "highest_similarity": 0.0,
            "matched_profile": None,
            "intervention_window_hours": None,
            "all_scores": [],
            "alert": False
        }
    
    for p in profiles:
        prof_vector = [
            float(p.get("gas_ppm_trend", 0)),
            float(p.get("temp_trend", 0)),
            float(p.get("permit_complexity", 0)),
            float(p.get("worker_count_normalized", 0)),
            float(p.get("shift_type", 0)),
            float(p.get("history_score", 0))
        ]
        
        sim = calculate_similarity(state_vector, prof_vector)
        all_scores.append({
            "name": p.get("name", "Unknown Profile"),
            "similarity": sim
        })
        
        if sim > highest_similarity:
            highest_similarity = sim
            matched_profile = p.get("name", "Unknown Profile")
            intervention_window_hours = p.get("intervention_window_hours")
            
    # Trigger an alert if the similarity crosses the high threshold (70%)
    alert = highest_similarity >= getattr(settings, "SIMILARITY_HIGH_THRESHOLD", 70)
    
    return {
        "zone_id": zone_snapshot.get("zone_id"),
        "highest_similarity": highest_similarity,
        "matched_profile": matched_profile,
        "intervention_window_hours": intervention_window_hours,
        "all_scores": all_scores,
        "alert": alert
    }
