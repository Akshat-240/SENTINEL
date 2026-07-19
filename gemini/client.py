import os
import sys
import json
from datetime import datetime
import google.generativeai as genai

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from config import settings

def get_gemini_model():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return None
        
    try:
        genai.configure(api_key=api_key)
        model_name = getattr(settings, 'GEMINI_MODEL', 'gemini-2.0-flash')
        model = genai.GenerativeModel(model_name)
        return model
    except Exception as e:
        print(f"Error configuring Gemini: {e}")
        return None

def call_gemini(prompt, max_tokens=1000):
    model = get_gemini_model()
    if model is None:
        return None
        
    try:
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(max_output_tokens=max_tokens)
        )
        return response.text
    except Exception as e:
        print(f"Error calling Gemini: {e}")
        return None


def mock_format_rag_response(rag_results, zone_snapshot):
    best_match = "Visakhapatnam Steel Plant 2025"
    cause = "Hot work permit issued during gas accumulation in confined space"
    outcome = "8 fatalities due to gas poisoning"
    regulation = "OISD-GDN-192"
    rule = "Hot work must be suspended immediately when gas concentration exceeds safe limits (10% LEL)"
    rec_action = "Halt all active permits and evacuate Zone A immediately."
    
    if rag_results:
        top_src = rag_results[0].get("source", "").lower()
        if "haldia" in top_src:
            best_match = "Haldia Refinery 2019"
            cause = "Electrical spark ignited vapor accumulation during night shift"
            outcome = "3 fatalities and localized explosion"
            regulation = "OISD-GDN-188"
            rule = "Electrical maintenance in explosive areas requires continuous monitoring"
            rec_action = "Halt electrical work and inspect Zone C temperature/gas trends."
        elif "jamshedpur" in top_src:
            best_match = "Jamshedpur Steel Plant 2021"
            cause = "Hot work in confined space with rising gas levels"
            outcome = "Near-miss due to manual intervention, potentially catastrophic"
            regulation = "Factory Act Section 36"
            rule = "Confined space entry requires continuous gas monitoring and automated interlocks"
            rec_action = "Revoke permit #45 and suspend confined space operations."
            
    return f"""Similar incident: {best_match}
Cause: {cause}
Outcome: {outcome}
{regulation}: {rule}
Recommended action: {rec_action}"""


def mock_generate_incident_report(zone_snapshot, rag_results, risk_factors, compound_score):
    zone_id = zone_snapshot.get("zone_id", "A")
    timestamp = zone_snapshot.get("timestamp", datetime.now().isoformat())
    gas = zone_snapshot.get("gas_ppm", 0)
    temp = zone_snapshot.get("temperature", 0)
    pressure = zone_snapshot.get("pressure", 0)
    workers = zone_snapshot.get("worker_count", 0)
    
    combs = risk_factors.get("combinations_detected", [])
    if not combs:
        combs = zone_snapshot.get("combinations_detected", [])
    
    overlap_details = "None detected."
    if combs:
        overlap_details = "The following dangerous combinations were detected:\n"
        for c in combs:
            overlap_details += f"- **{c.replace('_', ' ').title()}**\n"
            
    violations = "- **OISD-GDN-192**: Gas exceeded threshold while active permits were present.\n"
    if "hot_work" in [str(c).lower() for c in combs] or "confined_space" in [str(c).lower() for c in combs]:
        violations += "- **Factory Act Section 36**: Confined space work with elevated gas levels.\n"
        
    hist_name = "Visakhapatnam Steel Plant 2025"
    if rag_results:
        hist_name = rag_results[0].get("source", "").replace("_", " ").title()
        
    return f"""# SENTINEL Regulatory Incident Report

## 1. Executive Incident Summary
On {timestamp}, SENTINEL triggered a CRITICAL Emergency Alert for Zone {zone_id} as the compound risk score escalated to {compound_score}, exceeding the safety threshold.

## 2. Detailed Risk Factors & Sensor Readings
- **Zone ID**: Zone {zone_id}
- **Timestamp**: {timestamp}
- **Final Risk Score**: {compound_score}
- **Sensor Readings**: Gas: {gas} PPM | Temperature: {temp}°C | Pressure: {pressure} Bar
- **Personnel Density**: {workers} workers active in zone.

## 3. Compound Conditions and Dangerous Overlaps
{overlap_details}

## 4. Regulatory Violations Checked (Reference OISD, Factory Act, and DGMS)
{violations}

## 5. Historical Incident Similarity Analysis (Compare with the retrieved incidents)
Current conditions resemble the **{hist_name}** incident. Historically, unmonitored gas accumulation coupled with active work permits led to catastrophic outcomes. The current event matched the historical vector profile with high relevance.

## 6. Immediate Actions Taken by SENTINEL
- Locked all active permits in Zone {zone_id} (status set to LOCKED_EMERGENCY).
- Initiated full zone evacuation routes.
- Flagged adjacent zones with advisory warnings.
- Preserved cryptographic evidence log for compliance review.

## 7. Mandatory Prevention & Corrective Recommendations
- **Halt operations**: Do not resume work until the gas level drops below 50 PPM.
- **Ventilation check**: Inspect and clear local exhaust ventilation ducts.
- **Permit audit**: Re-evaluate the work authorization approval workflow.
"""


def mock_copilot_chat(user_message, context=None):
    msg = user_message.lower()
    
    if "hot work" in msg and "confined" in msg:
        return """Under OISD-GDN-188, conducting Hot Work inside a Confined Space simultaneously is a high-risk 'Triple Threat' scenario.
SENTINEL automatically flags this combination with a +20 compound risk bonus.
Safety rules demand that:
1. Continuous atmospheric monitoring must be maintained.
2. The permit must be immediately reviewed and locked if gas levels exceed 300 PPM.
3. Adequate ventilation must be verified before any welding or flame operations begin."""

    if "visakhapatnam" in msg or "vizag" in msg or "2025" in msg:
        return """The Visakhapatnam Steel Plant incident occurred on January 7, 2025, in Pellet Plant-2, Zone A.
- Cause: Hot work permit issued for confined space entry without continuous monitoring, leading to a gas leak.
- Outcome: 8 fatalities.
- Key violations: OISD-GDN-192 and Factory Act Section 36.
- Lesson: Compound risk (gas + permit + workers) must trigger automated shutdown and permit locking, which is why SENTINEL was built."""

    if "haldia" in msg or "2019" in msg:
        return """The Haldia Refinery explosion occurred in 2019 in the Fractionation Unit (Zone C).
- Cause: Electrical arcing ignited vapor accumulation during night shift maintenance under rising temperatures.
- Outcome: 3 fatalities.
- Key violations: OISD-GDN-188.
- Lesson: Night shift safety monitoring requires trend projection for temperature and gas PPM, as staffing levels are lower."""

    if "jamshedpur" in msg or "2021" in msg:
        return """The Jamshedpur Steel Plant incident in 2021 was a Near-Miss.
- Cause: Welding in Zone B with rising gas levels (up to 480 PPM).
- Intervention: An experienced supervisor halted the work manually.
- Lesson: Safety decisions should be automated (as in SENTINEL's permit locking) rather than depending entirely on manual intervention."""

    if "score" in msg or "calculate" in msg or "formula" in msg or "bonus" in msg:
        return """SENTINEL calculates risk using a 3-step formula:
1. Base Scores (Max 100):
   - Gas Score: Max 40 (<50 PPM = 0, 50-200 = 15, 200-500 = 25, >500 = 40)
   - Temperature Score: Max 20 (<40C = 0, 40-60 = 10, >60 = 20)
   - Permit Score: Max 20 (Any = 10, Hot Work + Confined Space = 20)
   - Worker Score: Max 10 (Workers * 2, capped at 10)
   - History Score: Max 10 (based on zone history index)
2. Compound Bonuses:
   - Hot Work + Gas > 500 PPM: +15
   - Confined Space + Gas > 300 PPM: +15
   - Workers > 3 + Temp > 60°C: +10
   - Hot Work + Confined + Gas > 300 PPM: +20
   - Electrical Permit + Gas > 200 PPM: +10
   - Night Shift + Base Score > 50: +5
3. Final Score is capped at 100."""

    from core.rag.retriever import retrieve
    try:
        rag_results = retrieve(user_message, top_k=2)
    except Exception:
        rag_results = []
    
    if rag_results:
        docs_summary = "\n".join([f"- From {r['source'].replace('_', ' ').title()}: {r['text'][:250]}..." for r in rag_results])
        return f"""Here is the information retrieved from safety regulations and incident corpus:

{docs_summary}

Based on this, it is recommended to ensure compliance with the referenced OISD guidelines and the Factory Act. Let me know if you'd like more details on these regulations."""

    return "I am SENTINEL Copilot. Ask me about OISD, Factory Act guidelines, safety thresholds, or historical incident similarity."


class GeminiClient:
    def __init__(self):
        """Initialize the Gemini client."""
        pass
        
    def format_rag_response(self, rag_results, zone_snapshot):
        """
        Format retrieved historical incidents and active conditions into a dashboard alert analysis.
        """
        incidents_str = ""
        for idx, r in enumerate(rag_results):
            incidents_str += f"Incident #{idx+1} (Source: {r['source']}):\n{r['text']}\n\n"
            
        prompt = f"""
You are an expert industrial safety auditor in an oil/gas/chemical refinery.
We have detected a high risk situation in Zone {zone_snapshot.get('zone_id')}.
Current conditions:
- Gas Concentration: {zone_snapshot.get('gas_ppm', 0)} PPM
- Temperature: {zone_snapshot.get('temperature', 0)}°C
- Active Permits: {', '.join([p.get('type', '') for p in zone_snapshot.get('active_permits', [])])}
- Worker Count: {zone_snapshot.get('worker_count', 0)}
- Shift: {zone_snapshot.get('shift_type', 'day')} shift

Retrieved similar historical incidents & regulatory guidelines:
{incidents_str}

Based on these similar incidents and current zone conditions, provide a concise, high-impact safety analysis.
Highlight the primary cause, outcome, and regulatory violations (OISD, Factory Act, or DGMS).
Provide exactly one clear, urgent recommendation for the dashboard (e.g., 'Halt permit #34 immediately' or 'Evacuate non-essential workers').

Format your response exactly like this:
Similar incident: [Name/Refinery Year]
Cause: [Brief explanation of what caused the historical incident]
Outcome: [Outcome, e.g., casualties or fire]
[Regulation, e.g., OISD 116 Section 4.2]: [The specific rule violated]
Recommended action: [Urgent actionable item for the current situation]
"""
        response_text = call_gemini(prompt, max_tokens=settings.GEMINI_MAX_TOKENS)
        if response_text is None:
            return mock_format_rag_response(rag_results, zone_snapshot)
        return response_text

    def generate_incident_report(self, zone_snapshot, rag_results, risk_factors, compound_score):
        """
        Generate a professional regulatory safety report.
        """
        incidents_str = ""
        for idx, r in enumerate(rag_results):
            incidents_str += f"Incident #{idx+1} (Source: {r['source']}):\n{r['text']}\n\n"
            
        prompt = f"""
You are a lead regulatory safety investigator. Generate a comprehensive industrial safety incident report 
for the SENTINEL platform. 

A high-risk alert was triggered:
- Zone ID: {zone_snapshot.get('zone_id')}
- Timestamp: {zone_snapshot.get('timestamp', 'N/A')}
- Final Risk Score: {compound_score}
- Active Permits: {', '.join([p.get('type', '') for p in zone_snapshot.get('active_permits', [])])}
- Sensor Conditions: Gas {zone_snapshot.get('gas_ppm', 0)} PPM, Temp {zone_snapshot.get('temperature', 0)}°C, Pressure {zone_snapshot.get('pressure', 0)} Bar
- Worker Count: {zone_snapshot.get('worker_count', 0)}

Risk Factor Breakdown:
{json.dumps(risk_factors, indent=2)}

Retrieved Historical Incidents & Regulatory Context:
{incidents_str}

Your report MUST include the following sections exactly:
1. Executive Incident Summary
2. Detailed Risk Factors & Sensor Readings
3. Compound Conditions and Dangerous Overlaps
4. Regulatory Violations Checked (Reference OISD, Factory Act, and DGMS)
5. Historical Incident Similarity Analysis (Compare with the retrieved incidents)
6. Immediate Actions Taken by SENTINEL
7. Mandatory Prevention & Corrective Recommendations

Format the output as a professional regulatory document in Markdown.
"""
        response_text = call_gemini(prompt, max_tokens=2048)
        if response_text is None:
            return mock_generate_incident_report(zone_snapshot, rag_results, risk_factors, compound_score)
        return response_text

    def copilot_chat(self, user_message, context=None):
        """
        Perform RAG query, then respond to user questions using Gemini.
        """
        # Retrieve context from RAG
        from core.rag.retriever import retrieve
        
        search_query = user_message
        if context:
            permit_types = [p.get("type", "") for p in context.get("active_permits", [])]
            search_query += f" zone {context.get('zone_id')} gas {context.get('gas_ppm', 0)} temp {context.get('temperature', 0)} permits {', '.join(permit_types)}"
        
        try:
            rag_results = retrieve(search_query, top_k=3)
        except Exception:
            rag_results = []
        
        context_str = ""
        if context:
            context_str = f"Current Zone Context:\n{json.dumps(context, indent=2)}\n\n"
            
        rag_str = "Retrieved Safety Documents/Regulations:\n"
        for idx, res in enumerate(rag_results):
            rag_str += f"[{idx+1}] Source: {res.get('source', 'Unknown')} | {res.get('text', '')}\n\n"
            
        prompt = f"""
You are SENTINEL Copilot, an advanced safety intelligence assistant for industrial manufacturing and refining plants.
{context_str}
{rag_str}
Answer the user's question clearly, concisely, and professionally. 
Use the retrieved documents above as your primary context, highlighting OISD, Factory Act, or DGMS regulations where relevant.

User Question: {user_message}
"""
        response_text = call_gemini(prompt, max_tokens=1500)
        if response_text is None:
            return mock_copilot_chat(user_message, context)
        return response_text
