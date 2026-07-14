"""
SENTINEL - Data Loader Script
Loads permits.json and worker_locations.json into the SQLite database
so the risk engine has real data to read via get_zone_snapshot().

Run this ONCE after app.py has started (app.py creates the empty tables
on first run). If you run this before app.py at least once, the tables
won't exist yet and this script will fail.

Usage:
    python scripts/load_data.py
"""

import os
import sys
import json
import sqlite3
from datetime import datetime

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PROJECT_ROOT)

from config import settings

DB_PATH = os.path.join(PROJECT_ROOT, settings.DATABASE_PATH)
PERMITS_JSON = os.path.join(PROJECT_ROOT, "data", "synthetic", "permits", "permits.json")
WORKERS_JSON = os.path.join(PROJECT_ROOT, "data", "synthetic", "workers", "worker_locations.json")


def load_permits(conn):
    with open(PERMITS_JSON, "r") as f:
        data = json.load(f)
    permits = data.get("permits", data if isinstance(data, list) else [])

    cursor = conn.cursor()
    cursor.execute("DELETE FROM permits")  # clear old test data before reloading
    count = 0
    for p in permits:
        # NOTE: app.py's queries check status = "ACTIVE" (uppercase), so we
        # convert our lowercase "active"/"inactive" values to match.
        status = str(p.get("status", "inactive")).upper()
        cursor.execute(
            """INSERT INTO permits (permit_id, zone_id, type, status, worker_id, created_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                p.get("permit_id"),
                p.get("zone_id"),
                p.get("type"),
                status,
                p.get("worker_assigned"),
                p.get("issued_at"),
            ),
        )
        count += 1
    conn.commit()
    print(f"Loaded {count} permits into the database.")


def load_workers(conn):
    with open(WORKERS_JSON, "r") as f:
        data = json.load(f)
    workers = data.get("workers", data if isinstance(data, list) else [])

    cursor = conn.cursor()
    cursor.execute("DELETE FROM worker_locations")
    count = 0
    for w in workers:
        cursor.execute(
            """INSERT INTO worker_locations (worker_id, zone_id, entry_time, status)
               VALUES (?, ?, ?, ?)""",
            (
                w.get("worker_id"),
                w.get("zone_id"),
                w.get("entry_time"),
                "PRESENT",
            ),
        )
        count += 1
    conn.commit()
    print(f"Loaded {count} worker locations into the database.")


def main():
    if not os.path.exists(DB_PATH):
        print(f"ERROR: database not found at {DB_PATH}")
        print("Run 'python app.py' first (even just for a few seconds) so it can create the tables, then stop it and run this script.")
        return

    conn = sqlite3.connect(DB_PATH)
    load_permits(conn)
    load_workers(conn)
    conn.close()
    print("Done. Permits and worker locations are now in the database.")


if __name__ == "__main__":
    main()
