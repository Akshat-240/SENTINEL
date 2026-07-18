import os
import sys

# Ensure project root in sys.path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from core.shadow_twin.regulatory_checker import get_compliance_status

class ComplianceAgent:
    """
    Compliance Agent (Regulatory Shadow Twin)
    Pre-screens every action against OISD / Factory Act / DGMS.
    """
    def __init__(self):
        pass

    def check_compliance(self, zone_snapshot):
        """
        Checks compliance against regulations for the given snapshot.
        """
        return get_compliance_status(zone_snapshot)
