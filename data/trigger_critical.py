import os
import sqlite3
import json
from datetime import datetime, timedelta

def trigger_critical():
    try:
        # PROJECT_ROOT = parent of data/ folder
        PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        DATABASE_PATH = os.path.join(PROJECT_ROOT, "data", "database", "sentinel.db")
        
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        
        now = datetime.now()
        
        # STEP 1 — Insert critical sensor readings for ZONE_A
        readings = [
            (200, 40, 1.4),
            (280, 43, 1.5),
            (340, 47, 1.6),
            (420, 52, 1.7),
            (500, 56, 1.8),
            (580, 60, 1.9),
            (650, 63, 2.0),
            (720, 65, 2.1),
            (847, 67, 2.2),
            (920, 72, 2.3)
        ]
        
        # Insert 10 rows showing escalation, from 5 mins ago to now
        for i in range(10):
            # Row 1 is oldest (9 steps ago), Row 10 is newest (now)
            row_time = now - timedelta(seconds=30 * (9 - i))
            gas, temp, press = readings[i]
            
            cursor.execute('''
                INSERT INTO sensor_readings (zone_id, timestamp, gas_ppm, temperature, pressure)
                VALUES (?, ?, ?, ?, ?)
            ''', ("ZONE_A", row_time.isoformat(), gas, temp, press))
            
        # STEP 2 — Insert 2 ACTIVE permits for ZONE_A
        cursor.execute('''
            INSERT INTO permits (permit_id, zone_id, type, status, worker_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', ("PTW-DEMO-001", "ZONE_A", "HOT_WORK", "ACTIVE", "W001", now.isoformat()))
        
        cursor.execute('''
            INSERT INTO permits (permit_id, zone_id, type, status, worker_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', ("PTW-DEMO-002", "ZONE_A", "CONFINED_SPACE", "ACTIVE", "W002", now.isoformat()))
        
        # STEP 3 — Insert 3 workers into ZONE_A
        w1_time = now - timedelta(minutes=30)
        cursor.execute('''
            INSERT INTO worker_locations (worker_id, zone_id, entry_time, status)
            VALUES (?, ?, ?, ?)
        ''', ("W001", "ZONE_A", w1_time.isoformat(), "ACTIVE"))
        
        w2_time = now - timedelta(minutes=14)
        cursor.execute('''
            INSERT INTO worker_locations (worker_id, zone_id, entry_time, status)
            VALUES (?, ?, ?, ?)
        ''', ("W002", "ZONE_A", w2_time.isoformat(), "ACTIVE"))
        
        w3_time = now
        cursor.execute('''
            INSERT INTO worker_locations (worker_id, zone_id, entry_time, status)
            VALUES (?, ?, ?, ?)
        ''', ("W003", "ZONE_A", w3_time.isoformat(), "ENTERING"))
        
        conn.commit()
        conn.close()
        
        # STEP 4 — Print status
        print("🚨 Critical scenario loaded for ZONE_A")
        print("⚡ Gas: 920 PPM — Temperature: 72°C")
        print("📋 HOT_WORK + CONFINED_SPACE permits active")
        print("👷 3 workers in danger zone")
        print("🔴 Refresh dashboard to see CRITICAL alert")
        
    except Exception as e:
        print(f"Error loading critical scenario: {e}")

if __name__ == "__main__":
    trigger_critical()
