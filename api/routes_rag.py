import os
import sys
from flask import Blueprint, jsonify, request

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from core.fusion.data_fusion import get_zone_snapshot
from core.risk_engine.risk_calculator import calculate_risk
from core.rag.retriever import retrieve

rag_bp = Blueprint('rag_bp', __name__, url_prefix='/api/rag')

@rag_bp.route('/query', methods=['POST'])
def query_rag():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON payload provided"}), 400
            
        query = data.get("query")
        if not query:
            return jsonify({"error": "query is required"}), 400
            
        results = retrieve(query)
        return jsonify(results[:3])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@rag_bp.route('/auto/<zone_id>', methods=['GET'])
def auto_rag(zone_id):
    try:
        snapshot = get_zone_snapshot(zone_id)
        risk_result = calculate_risk(snapshot)
        score = risk_result.get("final_score", 0)
        
        if score >= 75:
            from core.rag.formatter import RAGFormatter
            formatter = RAGFormatter()
            output = formatter.format_for_dashboard(snapshot, score)
            return jsonify(output)
        else:
            return jsonify({"message": "Risk below RAG trigger threshold", "score": score})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@rag_bp.route('/copilot', methods=['POST'])
def copilot_chat():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON payload provided"}), 400
            
        query = data.get("query")
        zone_id = data.get("zone_id", "ZONE_A")
        
        if not query:
            return jsonify({"error": "query is required"}), 400
            
        from core.rag.formatter import RAGFormatter
        from core.fusion.data_fusion import get_zone_snapshot
        
        snapshot = get_zone_snapshot(zone_id)
        formatter = RAGFormatter()
        output = formatter.format_for_copilot(query, snapshot)
        return jsonify(output)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

