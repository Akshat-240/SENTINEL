import os
import sys
from datetime import datetime

# Ensure the project root is in sys.path to allow importing config
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from config import settings
from core.fusion.data_fusion import get_all_zone_snapshots
from core.risk_engine.base_scorer import get_base_scores
from core.risk_engine.compound_scorer import get_compound_bonus

def get_alert_level(score):
    """
    Determines the alert level based on the final calculated risk score.
    Returns a dictionary with level string, an emoji, and the corresponding action.
    """
    if score < settings.CAUTION_THRESHOLD:
        return {"level": "NORMAL", "emoji": "🟢", "action": "All parameters within safe limits"}
    elif score < settings.WARNING_THRESHOLD:
        return {"level": "CAUTION", "emoji": "🟡", "action": "Conditions changing. Monitor closely."}
    elif score < settings.HIGH_RISK_THRESHOLD:
        return {"level": "WARNING", "emoji": "🟠", "action": "Safety officer notified. Non-essential workers advised to exit."}
    elif score < settings.CRITICAL_THRESHOLD:
        return {"level": "HIGH_RISK", "emoji": "🔴", "action": "All permits suspended. Evacuation recommended."}
    elif score < settings.EMERGENCY_THRESHOLD:
        return {"level": "CRITICAL", "emoji": "🚨", "action": "Full evacuation triggered. All operations halted."}
    else:
        return {"level": "EMERGENCY", "emoji": "☢️", "action": "Plant-wide shutdown. All personnel evacuate immediately."}

def calculate_risk(zone_snapshot):
    """
    Calculates the final risk score by combining base scores and compound bonuses.
    Caps the final score at 100 and appends the corresponding alert level.
    """
    base_scores = get_base_scores(zone_snapshot)
    base_total = base_scores.get("total", 0)
    
    compound_bonus = get_compound_bonus(zone_snapshot, base_total)
    compound_total = compound_bonus.get("total_bonus", 0)
    
    final_score = min(base_total + compound_total, 100)
    alert_level = get_alert_level(final_score)
    
    return {
        "zone_id": zone_snapshot.get("zone_id"),
        "timestamp": datetime.now().isoformat(),
        "final_score": final_score,
        "base_scores": base_scores,
        "compound_bonus": compound_bonus,
        "alert_level": alert_level,
        "combinations_detected": compound_bonus.get("combinations_detected", [])
    }

def calculate_all_zones():
    """
    Calculates the risk for all zones and returns them in descending order of risk.
    """
    snapshots = get_all_zone_snapshots()
    results = []
    for snapshot in snapshots:
        results.append(calculate_risk(snapshot))
        
    # Sort descending by final_score
    results.sort(key=lambda x: x.get("final_score", 0), reverse=True)
    return results
