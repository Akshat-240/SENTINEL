import os
import sys
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
        model_name = getattr(settings, 'GEMINI_MODEL', 'gemini-1.5-pro')
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
