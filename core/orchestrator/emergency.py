import os
import sys
import sqlite3
import json
import math
from datetime import datetime

# Ensure the project root is in sys.path to allow importing config
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from config import settings

def get_db_connection():
    """Helper function to get a SQLite DB connection safely."""
    db_path = os.path.join(PROJECT_ROOT, settings.DATABASE_PATH)
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        return conn
    except Exception:
        return None

def ensure_tables_exist(conn):
    """
    Ensures that the required logging and alert tables exist in the database.
    Called before any write operations.
    """
    try:
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS zone_alerts (
                zone_id TEXT,
                alert_type TEXT,
                severity TEXT,
                message TEXT,
                timestamp TEXT
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS evidence_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                zone_id TEXT,
                timestamp TEXT,
                final_score INTEGER,
                alert_level TEXT,
                combinations_detected TEXT,
                base_scores TEXT,
                compound_bonus TEXT,
                snapshot_data TEXT
            )
        ''')
        conn.commit()
    except sqlite3.Error:
        pass

def lock_zone_permits(zone_id):
    """
    Updates all ACTIVE permits in the zone to LOCKED_EMERGENCY status.
    """
    conn = get_db_connection()
    count = 0
    timestamp = datetime.now().isoformat()
    
    if conn:
        try:
            ensure_tables_exist(conn)
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE permits
                SET status = "LOCKED_EMERGENCY"
                WHERE zone_id = ? AND status = "ACTIVE"
            ''', (zone_id,))
            count = cursor.rowcount
            conn.commit()
        except sqlite3.Error:
            pass
        finally:
            conn.close()
            
    return {
        "zone_id": zone_id,
        "permits_locked": count,
        "timestamp": timestamp
    }

def flag_adjacent_zones(zone_id):
    """
    Reads adjacent zones from config and fires ADJACENT_RISK CAUTION alerts for them.
    """
    zones_path = os.path.join(PROJECT_ROOT, "config", "zones.json")
    adjacent_zones = []
    
    try:
        with open(zones_path, 'r') as f:
            zones_data = json.load(f)
            for z in zones_data:
                if z.get("zone_id") == zone_id:
                    adjacent_zones = z.get("adjacent_zones", [])
                    break
    except Exception:
        pass

    conn = get_db_connection()
    flagged = []
    timestamp = datetime.now().isoformat()
    
    if conn:
        try:
            ensure_tables_exist(conn)
            cursor = conn.cursor()
            for adj_id in adjacent_zones:
                msg = f"Adjacent zone {zone_id} has triggered CRITICAL alert"
                cursor.execute('''
                    INSERT INTO zone_alerts (zone_id, alert_type, severity, message, timestamp)
                    VALUES (?, ?, ?, ?, ?)
                ''', (adj_id, "ADJACENT_RISK", "CAUTION", msg, timestamp))
                flagged.append(adj_id)
            conn.commit()
        except sqlite3.Error:
            pass
        finally:
            conn.close()
            
    return flagged

def preserve_evidence_log(zone_id, risk_result):
    """
    Stores an immutable record of the exact data snapshot that triggered the emergency.
    """
    timestamp = datetime.now().isoformat()
    last_id = None
    
    final_score = risk_result.get("final_score", 0)
    alert_level = risk_result.get("alert_level", {}).get("level", "UNKNOWN")
    
    combs = risk_result.get("combinations_detected", [])
    combinations_detected = ",".join(combs) if isinstance(combs, list) else ""
    
    base_scores = json.dumps(risk_result.get("base_scores", {}))
    compound_bonus = json.dumps(risk_result.get("compound_bonus", {}))
    snapshot_data = json.dumps(risk_result)
    
    conn = get_db_connection()
    if conn:
        try:
            ensure_tables_exist(conn)
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO evidence_log (
                    zone_id, timestamp, final_score, alert_level, 
                    combinations_detected, base_scores, compound_bonus, snapshot_data
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                zone_id, timestamp, final_score, alert_level, 
                combinations_detected, base_scores, compound_bonus, snapshot_data
            ))
            last_id = cursor.lastrowid
            conn.commit()
        except sqlite3.Error:
            pass
        finally:
            conn.close()
            
    return {
        "evidence_id": last_id,
        "zone_id": zone_id,
        "timestamp": timestamp
    }

def get_evacuation_route(zone_id):
    """
    Formulates an evacuation route and computes the estimated evacuation time 
    based on the zone's physical footprint.
    """
    zones_path = os.path.join(PROJECT_ROOT, "config", "zones.json")
    area_sqm = 0
    adjacent_zones = []
    
    try:
        with open(zones_path, 'r') as f:
            zones_data = json.load(f)
            for z in zones_data:
                if z.get("zone_id") == zone_id:
                    area_sqm = z.get("area_sqm", 0)
                    adjacent_zones = z.get("adjacent_zones", [])
                    break
    except Exception:
        pass
        
    estimated_time = max(2, math.ceil(area_sqm / 1000.0))
    
    return {
        "zone_id": zone_id,
        "primary_route": "Exit via Gate Alpha — proceed to Muster Point 1",
        "secondary_route": "If primary blocked — exit via Gate Beta",
        "muster_point": "Assembly Area Delta",
        "estimated_evacuation_time_minutes": estimated_time,
        "do_not_enter_zones": adjacent_zones
    }

def trigger_emergency_response(zone_id, risk_result):
    """
    The main Emergency Orchestrator sequence.
    Triggers automatically when the core risk score exceeds dangerous levels.
    Executes operational shutdown, alerts, and evacuation protocols sequentially.
    """
    timestamp = datetime.now().isoformat()
    
    # STEP 1: Lock all active permits to halt ongoing work immediately
    locked = lock_zone_permits(zone_id)
    
    # STEP 2: Flag adjacent zones about the unfolding incident
    flagged = flag_adjacent_zones(zone_id)
    
    # STEP 3: Take a cryptographic-style log of the exact data state for legal/compliance review
    evidence = preserve_evidence_log(zone_id, risk_result)
    
    # STEP 4: Retrieve dynamic evacuation routes
    route = get_evacuation_route(zone_id)
    
    # STEP 5: Emit the core EMERGENCY alert for the affected zone
    conn = get_db_connection()
    if conn:
        try:
            ensure_tables_exist(conn)
            cursor = conn.cursor()
            score = risk_result.get("final_score", 0)
            msg = f"SENTINEL EMERGENCY: Risk score {score}. Full evacuation initiated."
            cursor.execute('''
                INSERT INTO zone_alerts (zone_id, alert_type, severity, message, timestamp)
                VALUES (?, ?, ?, ?, ?)
            ''', (zone_id, "EMERGENCY", "CRITICAL", msg, timestamp))
            conn.commit()
        except sqlite3.Error:
            pass
        finally:
            conn.close()
            
    return {
        "zone_id": zone_id,
        "triggered_at": timestamp,
        "final_score": risk_result.get("final_score", 0),
        "permits_locked": locked.get("permits_locked", 0),
        "adjacent_zones_flagged": flagged,
        "evidence": evidence,
        "evacuation_route": route,
        "status": "EMERGENCY_ACTIVE"
    }
