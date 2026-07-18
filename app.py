import os
import sys
import time
import sqlite3
import threading
import traceback
from flask import Flask, jsonify, render_template
from flask_cors import CORS

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from config import settings
from api.routes_dashboard import dashboard_bp
from api.routes_risk import risk_bp
from api.routes_replay import replay_bp
from api.routes_permits import permits_bp
from api.routes_rag import rag_bp
from api.routes_report import report_bp

from core.risk_engine.risk_calculator import calculate_all_zones
from core.fusion.data_fusion import get_zone_snapshot
from core.replay.replay_engine import log_snapshot
from core.orchestrator.emergency import trigger_emergency_response

def init_db():
    db_path = os.path.join(PROJECT_ROOT, settings.DATABASE_PATH)
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS sensor_readings (
                id INTEGER PRIMARY KEY AUTOINCREMENT, 
                zone_id TEXT, 
                timestamp TEXT, 
                gas_ppm REAL, 
                temperature REAL, 
                pressure REAL
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS permits (
                id INTEGER PRIMARY KEY AUTOINCREMENT, 
                permit_id TEXT, 
                zone_id TEXT,
                type TEXT, 
                status TEXT, 
                worker_id TEXT, 
                created_at TEXT
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS worker_locations (
                id INTEGER PRIMARY KEY AUTOINCREMENT, 
                worker_id TEXT,
                zone_id TEXT, 
                entry_time TEXT, 
                status TEXT
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS cctv_feed (
                id INTEGER PRIMARY KEY AUTOINCREMENT, 
                zone_id TEXT,
                timestamp TEXT, 
                worker_count INTEGER, 
                ppe_compliant_count INTEGER
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS zone_alerts (
                zone_id TEXT, 
                alert_type TEXT, 
                severity TEXT, 
                message TEXT, 
                timestamp TEXT
            )
        ''')
        
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
            )
        ''')
        
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
            )
        ''')
        
        conn.commit()
    except Exception as e:
        print(f"Error initializing DB: {e}")
    finally:
        if 'conn' in locals() and conn:
            conn.close()

def background_task():
    while True:
        try:
            zone_results = calculate_all_zones()
            for risk_result in zone_results:
                zone_id = risk_result.get("zone_id")
                if not zone_id:
                    continue
                    
                snapshot = get_zone_snapshot(zone_id)
                log_snapshot(zone_id, snapshot, risk_result)
                
                final_score = risk_result.get("final_score", 0)
                if final_score >= settings.ORCHESTRATOR_TRIGGER:
                    trigger_emergency_response(zone_id, risk_result)
        except Exception as e:
            print(f"Background thread error: {e}")
            traceback.print_exc()
            
        time.sleep(30)

def main():
    app = Flask(__name__,
        template_folder='frontend/templates',
        static_folder='frontend/static')
    app.config['TEMPLATES_AUTO_RELOAD'] = True
    CORS(app)
    
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(risk_bp)
    app.register_blueprint(replay_bp)
    app.register_blueprint(permits_bp)
    app.register_blueprint(rag_bp)
    app.register_blueprint(report_bp)

    @app.route('/')
    def index():
        return render_template('index.html')

    @app.route('/index.html')
    def index_html():
        return render_template('index.html')

    @app.route('/heatmap.html')
    def heatmap():
        return render_template('heatmap.html')

    @app.route('/workers.html')
    def workers():
        return render_template('workers.html')

    @app.route('/permits.html')
    def permits():
        return render_template('permits.html')

    @app.route('/replay.html')
    def replay():
        return render_template('replay.html')

    @app.route('/report.html')
    def report():
        return render_template('report.html')

    @app.route('/copilot.html')
    def copilot():
        return render_template('copilot.html')

    init_db()
    
    bg_thread = threading.Thread(target=background_task, daemon=True)
    bg_thread.start()
    
    app.run(host="0.0.0.0", port=5000, debug=False)

if __name__ == "__main__":
    main()
