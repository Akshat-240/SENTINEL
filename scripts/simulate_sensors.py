"""
SENTINEL - Sensor Simulation Script
Reads one of the 3 scenario CSVs (normal / medium_risk / critical) and
inserts a new sensor_readings row into the database every 30 seconds,
looping continuously. This replaces real hardware sensors for the demo.

Usage:
    python scripts/simulate_sensors.py normal
    python scripts/simulate_sensors.py medium_risk
    python scripts/simulate_sensors.py critical

Leave this running in its own terminal window while app.py runs in another.
Press Ctrl+C to stop it.
"""

import os
import sys
import csv
import time
import sqlite3
from datetime import datetime

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PROJECT_ROOT)

from config import settings

DB_PATH = os.path.join(PROJECT_ROOT, settings.DATABASE_PATH)
SENSORS_DIR = os.path.join(PROJECT_ROOT, "data", "synthetic", "sensors")

SCENARIO_FILES = {
    "normal": "normal_scenario.csv",
    "medium_risk": "medium_risk_scenario.csv",
    "critical": "critical_scenario.csv",
}


def load_scenario_rows(scenario_name):
    filename = SCENARIO_FILES.get(scenario_name)
    if not filename:
        print(f"Unknown scenario '{scenario_name}'. Choose from: {list(SCENARIO_FILES.keys())}")
        sys.exit(1)

    path = os.path.join(SENSORS_DIR, filename)
    rows = []
    with open(path, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)
    return rows


def insert_reading(conn, zone_id, gas_ppm, temperature, pressure):
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO sensor_readings (zone_id, timestamp, gas_ppm, temperature, pressure)
           VALUES (?, ?, ?, ?, ?)""",
        (zone_id, datetime.now().isoformat(), gas_ppm, temperature, pressure),
    )
    conn.commit()


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/simulate_sensors.py [normal|medium_risk|critical]")
        sys.exit(1)

    scenario_name = sys.argv[1]
    rows = load_scenario_rows(scenario_name)

    if not os.path.exists(DB_PATH):
        print(f"ERROR: database not found at {DB_PATH}. Run app.py first so it creates the tables.")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)

    # Group CSV rows by timestamp so all 4 zones for one "tick" get inserted together
    grouped = {}
    for row in rows:
        grouped.setdefault(row["timestamp"], []).append(row)

    timestamps = sorted(grouped.keys())
    print(f"Starting '{scenario_name}' simulation - {len(timestamps)} ticks, one every {settings.REPLAY_INTERVAL_SECONDS} seconds.")
    print("Press Ctrl+C to stop.")

    try:
        while True:
            for ts in timestamps:
                for row in grouped[ts]:
                    insert_reading(
                        conn,
                        row["zone_id"],
                        float(row["gas_ppm"]),
                        float(row["temperature_c"]),
                        float(row["pressure_kpa"]),
                    )
                print(f"Inserted readings for tick {ts}")
                time.sleep(settings.REPLAY_INTERVAL_SECONDS)
            print("Scenario finished one full loop - restarting from the beginning.")
    except KeyboardInterrupt:
        print("\nSimulation stopped.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
