import os
import sys
import sqlite3
from flask import Blueprint, jsonify

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from config import settings
from core.fusion.data_fusion import get_zone_snapshot
from core.risk_engine.risk_calculator import calculate_all_zones, calculate_risk

dashboard_bp = Blueprint('dashboard_bp', __name__, url_prefix='/api/dashboard')

def get_db_connection():
    db_path = os.path.join(PROJECT_ROOT, settings.DATABASE_PATH)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

@dashboard_bp.route('/zones', methods=['GET'])
def get_zones():
    try:
        results = calculate_all_zones()
        return jsonify(results)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@dashboard_bp.route('/zone/<zone_id>', methods=['GET'])
def get_zone(zone_id):
    try:
        snapshot = get_zone_snapshot(zone_id)
        result = calculate_risk(snapshot)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@dashboard_bp.route('/alerts', methods=['GET'])
def get_alerts():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT zone_id, alert_type, severity, message, timestamp
            FROM zone_alerts
            ORDER BY timestamp DESC
            LIMIT 20
        ''')
        rows = cursor.fetchall()
        alerts = [dict(row) for row in rows]
        conn.close()
        return jsonify(alerts)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
