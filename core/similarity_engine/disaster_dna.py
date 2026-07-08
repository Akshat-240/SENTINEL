import os
import sys
import json
import numpy as np
import faiss
from sklearn.metrics.pairwise import cosine_similarity

# Ensure the project root is in sys.path to allow importing config
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from config import settings

def load_disaster_profiles():
    """
    Loads all disaster profile JSON files from data/synthetic/disaster_profiles/
    and returns them as a list of dictionaries.
    """
    profiles_dir = os.path.join(PROJECT_ROOT, "data", "synthetic", "disaster_profiles")
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

def get_profile_vector(p):
    """
    Maps disaster profile JSON attributes to a normalized 0-10 numerical vector.
    """
    # 1. gas_trend mapping
    gas_t = p.get("gas_trend", "stable").lower()
    if "sharp" in gas_t:
        gas_val = 10.0
    elif "moderate" in gas_t:
        gas_val = 6.0
    elif "stable" in gas_t:
        gas_val = 2.0
    else:
        gas_val = 0.0

    # 2. temp_trend mapping
    temp_t = p.get("temp_trend", "stable").lower()
    if "rising" in temp_t or "high" in temp_t:
        temp_val = 10.0
    elif "stable" in temp_t:
        temp_val = 2.0
    else:
        temp_val = 0.0

    # 3. permit_complexity mapping
    permits = p.get("permit_types_active", [])
    permits_upper = [x.upper().replace(" ", "_") for x in permits]
    if "HOT_WORK" in permits_upper and "CONFINED_SPACE" in permits_upper:
        permit_val = 10.0
    elif len(permits_upper) > 0:
        permit_val = 5.0
    else:
        permit_val = 0.0

    # 4. worker_count mapping
    worker_val = min(10.0, float(p.get("worker_count", 0)))

    # 5. shift_type mapping
    shift_t = p.get("shift_type", "day").lower()
    shift_val = 1.0 if shift_t == "night" else 0.0

    # 6. history_score mapping
    history_val = float(p.get("zone_history_score", 0))

    return [gas_val, temp_val, permit_val, worker_val, shift_val, history_val]

def normalize_vector(v):
    arr = np.array(v, dtype='float32')
    norm = np.linalg.norm(arr)
    if norm == 0:
        return arr
    return arr / norm

def calculate_similarity_faiss(state_vector, profile_vectors):
    """
    Builds a FAISS IndexFlatIP index for profile vectors normalized to unit length,
    queries it with the unit-normalized state vector, and returns similarity scores (0-100).
    """
    if not profile_vectors:
        return []
        
    num_profiles = len(profile_vectors)
    dimension = 6
    
    # Initialize index for Inner Product (cosine similarity on unit vectors)
    index = faiss.IndexFlatIP(dimension)
    
    # Normalize vectors
    norm_profiles = [normalize_vector(v) for v in profile_vectors]
    norm_state = normalize_vector(state_vector)
    
    # Add to FAISS index
    index.add(np.array(norm_profiles).astype('float32'))
    
    # Search the index for all profiles
    distances, indices = index.search(np.array([norm_state]).astype('float32'), num_profiles)
    
    scores = []
    for dist, idx in zip(distances[0], indices[0]):
        if idx >= 0 and idx < num_profiles:
            # Inner product of normalized vectors is the cosine similarity [-1, 1]
            similarity_pct = max(0.0, min(1.0, float(dist))) * 100.0
            scores.append((int(idx), round(similarity_pct, 1)))
            
    return scores

def calculate_similarity(state_vector, profile_vector):
    """
    Fallback cosine similarity calculation using numpy
    """
    state_arr = np.array(state_vector)
    prof_arr = np.array(profile_vector)
    
    norm_state = np.linalg.norm(state_arr)
    norm_prof = np.linalg.norm(prof_arr)
    
    if norm_state == 0 and norm_prof == 0:
        return 100.0
    if norm_state == 0 or norm_prof == 0:
        return 0.0
        
    sim = np.dot(state_arr, prof_arr) / (norm_state * norm_prof)
    sim = max(0.0, min(1.0, float(sim)))
    return round(sim * 100.0, 1)

def get_similarity_scores(zone_snapshot, trend_data):
    """
    Loads all disaster profiles, extracts the state vector, and calculates
    similarity against each profile using FAISS search.
    """
    profiles = load_disaster_profiles()
    state_vector = extract_state_vector(zone_snapshot, trend_data)
    
    if not profiles:
        return {
            "zone_id": zone_snapshot.get("zone_id"),
            "highest_similarity": 0.0,
            "matched_profile": None,
            "intervention_window_hours": None,
            "all_scores": [],
            "alert": False
        }
        
    profile_vectors = [get_profile_vector(p) for p in profiles]
    
    # Run similarity search using FAISS
    faiss_results = calculate_similarity_faiss(state_vector, profile_vectors)
    
    highest_similarity = 0.0
    matched_profile = None
    intervention_window_hours = None
    all_scores = []
    
    for idx, sim in faiss_results:
        p = profiles[idx]
        name = p.get("incident_name", p.get("name", "Unknown Profile"))
        all_scores.append({
            "name": name,
            "similarity": sim
        })
        
        if sim > highest_similarity:
            highest_similarity = sim
            matched_profile = name
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

if __name__ == "__main__":
    test_snapshot = {
        "zone_id": "zone_c",
        "gas_ppm": 400.0,
        "temperature": 65.0,
        "active_permits": [{"type": "Hot Work"}, {"type": "Confined Space"}],
        "worker_count": 5,
        "shift_type": "NIGHT",
        "history_score": 6.0
    }
    test_trend = {
        "slope": 3.5,
        "trend": "RISING"
    }
    print("Running FAISS Disaster DNA Similarity search test:")
    res = get_similarity_scores(test_snapshot, test_trend)
    print(json.dumps(res, indent=2))
