import os
import sys
import sqlite3
import json
from flask import Blueprint, jsonify, request

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from config import settings
from core.fusion.data_fusion import get_zone_snapshot
from core.risk_engine.risk_calculator import calculate_risk
from core.orchestrator.emergency import trigger_emergency_response
report_bp = Blueprint('report_bp', __name__, url_prefix='/api/report')

def get_db_connection():
    db_path = os.path.join(PROJECT_ROOT, settings.DATABASE_PATH)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

@report_bp.route('/generate', methods=['POST'])
def generate_report():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON payload provided"}), 400
            
        zone_id = data.get("zone_id")
        if not zone_id:
            return jsonify({"error": "zone_id is required"}), 400
            
        snapshot = get_zone_snapshot(zone_id)
        risk_result = calculate_risk(snapshot)
        score = risk_result.get("final_score", 0)
        
        evidence = None
        evacuation_route = None

        if score >= settings.ORCHESTRATOR_TRIGGER:
            emerg = trigger_emergency_response(zone_id, risk_result)
            evidence = emerg.get("evidence")
            evacuation_route = emerg.get("evacuation_route")

        from core.rag.formatter import RAGFormatter
        from core.replay.replay_engine import get_replay_timeline
        
        formatter = RAGFormatter()
        
        risk_factors = {
            "base_scores": risk_result.get("base_scores", {}),
            "compound_bonus": risk_result.get("compound_bonus", {}),
            "combinations_detected": risk_result.get("combinations_detected", [])
        }
        
        timeline = get_replay_timeline(zone_id, limit=10)
        
        report_data = formatter.format_for_incident_report(
            zone_snapshot=snapshot,
            risk_factors=risk_factors,
            compound_score=score,
            timeline=timeline
        )
        # Return the entire report data structure so the frontend can render all sections
        report_data["zone_id"] = zone_id
        report_data["score"] = score
        return jsonify(report_data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@report_bp.route('/evidence/<zone_id>', methods=['GET'])
def get_evidence(zone_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM evidence_log
            WHERE zone_id = ?
            ORDER BY timestamp DESC
            LIMIT 10
        ''', (zone_id,))
        rows = cursor.fetchall()
        evidence = [dict(row) for row in rows]
        conn.close()
        
        for record in evidence:
            for field in ['base_scores', 'compound_bonus', 'snapshot_data']:
                if record.get(field):
                    try:
                        record[field] = json.loads(record[field])
                    except Exception:
                        pass
                        
        return jsonify(evidence)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
