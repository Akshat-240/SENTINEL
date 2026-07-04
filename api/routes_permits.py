import os
import sys
import sqlite3
from flask import Blueprint, jsonify, request

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from config import settings
from core.fusion.data_fusion import get_zone_snapshot
from core.shadow_twin.regulatory_checker import check_permit_request, get_compliance_status

permits_bp = Blueprint('permits_bp', __name__, url_prefix='/api/permits')

def get_db_connection():
    db_path = os.path.join(PROJECT_ROOT, settings.DATABASE_PATH)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

@permits_bp.route('/active/<zone_id>', methods=['GET'])
def get_active_permits(zone_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT permit_id, zone_id, type, status, worker_id, created_at
            FROM permits
            WHERE zone_id = ? AND status = "ACTIVE"
        ''', (zone_id,))
        rows = cursor.fetchall()
        permits = [dict(row) for row in rows]
        conn.close()
        return jsonify(permits)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@permits_bp.route('/check', methods=['POST'])
def check_permit():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON payload provided"}), 400
            
        permit_type = data.get("permit_type")
        zone_id = data.get("zone_id")
        
        if not permit_type or not zone_id:
            return jsonify({"error": "permit_type and zone_id are required"}), 400
            
        snapshot = get_zone_snapshot(zone_id)
        result = check_permit_request(permit_type, snapshot)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@permits_bp.route('/compliance/<zone_id>', methods=['GET'])
def get_compliance(zone_id):
    try:
        snapshot = get_zone_snapshot(zone_id)
        status = get_compliance_status(snapshot)
        return jsonify(status)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
