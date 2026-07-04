import os
import sys
import json

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from gemini.client import call_gemini

def ask_copilot(question, zone_context=None):
    context_str = ""
    if zone_context:
        context_str = f"\nCurrent Zone Context:\n{json.dumps(zone_context, indent=2)}\n"
        
    prompt = f"""
    You are SENTINEL Copilot, an advanced AI safety assistant for industrial plants.
    {context_str}
    Answer the user's question clearly and concisely.
    Where relevant, reference OISD, Factory Act, and DGMS regulations.
    If the question is about a specific zone, rely on the zone context provided above.
    
    User Question: {question}
    """
    
    return call_gemini(prompt, max_tokens=1500)

def ask_rag_copilot(question, rag_results, zone_context=None):
    context_str = ""
    if zone_context:
        context_str = f"\nCurrent Zone Context:\n{json.dumps(zone_context, indent=2)}\n"
        
    rag_str = "Retrieved Regulatory/Safety Documents:\n"
    for idx, res in enumerate(rag_results):
        rag_str += f"[{idx+1}] Source: {res.get('source', 'Unknown')} - {res.get('content', '')}\n"
        
    prompt = f"""
    You are SENTINEL Copilot, an advanced AI safety assistant for industrial plants.
    {context_str}
    {rag_str}
    Answer the user's question clearly and concisely. Use the retrieved documents above as the primary 
    context for your answer. Reference OISD, Factory Act, and DGMS regulations where relevant.
    
    User Question: {question}
    """
    
    return call_gemini(prompt, max_tokens=1500)
