import os
import sys
import json
from flask import Blueprint, jsonify

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from core.replay.replay_engine import get_replay_timeline, get_critical_events

replay_bp = Blueprint('replay_bp', __name__, url_prefix='/api/replay')

@replay_bp.route('/timeline/<zone_id>', methods=['GET'])
def get_timeline(zone_id):
    try:
        timeline = get_replay_timeline(zone_id)
        return jsonify(timeline)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@replay_bp.route('/critical/<zone_id>', methods=['GET'])
def get_critical(zone_id):
    try:
        critical_events = get_critical_events(zone_id)
        return jsonify(critical_events)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@replay_bp.route('/all_zones', methods=['GET'])
def get_all_zones():
    try:
        zones_path = os.path.join(PROJECT_ROOT, "config", "zones.json")
        with open(zones_path, 'r') as f:
            zones_data = json.load(f)
            
        all_timelines = {}
        for z in zones_data:
            zone_id = z.get("zone_id")
            if zone_id:
                all_timelines[zone_id] = get_replay_timeline(zone_id)
                
        return jsonify(all_timelines)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
