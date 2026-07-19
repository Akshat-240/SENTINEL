import os
import sys

# Ensure project root in sys.path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from agents.sensor_agent import SensorAgent
from agents.permit_agent import PermitAgent
from agents.compliance_agent import ComplianceAgent
from core.risk_engine.risk_calculator import calculate_risk

class CoordinatorAgent:
    """
    Coordinator Agent
    Combines all agent outputs.
    Decides compound risk.
    Triggers alert.
    """
    def __init__(self):
        self.sensor_agent = SensorAgent()
        self.permit_agent = PermitAgent()
        self.compliance_agent = ComplianceAgent()

    def coordinate(self, zone_snapshot):
        """
        Coordinates all agent outputs, evaluates compound risk, and decides final status.
        """
        # Run sub-agents
        anomalies = self.sensor_agent.inspect_zone(zone_snapshot)
        permit_eval = self.permit_agent.evaluate_permits(zone_snapshot)
        compliance = self.compliance_agent.check_compliance(zone_snapshot)
        
        # Calculate overall risk score
        risk_result = calculate_risk(zone_snapshot)
        final_score = risk_result.get("final_score", 0)
        alert_level = risk_result.get("alert_level", {})
        
        return {
            "zone_id": zone_snapshot.get("zone_id"),
            "risk_score": final_score,
            "alert_level": alert_level.get("level"),
            "alert_action": alert_level.get("action"),
            "alert_emoji": alert_level.get("emoji"),
            "sensor_anomalies": anomalies,
            "permit_block": permit_eval.get("block"),
            "permit_overlaps": permit_eval.get("overlaps"),
            "regulatory_compliant": compliance.get("compliant"),
            "violations_count": compliance.get("violations_count"),
            "violations": compliance.get("violations")
        }
