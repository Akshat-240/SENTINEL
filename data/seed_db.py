import os
import sys
import sqlite3
import csv
import json
from datetime import datetime

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATABASE_PATH = os.path.join(PROJECT_ROOT, "data", "database", "sentinel.db")

def seed():
    try:
        # STEP 1 - Setup
        db_dir = os.path.dirname(DATABASE_PATH)
        if not os.path.exists(db_dir):
            os.makedirs(db_dir)
            
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()

        # STEP 2 - Create all tables if not exist
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS sensor_readings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            zone_id TEXT, 
            timestamp TEXT,
            gas_ppm REAL, 
            temperature REAL, 
            pressure REAL
        )''')

        cursor.execute('''
        CREATE TABLE IF NOT EXISTS permits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            permit_id TEXT, 
            zone_id TEXT, 
            type TEXT,
            status TEXT, 
            worker_id TEXT, 
            created_at TEXT
        )''')

        cursor.execute('''
        CREATE TABLE IF NOT EXISTS worker_locations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            worker_id TEXT, 
            zone_id TEXT,
            entry_time TEXT, 
            status TEXT
        )''')

        cursor.execute('''
        CREATE TABLE IF NOT EXISTS cctv_feed (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            zone_id TEXT, 
            timestamp TEXT,
            worker_count INTEGER, 
            ppe_compliant_count INTEGER
        )''')

        cursor.execute('''
        CREATE TABLE IF NOT EXISTS zone_alerts (
            zone_id TEXT, 
            alert_type TEXT,
            severity TEXT, 
            message TEXT, 
            timestamp TEXT
        )''')

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
        )''')

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
        )''')

        # STEP 3 - Clear existing data
        cursor.execute('DELETE FROM sensor_readings')
        cursor.execute('DELETE FROM permits')
        cursor.execute('DELETE FROM worker_locations')
        cursor.execute('DELETE FROM cctv_feed')
        print("🗑️ Cleared existing data")

        # STEP 4 - Load sensor readings
        sensor_files = [
            "normal_scenario.csv",
            "medium_risk_scenario.csv",
            "critical_scenario.csv"
        ]
        
        sensor_count = 0
        for filename in sensor_files:
            csv_path = os.path.join(PROJECT_ROOT, "data", "synthetic", "sensors", filename)
            if os.path.exists(csv_path):
                with open(csv_path, 'r', encoding='utf-8') as f:
                    reader = csv.reader(f)
                    next(reader, None)  # Skip header row
                    for row in reader:
                        # expected cols: timestamp, zone_id, gas_ppm, temperature, pressure
                        # wait, user prompt says: gas_ppm, temperature, pressure in csv
                        # check length to be safe
                        if len(row) >= 5:
                            cursor.execute('''
                            INSERT INTO sensor_readings 
                            (timestamp, zone_id, gas_ppm, temperature, pressure) 
                            VALUES (?, ?, ?, ?, ?)
                            ''', (row[0], row[1], float(row[2]), float(row[3]), float(row[4])))
                            sensor_count += 1
        
        print(f"✅ Sensor readings loaded: {sensor_count} rows")

        # STEP 5 - Load permits
        permits_path = os.path.join(PROJECT_ROOT, "data", "synthetic", "permits", "permits.json")
        permit_count = 0
        if os.path.exists(permits_path):
            with open(permits_path, 'r', encoding='utf-8') as f:
                permits_data = json.load(f)
                # handle if JSON is object with 'permits' key or just a list
                permits_list = permits_data.get("permits", []) if isinstance(permits_data, dict) else permits_data
                for p in permits_list:
                    cursor.execute('''
                    INSERT INTO permits (permit_id, zone_id, type, status, worker_id, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ''', (
                        p.get("permit_id"), 
                        p.get("zone_id"), 
                        p.get("type"), 
                        p.get("status"), 
                        p.get("worker_id", p.get("worker_assigned")), # fallbacks just in case
                        p.get("created_at", p.get("issued_at"))
                    ))
                    permit_count += 1
        print(f"✅ Permits loaded: {permit_count} rows")

        # STEP 6 - Load worker locations
        workers_path = os.path.join(PROJECT_ROOT, "data", "synthetic", "workers", "worker_locations.json")
        worker_count = 0
        if os.path.exists(workers_path):
            with open(workers_path, 'r', encoding='utf-8') as f:
                workers_data = json.load(f)
                workers_list = workers_data.get("workers", []) if isinstance(workers_data, dict) else workers_data
                for w in workers_list:
                    cursor.execute('''
                    INSERT INTO worker_locations (worker_id, zone_id, entry_time, status)
                    VALUES (?, ?, ?, ?)
                    ''', (
                        w.get("worker_id"), 
                        w.get("zone_id"), 
                        w.get("entry_time"), 
                        w.get("status")
                    ))
                    worker_count += 1
        print(f"✅ Workers loaded: {worker_count} rows")

        # STEP 7 - Insert CCTV data
        cctv_data = [
            ("ZONE_A", 3, 2),
            ("ZONE_B", 2, 2),
            ("ZONE_C", 2, 1),
            ("ZONE_D", 1, 1),
            ("ZONE_E", 1, 1),
            ("ZONE_F", 1, 0)
        ]
        current_time = datetime.now().isoformat()
        
        for zone_id, wc, ppe_c in cctv_data:
            cursor.execute('''
            INSERT INTO cctv_feed (zone_id, timestamp, worker_count, ppe_compliant_count)
            VALUES (?, ?, ?, ?)
            ''', (zone_id, current_time, wc, ppe_c))
            
        print("✅ CCTV data loaded: 6 rows")

        # STEP 8 - Commit and close
        conn.commit()
        conn.close()
        print("✅ Database seeded successfully")
        print("🚀 Run python app.py to start SENTINEL")

    # STEP 9 - Error handling
    except Exception as e:
        print("❌ Error seeding database")
        print(e)

if __name__ == "__main__":
    seed()
