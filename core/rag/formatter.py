"""
SENTINEL — RAG Formatter
Purpose: Combine retrieval results with Gemini formatting
Creates the final output that goes to the dashboard
"""

import os
import sys
import logging
from typing import Dict, List, Optional

# Resolve project root
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from core.rag.retriever import RAGRetriever
from gemini.client import GeminiClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class RAGFormatter:
    def __init__(self):
        """Initialize formatter with retriever and Gemini client"""
        self.retriever = RAGRetriever()
        self.gemini = GeminiClient()
        logger.info("✅ RAG Formatter initialized")
    
    def format_for_dashboard(self, zone_snapshot: Dict, risk_score: float) -> Dict:
        """
        Main entry point: Create dashboard-ready output
        
        Called when risk_score > 75 (per design doc)
        
        Args:
            zone_snapshot: Current zone conditions
            risk_score: Compound risk score (0-100)
        
        Returns:
            dict: Dashboard-ready output with:
                {
                    "analysis_text": "...",
                    "similar_incidents": [...],
                    "action_items": [...],
                    "regulatory_flags": [...]
                }
        """
        logger.info(f"📊 Formatting for dashboard | Zone: {zone_snapshot.get('zone_id')} | Score: {risk_score}")
        
        # Retrieve similar incidents
        rag_results = self.retriever.retrieve(zone_snapshot, top_k=3)
        
        # Format with Gemini
        if rag_results:
            analysis = self.gemini.format_rag_response(rag_results, zone_snapshot)
        else:
            analysis = "No similar incidents found. Maintain heightened alert status."
        
        # Build dashboard output
        output = {
            "status": "ANALYSIS_COMPLETE",
            "zone_id": zone_snapshot.get("zone_id"),
            "risk_score": risk_score,
            "analysis_text": analysis,
            "similar_incidents": [
                {
                    "rank": r["rank"],
                    "incident_name": r["source"].replace("_", " ").title(),
                    "relevance_percent": int(r["similarity_score"] * 100),
                    "excerpt": r["text"][:150] + "..."
                }
                for r in rag_results[:3]
            ],
            "action_items": self._extract_action_items(analysis),
            "regulatory_flags": self._check_regulatory_violations(zone_snapshot)
        }
        
        return output
    
    def format_for_incident_report(self, 
                                   zone_snapshot: Dict,
                                   risk_factors: Dict,
                                   compound_score: float,
                                   timeline: Optional[List] = None) -> Dict:
        """
        Create incident report with RAG context
        
        Called when risk_score > 85 (trigger + report)
        
        Args:
            zone_snapshot: Zone state at trigger
            risk_factors: Factor breakdown
            compound_score: Final risk score
            timeline: Optional event timeline
        
        Returns:
            dict: Comprehensive incident report
        """
        logger.info(f"📋 Generating incident report | Zone: {zone_snapshot.get('zone_id')} | Score: {compound_score}")
        
        # Get similar incidents
        rag_results = self.retriever.retrieve(zone_snapshot, top_k=3)
        
        # Generate via Gemini
        gemini_report = self.gemini.generate_incident_report(
            zone_snapshot,
            rag_results,
            risk_factors,
            compound_score
        )
        
        # Combine with SENTINEL metadata
        report = {
            "report_type": "INCIDENT_TRIGGER",
            "zone_id": zone_snapshot.get("zone_id"),
            "risk_score_final": compound_score,
            "timestamp": zone_snapshot.get("timestamp", ""),
            
            # Gemini-generated content
            "gemini_analysis": gemini_report,
            
            # SENTINEL-specific sections
            "zone_conditions": zone_snapshot,
            "risk_breakdown": risk_factors,
            "historical_context": self._format_incident_context(rag_results),
            
            # Evidence
            "event_timeline": timeline or [],
            "evidence": {
                "conditions": zone_snapshot,
                "factors": risk_factors
            },
            
            # Regulatory
            "regulatory_violations": self._identify_violations(zone_snapshot),
            
            # Emergency actions
            "emergency_actions_taken": [
                "All permits for affected zone suspended",
                "Evacuation route displayed",
                "Emergency team notified",
                "Evidence log preserved",
                "Incident replay timeline created"
            ]
        }
        
        return report
    
    def format_for_copilot(self, user_message: str, context: Optional[Dict] = None) -> Dict:
        """
        Format copilot response with context
        
        Args:
            user_message: User question
            context: Optional zone/incident context
        
        Returns:
            dict: Formatted copilot response
        """
        response = self.gemini.copilot_chat(user_message, context)
        
        return {
            "question": user_message,
            "answer": response,
            "context_zone": context.get("zone_id") if context else None
        }
    
    def _extract_action_items(self, analysis_text: str) -> List[str]:
        """Extract actionable items from analysis text"""
        actions = []
        
        # Simple keyword extraction
        keywords = [
            ("suspend", "Suspend operations"),
            ("evacuate", "Initiate evacuation"),
            ("monitor", "Increase monitoring"),
            ("halt", "Halt operations"),
            ("check", "Verify conditions"),
            ("contact", "Contact emergency team"),
            ("review", "Review permits")
        ]
        
        text_lower = analysis_text.lower()
        for keyword, action in keywords:
            if keyword in text_lower:
                actions.append(action)
        
        return actions[:3]  # Top 3 actions
    
    def _check_regulatory_violations(self, zone_snapshot: Dict) -> List[Dict]:
        """Identify potential regulatory violations"""
        violations = []
        
        gas = zone_snapshot.get("gas_ppm", 0)
        temp = zone_snapshot.get("temperature", 0)

        permits = zone_snapshot.get("permits")
        if permits is None:
            permits = [p.get("type", "").lower().replace(" ", "_") for p in zone_snapshot.get("active_permits", [])]
        shift = zone_snapshot.get("shift_type", "")
        
        # OISD violations
        if "hot_work" in permits and gas > 500:
            violations.append({
                "code": "OISD-GDN-192",
                "severity": "CRITICAL",
                "description": "Hot work not suspended when gas exceeds 500 PPM",
                "remedy": "Suspend hot work permit immediately"
            })
        
        if "hot_work" in permits and "confined_space" in permits:
            violations.append({
                "code": "OISD-GDN-188",
                "severity": "CRITICAL",
                "description": "Confined space + hot work combination detected",
                "remedy": "Revoke both permits or request exemption review"
            })
        
        if "confined_space" in permits and gas > 300:
            violations.append({
                "code": "Factory Act Section 36",
                "severity": "HIGH",
                "description": "Confined space entry with elevated gas levels",
                "remedy": "Increase monitoring, prepare rescue team"
            })
        
        # Night shift enhanced monitoring
        if str(shift).upper() == "NIGHT" and gas > 200:
            violations.append({
                "code": "DGMS Circular 2019",
                "severity": "MEDIUM",
                "description": "Night shift with elevated hazard conditions",
                "remedy": "Increase supervision and monitoring frequency"
            })
        
        return violations
    
    def _format_incident_context(self, rag_results: List[Dict]) -> Dict:
        """Format RAG results as incident context"""
        if not rag_results:
            return {"status": "No similar incidents found"}
        
        return {
            "similar_incidents": [
                {
                    "incident": r["source"],
                    "relevance": f"{r['similarity_score']*100:.1f}%",
                    "key_details": r["text"][:300]
                }
                for r in rag_results[:3]
            ],
            "prevention_learned": self._extract_lessons(rag_results)
        }
    
    def _extract_lessons(self, rag_results: List[Dict]) -> List[str]:
        """Extract prevention lessons from incidents"""
        lessons = []
        
        for r in rag_results[:2]:
            source = r["source"].lower()
            
            if "visakhapatnam" in source:
                lessons.append("Integrate sensor alerts with permit system before approval")
            if "haldia" in source:
                lessons.append("Monitor and trend temperature in conjunction with gas levels")
            if "jamshedpur" in source:
                lessons.append("Automate halt decisions instead of relying on manual intervention")
        
        if not lessons:
            lessons.append("Maintain continuous real-time hazard monitoring")
        
        return lessons
    
    def _identify_violations(self, zone_snapshot: Dict) -> List[Dict]:
        """Identify OISD, Factory Act, DGMS violations"""
        return self._check_regulatory_violations(zone_snapshot)


# Integration with Flask API
# Usage in Flask route:
#
# @app.route('/api/rag_analysis', methods=['POST'])
# def rag_analysis():
#     data = request.json
#     zone_snapshot = data.get('zone_snapshot')
#     risk_score = data.get('risk_score')
#     
#     formatter = RAGFormatter()
#     output = formatter.format_for_dashboard(zone_snapshot, risk_score)
#     
#     return jsonify(output)


if __name__ == "__main__":
    formatter = RAGFormatter()
    
    # Test scenario
    test_zone = {
        "zone_id": "A",
        "gas_ppm": 450,
        "temperature": 62,
        "permits": ["hot_work", "confined_space"],
        "worker_count": 4,
        "shift_type": "day",
        "timestamp": "2025-07-11T09:30:00Z"
    }
    
    test_factors = {
        "gas_score": 25,
        "temp_score": 10,
        "permit_score": 20,
        "worker_score": 8,
        "compound_bonus": 20,
        "total": 83
    }
    
    # Test dashboard formatting
    print("=" * 70)
    print("DASHBOARD FORMATTING TEST")
    print("=" * 70)
    dashboard = formatter.format_for_dashboard(test_zone, 83)
    print("\n📊 Dashboard Output:")
    for key, value in dashboard.items():
        if key != "analysis_text":
            print(f"  {key}: {value}")
    print(f"\n  Analysis: {dashboard['analysis_text'][:200]}...")
    
    # Test incident report
    print("\n" + "=" * 70)
    print("INCIDENT REPORT TEST")
    print("=" * 70)
    report = formatter.format_for_incident_report(test_zone, test_factors, 88)
    print(f"Report Type: {report['report_type']}")
    print(f"Zone: {report['zone_id']}")
    print(f"Risk Score: {report['risk_score_final']}")
    print(f"Violations Found: {len(report['regulatory_violations'])}")
    for v in report['regulatory_violations']:
        print(f"  - {v['code']}: {v['severity']}")
    
    # Test copilot
    print("\n" + "=" * 70)
    print("COPILOT TEST")
    print("=" * 70)
    copilot = formatter.format_for_copilot(
        "What should we do if hot work and confined space overlap?",
        context=test_zone
    )
    print(f"Q: {copilot['question']}")
    print(f"A: {copilot['answer'][:200]}...")