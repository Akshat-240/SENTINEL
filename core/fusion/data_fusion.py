import sqlite3
import json
import os
import sys
from datetime import datetime

# Ensure the project root is in sys.path to allow importing config
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from config import settings

def get_zone_snapshot(zone_id):
    """
    Pulls all data streams for a given zone from the SQLite database
    and packages them into a unified ZoneSnapshot dictionary.
    """
    # Initialize default values
    snapshot = {
        "zone_id": zone_id,
        "timestamp": datetime.now().isoformat(),
        "gas_ppm": 0.0,
        "temperature": 0.0,
        "pressure": 0.0,
        "active_permits": [],
        "worker_count": 0,
        "workers": [],
        "cctv_worker_count": 0,
        "ppe_compliant_count": 0,
        "shift_type": "DAY",
        "history_score": 0
    }

    # Determine shift type (NIGHT is 22:00 to 06:00, otherwise DAY)
    current_hour = datetime.now().hour
    if current_hour >= 22 or current_hour < 6:
        snapshot["shift_type"] = "NIGHT"
    else:
        snapshot["shift_type"] = "DAY"

    # Read history score from zones.json
    zones_path = os.path.join(PROJECT_ROOT, "config", "zones.json")
    try:
        with open(zones_path, 'r') as f:
            zones_data = json.load(f)
            for z in zones_data:
                if z.get("zone_id") == zone_id:
                    snapshot["history_score"] = z.get("history_score", 0)
                    break
    except Exception:
        # Handle gracefully if file is missing or unparseable
        pass

    # Connect to database
    db_path = os.path.join(PROJECT_ROOT, settings.DATABASE_PATH)
    if not os.path.exists(db_path):
        return snapshot
        
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # 1. Read latest sensor reading
        cursor.execute('''
            SELECT timestamp, gas_ppm, temperature, pressure
            FROM sensor_readings
            WHERE zone_id = ?
            ORDER BY timestamp DESC
            LIMIT 1
        ''', (zone_id,))
        sensor_row = cursor.fetchone()
        if sensor_row:
            snapshot["timestamp"] = sensor_row["timestamp"]
            snapshot["gas_ppm"] = float(sensor_row["gas_ppm"]) if sensor_row["gas_ppm"] is not None else 0.0
            snapshot["temperature"] = float(sensor_row["temperature"]) if sensor_row["temperature"] is not None else 0.0
            snapshot["pressure"] = float(sensor_row["pressure"]) if sensor_row["pressure"] is not None else 0.0

        # 2. Read active permits
        cursor.execute('''
            SELECT permit_id, type, worker_id
            FROM permits
            WHERE zone_id = ? AND status = "ACTIVE"
        ''', (zone_id,))
        permit_rows = cursor.fetchall()
        for row in permit_rows:
            snapshot["active_permits"].append({
                "permit_id": row["permit_id"],
                "type": row["type"],
                "worker_id": row["worker_id"]
            })

        # 3. Read worker locations
        cursor.execute('''
            SELECT worker_id, entry_time, status
            FROM worker_locations
            WHERE zone_id = ?
        ''', (zone_id,))
        worker_rows = cursor.fetchall()
        for row in worker_rows:
            snapshot["workers"].append({
                "worker_id": row["worker_id"],
                "entry_time": row["entry_time"],
                "status": row["status"]
            })
        snapshot["worker_count"] = len(snapshot["workers"])

        # 4. Read CCTV data
        cursor.execute('''
            SELECT worker_count, ppe_compliant_count
            FROM cctv_feed
            WHERE zone_id = ?
            ORDER BY timestamp DESC
            LIMIT 1
        ''', (zone_id,))
        cctv_row = cursor.fetchone()
        if cctv_row:
            snapshot["cctv_worker_count"] = int(cctv_row["worker_count"]) if cctv_row["worker_count"] is not None else 0
            snapshot["ppe_compliant_count"] = int(cctv_row["ppe_compliant_count"]) if cctv_row["ppe_compliant_count"] is not None else 0

    except sqlite3.Error:
        # Gracefully handle missing tables or columns
        pass
    finally:
        if 'conn' in locals() and conn:
            conn.close()

    return snapshot

def get_all_zone_snapshots():
    """
    Calls get_zone_snapshot() for every zone in zones.json and returns a list of snapshots.
    """
    snapshots = []
    zones_path = os.path.join(PROJECT_ROOT, "config", "zones.json")
    
    try:
        with open(zones_path, 'r') as f:
            zones_data = json.load(f)
            for z in zones_data:
                zone_id = z.get("zone_id")
                if zone_id:
                    snapshots.append(get_zone_snapshot(zone_id))
    except Exception:
        # Handle gracefully if file is missing or unparseable
        pass

    return snapshots
