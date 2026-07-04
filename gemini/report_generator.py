import os
import sys
import json
from datetime import datetime

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from gemini.client import call_gemini

def generate_incident_report(zone_id, risk_result, evidence, evacuation_route):
    timestamp = datetime.now().isoformat()
    final_score = risk_result.get("final_score", 0)
    alert_level = risk_result.get("alert_level", {}).get("level", "UNKNOWN")
    combs = risk_result.get("combinations_detected", [])
    base_scores = json.dumps(risk_result.get("base_scores", {}), indent=2)
    
    evidence_id = evidence.get("evidence_id") if evidence else "N/A"
    route_details = json.dumps(evacuation_route, indent=2) if evacuation_route else "Not triggered"
    
    prompt = f"""
    You are an expert industrial safety auditor. Generate a formal industrial safety incident report 
    for the SENTINEL - Zero Harm intelligence system.
    
    Incident Details:
    - Zone ID: {zone_id}
    - Timestamp: {timestamp}
    - Final Risk Score: {final_score}
    - Alert Level: {alert_level}
    
    Compound Risk Combinations Detected: 
    {', '.join(combs) if combs else 'None'}
    
    Base Score Breakdown:
    {base_scores}
    
    Evidence Reference ID: {evidence_id}
    
    Evacuation Route Details:
    {route_details}
    
    Your report MUST include the following sections exactly:
    1. Incident Summary
    2. Risk Factors Identified
    3. Compound Conditions Detected
    4. Regulatory Violations (reference OISD and Factory Act)
    5. Immediate Actions Taken
    6. Recommended Follow-up Actions
    7. Evidence Reference
    
    Format the output as a professional regulatory document in Markdown.
    """
    
    return call_gemini(prompt, max_tokens=2048)
