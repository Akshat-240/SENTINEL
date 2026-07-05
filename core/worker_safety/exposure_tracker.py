import os
import sys
import sqlite3
from datetime import datetime

# Ensure the project root is in sys.path to allow importing config
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from config import settings

def get_worker_exposure_time(worker_id, zone_id):
    """
    Queries the SQLite worker_locations table to find the entry_time 
    for a specific worker in a zone, and calculates the minutes elapsed.
    """
    db_path = os.path.join(PROJECT_ROOT, settings.DATABASE_PATH)
    if not os.path.exists(db_path):
        return 0.0
        
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute('''
            SELECT entry_time
            FROM worker_locations
            WHERE worker_id = ? AND zone_id = ?
            ORDER BY entry_time DESC
            LIMIT 1
        ''', (worker_id, zone_id))
        row = cursor.fetchone()
        
        if row and row[0]:
            entry_time = datetime.fromisoformat(row[0])
            delta = datetime.now() - entry_time
            return float(delta.total_seconds() / 60.0)
    except Exception:
        # Failsafe returning 0 on parse or DB failure
        pass
    finally:
        if 'conn' in locals() and conn:
            conn.close()
            
    return 0.0

def calculate_exposure_level(gas_ppm, minutes_in_zone):
    """
    Calculates an exposure index (gas_ppm x minutes) and classifies the danger level.
    """
    index = gas_ppm * minutes_in_zone
    if index < 500:
        return "LOW"
    elif index <= 2000:
        return "MODERATE"
    elif index <= 5000:
        return "HIGH"
    else:
        return "CRITICAL"

def get_worker_action(exposure_level, gas_ppm, risk_score, status="ACTIVE"):
    """
    Determines the appropriate action for a worker based on exposure level, 
    ambient gas conditions, zone risk score, and worker status.
    """
    if risk_score >= settings.CRITICAL_THRESHOLD:
        return "EVACUATE IMMEDIATELY"
    if exposure_level == "CRITICAL":
        return "EXIT IMMEDIATELY"
    if exposure_level == "HIGH":
        return "MOVE TO SAFE ZONE"
    if gas_ppm > 300 and status == "ENTERING":
        return "ENTRY BLOCKED"
    return "MONITOR"

def get_zone_worker_exposure(zone_snapshot, risk_score):
    """
    Generates a comprehensive report of all workers in a zone, 
    calculating their individual exposure levels and required actions.
    """
    zone_id = zone_snapshot.get("zone_id")
    gas_ppm = float(zone_snapshot.get("gas_ppm", 0.0))
    workers_list = zone_snapshot.get("workers", [])
    
    workers_report = []
    critical_count = 0
    blocked_count = 0
    
    for w in workers_list:
        worker_id = w.get("worker_id")
        status = w.get("status", "ACTIVE")
        
        # Primary lookup via SQLite
        minutes = get_worker_exposure_time(worker_id, zone_id)
        
        # Fallback to snapshot entry_time if SQLite lookup fails/returns 0
        if minutes == 0.0 and w.get("entry_time"):
            try:
                entry_dt = datetime.fromisoformat(w["entry_time"])
                minutes = float((datetime.now() - entry_dt).total_seconds() / 60.0)
            except Exception:
                pass
                
        exposure_level = calculate_exposure_level(gas_ppm, minutes)
        action = get_worker_action(exposure_level, gas_ppm, risk_score, status)
        
        if "EVACUATE" in action or "EXIT" in action:
            critical_count += 1
        elif action == "ENTRY BLOCKED":
            blocked_count += 1
            
        workers_report.append({
            "worker_id": worker_id,
            "exposure_minutes": round(minutes, 2),
            "exposure_level": exposure_level,
            "action": action,
            "gas_ppm_at_location": gas_ppm
        })
        
    return {
        "zone_id": zone_id,
        "risk_score": risk_score,
        "total_workers": len(workers_list),
        "workers": workers_report,
        "critical_workers": critical_count,
        "blocked_entries": blocked_count
    }
