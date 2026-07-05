import os
import sys
import json
import google.generativeai as genai

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from config import settings

def get_gemini_model():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("WARNING: GEMINI_API_KEY environment variable is not set.")
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
        return "Gemini API not configured."
        
    try:
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(max_output_tokens=max_tokens)
        )
        return response.text
    except Exception as e:
        return f"Error calling Gemini: {str(e)}"


class GeminiClient:
    def __init__(self):
        """Initialize the Gemini client using settings model"""
        self.model = get_gemini_model()
        
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
- Active Permits: {', '.join(zone_snapshot.get('permits', []))}
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
        return call_gemini(prompt, max_tokens=settings.GEMINI_MAX_TOKENS)

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
- Active Permits: {', '.join(zone_snapshot.get('permits', []))}
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
        return call_gemini(prompt, max_tokens=2048)

    def copilot_chat(self, user_message, context=None):
        """
        Perform RAG query, then respond to user questions using Gemini.
        """
        # Retrieve context from RAG
        from core.rag.retriever import retrieve
        
        search_query = user_message
        if context:
            search_query += f" zone {context.get('zone_id')} gas {context.get('gas_ppm', 0)} temp {context.get('temperature', 0)} permits {', '.join(context.get('permits', []))}"
            
        rag_results = retrieve(search_query, top_k=3)
        
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
        return call_gemini(prompt, max_tokens=1500)
