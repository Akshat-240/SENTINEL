import os
import sys

# Ensure the project root is in sys.path to allow importing config
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from config import settings

def score_gas(gas_ppm):
    """
    Calculates the base risk score for gas concentration.
    Uses configurable thresholds to assign a risk value.
    Higher gas concentrations return a higher risk score indicating more severe danger.
    """
    if gas_ppm < settings.GAS_LOW:
        return 0
    elif settings.GAS_LOW <= gas_ppm <= settings.GAS_MEDIUM:
        return 15
    elif settings.GAS_MEDIUM < gas_ppm <= settings.GAS_HIGH:
        return 25
    else:
        return 40

def score_temperature(temp):
    """
    Calculates the base risk score for ambient temperature.
    Temperatures below the lower threshold are safe. Higher temperatures
    increase the risk score progressively.
    """
    if temp < settings.TEMP_LOW:
        return 0
    elif settings.TEMP_LOW <= temp <= settings.TEMP_HIGH:
        return 10
    else:
        return 20

def score_permits(active_permits):
    """
    Calculates the base risk score based on active permits in the zone.
    Having any active permit adds a base risk. The presence of both 'Hot Work' 
    and 'Confined Space' permits simultaneously indicates a compounding high risk scenario.
    """
    if not active_permits:
        return 0
    
    types = [permit.get("type", "").upper().replace(" ", "_") for permit in active_permits]
    has_hot_work = "HOT_WORK" in types
    has_confined_space = "CONFINED_SPACE" in types
    
    if has_hot_work and has_confined_space:
        return 20
    else:
        return 10

def score_workers(worker_count):
    """
    Calculates the base risk score based on worker density.
    More workers in an area linearly increases the score, up to a configurable cap,
    because higher worker density implies higher potential impact in an incident.
    """
    score = worker_count * settings.WORKER_MULTIPLIER
    return min(score, settings.WORKER_SCORE_CAP)

def score_history(history_score):
    """
    Calculates the base risk score based on the historical risk of the zone.
    The history score is intrinsically bound between 0 and 10 and is returned as-is
    since it is already normalized.
    """
    return history_score

def get_base_scores(zone_snapshot):
    """
    Aggregates all individual base risk scores for a given zone snapshot.
    Calls specific scoring functions for gas, temperature, permits, workers, and history,
    and returns a dictionary containing individual scores and their sum.
    """
    gas_score = score_gas(zone_snapshot.get("gas_ppm", 0.0))
    temp_score = score_temperature(zone_snapshot.get("temperature", 0.0))
    permit_score = score_permits(zone_snapshot.get("active_permits", []))
    worker_score = score_workers(zone_snapshot.get("worker_count", 0))
    history_score_val = score_history(zone_snapshot.get("history_score", 0))
    
    total = gas_score + temp_score + permit_score + worker_score + history_score_val
    
    return {
        "gas": gas_score,
        "temperature": temp_score,
        "permits": permit_score,
        "workers": worker_score,
        "history": history_score_val,
        "total": total
    }
