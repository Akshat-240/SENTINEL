import os
import sys
from flask import Blueprint, jsonify

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from core.fusion.data_fusion import get_zone_snapshot
from core.risk_engine.risk_calculator import calculate_risk, calculate_all_zones
from core.trend_predictor.predictor import get_trend_prediction
from core.similarity_engine.disaster_dna import get_similarity_scores

risk_bp = Blueprint('risk_bp', __name__, url_prefix='/api/risk')

@risk_bp.route('/score/<zone_id>', methods=['GET'])
def get_score(zone_id):
    try:
        snapshot = get_zone_snapshot(zone_id)
        result = calculate_risk(snapshot)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@risk_bp.route('/trend/<zone_id>', methods=['GET'])
def get_trend(zone_id):
    try:
        trend_data = get_trend_prediction(zone_id)
        return jsonify(trend_data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@risk_bp.route('/similarity/<zone_id>', methods=['GET'])
def get_similarity(zone_id):
    try:
        snapshot = get_zone_snapshot(zone_id)
        trend = get_trend_prediction(zone_id)
        similarity = get_similarity_scores(snapshot, trend)
        return jsonify(similarity)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@risk_bp.route('/all', methods=['GET'])
def get_all_risk():
    try:
        results = calculate_all_zones()
        return jsonify(results)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
