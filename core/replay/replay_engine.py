import os
import sys
import sqlite3
import json
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

def ensure_replay_table(conn):
    """
    Ensures that the continuous replay_log table exists.
    """
    try:
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS replay_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                zone_id TEXT,
                timestamp TEXT,
                gas_ppm REAL,
                temperature REAL,
                pressure REAL,
                worker_count INTEGER,
                active_permits TEXT,
                risk_score INTEGER,
                alert_level TEXT,
                combinations_detected TEXT,
                event_flag TEXT
            )
        ''')
        conn.commit()
    except sqlite3.Error:
        pass

def log_snapshot(zone_id, zone_snapshot, risk_result):
    """
    Inserts a single operational snapshot and its calculated risk into the replay timeline.
    """
    timestamp = datetime.now().isoformat()
    gas_ppm = float(zone_snapshot.get("gas_ppm", 0.0))
    temperature = float(zone_snapshot.get("temperature", 0.0))
    pressure = float(zone_snapshot.get("pressure", 0.0))
    worker_count = int(zone_snapshot.get("worker_count", 0))
    
    active_permits = json.dumps(zone_snapshot.get("active_permits", []))
    
    risk_score = risk_result.get("final_score", 0)
    alert_level = risk_result.get("alert_level", {}).get("level", "NORMAL")
    
    combs = risk_result.get("combinations_detected", [])
    combinations_detected = ",".join(combs) if isinstance(combs, list) else ""
    
    # Auto-determine event flag
    if alert_level in ("EMERGENCY", "CRITICAL"):
        event_flag = "CRITICAL_EVENT"
    elif alert_level in ("HIGH_RISK", "WARNING"):
        event_flag = "ELEVATED_EVENT"
    else:
        event_flag = "NORMAL"

    logged = False
    conn = get_db_connection()
    if conn:
        try:
            ensure_replay_table(conn)
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO replay_log (
                    zone_id, timestamp, gas_ppm, temperature, pressure,
                    worker_count, active_permits, risk_score, alert_level,
                    combinations_detected, event_flag
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                zone_id, timestamp, gas_ppm, temperature, pressure,
                worker_count, active_permits, risk_score, alert_level,
                combinations_detected, event_flag
            ))
            conn.commit()
            logged = True
        except sqlite3.Error:
            pass
        finally:
            conn.close()

    return {
        "logged": logged,
        "zone_id": zone_id,
        "timestamp": timestamp,
        "risk_score": risk_score,
        "event_flag": event_flag
    }

def get_replay_timeline(zone_id, limit=50):
    """
    Retrieves the chronological timeline of events for a specific zone, 
    up to the specified limit.
    """
    timeline = []
    conn = get_db_connection()
    if conn:
        try:
            ensure_replay_table(conn)
            cursor = conn.cursor()
            # Subquery to get the last `limit` rows (DESC) and then order them ASC for timeline playback
            cursor.execute('''
                SELECT * FROM (
                    SELECT timestamp, zone_id, gas_ppm, temperature, worker_count, 
                           risk_score, alert_level, combinations_detected, event_flag
                    FROM replay_log
                    WHERE zone_id = ?
                    ORDER BY timestamp DESC
                    LIMIT ?
                ) ORDER BY timestamp ASC
            ''', (zone_id, limit))
            rows = cursor.fetchall()
            for row in rows:
                timeline.append({
                    "timestamp": row["timestamp"],
                    "zone_id": row["zone_id"],
                    "gas_ppm": row["gas_ppm"],
                    "temperature": row["temperature"],
                    "worker_count": row["worker_count"],
                    "risk_score": row["risk_score"],
                    "alert_level": row["alert_level"],
                    "combinations_detected": row["combinations_detected"],
                    "event_flag": row["event_flag"]
                })
        except sqlite3.Error:
            pass
        finally:
            conn.close()
            
    return timeline

def get_critical_events(zone_id):
    """
    Retrieves only the highly dangerous events (CRITICAL_EVENT) from the zone's history,
    ordered with the most recent first.
    """
    events = []
    conn = get_db_connection()
    if conn:
        try:
            ensure_replay_table(conn)
            cursor = conn.cursor()
            cursor.execute('''
                SELECT timestamp, zone_id, gas_ppm, temperature, worker_count, 
                       risk_score, alert_level, combinations_detected, event_flag
                FROM replay_log
                WHERE zone_id = ? AND event_flag = "CRITICAL_EVENT"
                ORDER BY timestamp DESC
            ''', (zone_id,))
            rows = cursor.fetchall()
            for row in rows:
                events.append({
                    "timestamp": row["timestamp"],
                    "zone_id": row["zone_id"],
                    "gas_ppm": row["gas_ppm"],
                    "temperature": row["temperature"],
                    "worker_count": row["worker_count"],
                    "risk_score": row["risk_score"],
                    "alert_level": row["alert_level"],
                    "combinations_detected": row["combinations_detected"],
                    "event_flag": row["event_flag"]
                })
        except sqlite3.Error:
            pass
        finally:
            conn.close()
            
    return events

def log_all_zones(all_zone_snapshots, all_risk_results):
    """
    Takes paired lists of snapshots and results for all active zones and batches them
    into the replay timeline.
    """
    count = 0
    for snapshot, risk_result in zip(all_zone_snapshots, all_risk_results):
        zone_id = snapshot.get("zone_id")
        if not zone_id:
            continue
            
        res = log_snapshot(zone_id, snapshot, risk_result)
        if res.get("logged"):
            count += 1
            
    return count
