# SENTINEL — Zero Harm
## AI-Powered Industrial Safety Intelligence Platform
### ET AI Hackathon 2.0 | Problem Statement 1

> *"The data was always there. The intelligence to connect it wasn't. Until now."*

---

## The Problem
- **6,500+ fatal workplace accidents** occur in India every year (FY2023).
- **Visakhapatnam Steel Plant (January 2025):** 8 workers tragically lost their lives despite fully functioning sensors.
- **The Pattern:** The data was present, but the actionable intelligence to synthesize it was absent. Siloed sensor readings, paper-based permits, and isolated worker locations failed to trigger an emergency response until it was too late.

## Our Solution
**SENTINEL** is a next-generation safety intelligence platform that fuses IoT sensors, active work permits, worker locations, and historical incident records into a single **compound risk intelligence layer**. By analyzing dangerous intersections of data in real-time, SENTINEL acts autonomously to prevent fatalities before they occur.

---

## Key Features
1. **IoT Sensor Fusion:** Real-time ingestion and normalization of multi-modal telemetry data (Gas, Temp, Pressure).
2. **Permit-to-Work Tracking:** Dynamic cross-referencing of active permits against localized environmental hazards.
3. **Worker Location Tracing:** Spatial monitoring of worker density and exposure inside active danger zones.
4. **Compound Risk Engine:** Non-linear risk scoring evaluating multiple concurrent variables for compounding danger.
5. **Predictive Trend Analysis:** Forecasting hazard escalation using live mathematical modeling.
6. **Regulatory Shadow Twin:** Real-time, continuous compliance checking against Factory Act, OISD, and DGMS standards.
7. **Disaster DNA Similarity (RAG):** AI-powered FAISS vector matching of current conditions against historical disaster signatures.
8. **Emergency Orchestrator:** Automated suspension of high-risk permits and initiation of evacuation protocols.
9. **Automated Incident Reporting:** Auto-generated, regulatory-grade markdown reports powered by Gemini.
10. **Sentinel Copilot:** Interactive, context-aware safety intelligence assistant for incident response and queries.

---

## Tech Stack
| Component | Technology | Cost |
| :--- | :--- | :--- |
| **Frontend** | HTML5, Vanilla JavaScript, CSS3 (Custom Terminal UI) | ₹0 |
| **Backend API** | Python, Flask, RESTful endpoints | ₹0 |
| **Database** | SQLite (Live telemetry & permit states) | ₹0 |
| **Intelligence / LLM** | Google Gemini 2.0 Flash API | ₹0 |
| **Vector DB / RAG** | FAISS, Sentence Transformers (all-MiniLM-L6-v2) | ₹0 |
| **Architecture** | Component-based Micro-services | ₹0 |

---

## Architecture
Please refer to our system architecture diagram for a complete overview of the data pipelines and intelligence layers.
![Architecture Diagram](docs/architecture/architecture_diagram.png)

---

## Quick Start
Follow these steps to run the SENTINEL platform locally on your machine:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-org/sentinel-zero-harm.git
   cd sentinel-zero-harm
   ```
2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
3. **Set your Gemini API Key:**
   ```bash
   # Windows (PowerShell)
   $env:GEMINI_API_KEY="your_api_key_here"
   
   # Linux/Mac
   export GEMINI_API_KEY="your_api_key_here"
   ```
4. **Initialize and seed the database:**
   ```bash
   python data/seed_db.py
   ```
5. **Start the backend server & background intelligence threads:**
   ```bash
   python app.py
   ```
6. **Launch the platform:**
   Open [http://localhost:5000](http://localhost:5000) in your web browser.

---

## Demo Scenarios
SENTINEL includes pre-scripted scripts to showcase the system's emergency response capabilities.

**To trigger a critical scenario (Visakhapatnam simulation):**
```bash
python data/trigger_critical.py
```
*This injects a rapid escalation of toxic gas, extreme temperatures, and dangerous permit overlaps, instantly pushing the system into an EMERGENCY state.*

**To reset to normal operations:**
```bash
python data/reset_normal.py
```

---

## Team
- **Akshat** — Team Lead + Core AI Engineer
- **Anuj** — AI Intelligence Engineer  
- **Shreya** — Frontend Engineer
- **Shreta** — Data + Operations

---

## Judging Criteria Alignment

| Criteria | How SENTINEL Wins It |
| :--- | :--- |
| **Innovation & Approach** | Transcends static single-sensor thresholds by utilizing multi-modal compound risk scoring and live semantic matching (Disaster DNA) against historical tragedies. |
| **Technical Complexity** | Seamlessly fuses a live SQLite database, FAISS vector embeddings, RAG pipelines, and automated Flask microservices into a unified asynchronous intelligence layer. |
| **Practical Impact** | Directly addresses systemic industrial safety gaps with an orchestrator capable of autonomously preserving evidence and halting conflicting permits before a disaster strikes. |
| **Scalability & UX** | Operates on a highly lightweight backend with zero hosting costs, featuring a striking, zero-latency, terminal-inspired unified dashboard for incident commanders. |
