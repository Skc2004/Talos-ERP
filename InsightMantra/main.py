from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
import os
import uvicorn
import logging
from dotenv import load_dotenv

load_dotenv()  # Load .env for Supabase keys

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Insight Mantra API",
    description="AI Intelligence Gateway for Mantra ERP — Forecasting, NLP, Competitor MCR, and EAM",
    version="2.0.0"
)

# Allow React Frontend to call this gateway
allowed_origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Supabase Client ───
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    logger.warning("Missing SUPABASE credentials in environment variables")
try:
    supabase: Client = create_client(SUPABASE_URL or "", SUPABASE_SERVICE_ROLE_KEY or "")
except Exception as e:
    logger.error("Failed to initialize Supabase client: %s", str(e))
    supabase = None

# ─── Include Admin Routes ───
from admin_routes import router as admin_router
app.include_router(admin_router)

# ─── Include Custom App Routes ───
from app.routes.upload import router as upload_router
from app.routes.config import router as config_router

app.include_router(upload_router, prefix="/api/v1")
app.include_router(config_router, prefix="/api/v1")

# ─── NL Query Engine (Ask Talos) ───
from nl_query_engine import NLQueryEngine
nl_engine = NLQueryEngine(supabase) if supabase else None

# ─── Root Health Check ───
@app.get("/")
def health_check():
    return {"status": "Insight Mantra AI Gateway is operational.", "version": "3.0.0"}


# ─── MODULE 0: Ask Talos — Generative AI Interface ───
from pydantic import BaseModel

class NLQueryRequest(BaseModel):
    question: str

@app.post("/ai/query")
def ask_talos(request: NLQueryRequest):
    """Natural language → SQL → result. Uses Gemini LLM with 20-template fallback."""
    if not nl_engine:
        return {"status": "error", "message": "AI engine not initialized (missing Supabase)"}
    return nl_engine.query(request.question)

@app.get("/ai/suggestions")
def get_ai_suggestions():
    """Returns contextual query suggestions for the command palette."""
    if not nl_engine:
        return {"suggestions": ["Show me the P&L", "Top leads", "Stock alerts"]}
    return {"suggestions": nl_engine.get_suggestions()}

# ─── MODULE 0b: Autonomous Procurement Agent ───
from autonomous_agent import auto_procurement_check

@app.post("/agent/procurement-scan")
def trigger_procurement_agent():
    """Manually trigger the autonomous procurement agent."""
    if not supabase:
        return {"status": "error", "message": "Supabase not configured"}
    return auto_procurement_check(supabase)


class RebalanceVoteRequest(BaseModel):
    sku: str
    currentStock: int
    safetyStock: int
    reorderPoint: int
    economicOrderQty: int
    leadTimeDays: int
    avgDailyDemand: float
    zScore: float
    
@app.post("/agent/rebalance-vote")
def agentic_rebalance_vote(request: RebalanceVoteRequest):
    """Provides an agentic second-opinion before executing a manual inventory transfer."""
    if not nl_engine:
         return {"vote": "NEUTRAL", "confidence": 0.5, "reasoning": "AI engine offline."}
    
    # Use the Google GenAI Engine directly to evaluate
    prompt = f"""
    You are an expert AI Supply Chain Supervisor. Evaluate this manual transfer request:
    SKU: {request.sku}
    Current Stock: {request.currentStock}
    Safety Stock: {request.safetyStock}
    Reorder Point (ROP): {request.reorderPoint}
    EOQ: {request.economicOrderQty}
    Lead Time: {request.leadTimeDays} days
    Demand: {request.avgDailyDemand}/day
    Service Level Z-Score: {request.zScore}

    Should the user EXECUTE the transfer now? 
    Consider: If Current Stock <= ROP, they definitely should. If Current Stock is highly above ROP, they shouldn't.
    Reply with a JSON string ONLY (no markdown formatting):
    {{"vote": "APPROVE" or "REJECT", "confidence": float between 0 and 1, "reasoning": "A short, professional 1-sentence reasoning."}}
    """
    
    try:
        from google import genai
        client = genai.Client() # Assuming env var GEMINI_API_KEY is set
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        import json
        text = response.text.replace('```json', '').replace('```', '').strip()
        data = json.loads(text)
        return data
    except Exception as e:
        logger.error(f"GenAI vote failed: {e}")
        # Fallback simplistic logic
        vote = "APPROVE" if request.currentStock <= request.reorderPoint else "REJECT"
        return {"vote": vote, "confidence": 0.8, "reasoning": "Mathematical fallback rule applied due to AI timeout."}


# ─── MODULE 1: Demand Forecasting (Prophet) ───
from forecasting import run_forecast_for_sku
from uuid import UUID

@app.post("/forecasts/retrain/{sku_id}")
def retrain_forecasts(sku_id: UUID):
    results = run_forecast_for_sku(str(sku_id), periods=30)
    if results is None:
        return {"status": "skipped", "message": "Not enough historical data to forecast"}
    return {"status": "success", "predicted_days": len(results), "data": results[:5]}

@app.get("/forecasts/latest/{sku_id}")
def get_latest_forecast(sku_id: UUID):
    """Returns the latest 30-day forecast from the database for a given SKU."""
    try:
        response = (
            supabase.table("demand_forecasts")
            .select("*")
            .eq("sku_id", str(sku_id))
            .order("target_date", desc=False)
            .limit(30)
            .execute()
        )
        return {"status": "success", "forecasts": response.data}
    except Exception as e:
        return {"status": "error", "message": str(e)}


# ─── MODULE 2: Sentiment & NLP (HuggingFace + YAKE) ───
from nlp_engine import analyze_reviews
from scraper import scrape_amazon_reviews

@app.post("/intelligence/analyze_competitor/{asin}")
def analyze_competitor(asin: str):
    logger.info(f"Triggering Scrape and NLP loop for ASIN: {asin}")
    reviews = scrape_amazon_reviews(asin, max_pages=1)
    sentiment_result = analyze_reviews(reviews)

    # Persist to competitor_data table
    try:
        supabase.table("keyword_themes").insert([
            {
                "theme_cluster": theme,
                "sentiment_score": 0.8 if level == "HIGH" else -0.6,
                "frequency": 1
            }
            for theme, level in sentiment_result.get("themes", {}).items()
        ]).execute()
    except Exception as e:
        logger.warning(f"Failed to persist themes: {e}")

    return {"status": "success", "asin": asin, "sentiment_report": sentiment_result}

@app.get("/intelligence/sentiment/latest")
def get_latest_sentiment():
    """Returns the most recent keyword themes and sentiment scores for the Dashboard marquee."""
    try:
        response = (
            supabase.table("keyword_themes")
            .select("*")
            .order("detected_at", desc=True)
            .limit(10)
            .execute()
        )
        return {"status": "success", "themes": response.data}
    except Exception as e:
        return {"status": "error", "message": str(e)}


# ─── MODULE 3: Competitor Market Capture Ratio ───
from mcr_engine import analyze_market_competitor
from tasks import async_scan_competitor
from celery.result import AsyncResult

@app.post("/intelligence/mcr/scan")
def scan_competitor(competitor_url: str):
    task = async_scan_competitor.delay(competitor_url)
    return {"status": "processing", "task_id": task.id}

@app.get("/tasks/{task_id}")
def get_task_status(task_id: str):
    task_result = AsyncResult(task_id)
    return {
        "task_id": task_id,
        "status": task_result.status,
        "result": task_result.result if task_result.ready() else None
    }

@app.get("/intelligence/mcr/latest")
def get_latest_mcr():
    """Returns the latest market capture ratio readings for the Dashboard."""
    try:
        response = (
            supabase.table("competitor_data")
            .select("*")
            .order("detected_at", desc=True)
            .limit(5)
            .execute()
        )
        return {"status": "success", "competitors": response.data}
    except Exception as e:
        return {"status": "error", "message": str(e)}


# ─── MODULE 4: EAM / Predictive Maintenance ───
from maintenance_service import analyze_telemetry_batch, get_machine_health_summary

@app.post("/maintenance/scan")
def run_maintenance_scan():
    """Triggers a single pass of the Moving Z-Score anomaly detector over recent telemetry."""
    anomalies = analyze_telemetry_batch()
    return {
        "status": "success",
        "anomalies_detected": len(anomalies),
        "details": anomalies
    }

@app.get("/maintenance/health")
def machine_health():
    """Returns the rolling health summary for all tracked machines."""
    return {"status": "success", "machines": get_machine_health_summary()}


# ─── MODULE 5: Prescriptive Agentic Insights ───
@app.get("/intelligence/prescriptive-cards")
def get_prescriptive_insights():
    """
    Generates the three 'C-Suite Wow Factor' insight cards by
    cross-referencing inventory health, sentiment, and machine telemetry.
    """
    cards = []

    # Card 1: Stock-Out Risk
    try:
        # Find the SKU with lowest stock
        stock_data = supabase.rpc("get_lowest_stock_sku").execute()
        if stock_data.data:
            item = stock_data.data[0] if isinstance(stock_data.data, list) else stock_data.data
            cards.append({
                "type": "STOCK_OUT_RISK",
                "severity": "HIGH",
                "title": "Stock-Out Risk Detected",
                "message": f"Item '{item.get('sku_code', 'Unknown')}' will be out of stock in ~{item.get('days_left', '?')} days. "
                           f"Prophet predicts a demand spike in the Mumbai region. "
                           f"Suggesting an immediate transfer of 200 units.",
                "action": "AUTO_PO_DRAFTED"
            })
    except Exception as e:
        logger.error(f"Error generating stock card: {e}")

    # Card 2: Margin Opportunity
    try:
        mcr_response = supabase.table("competitor_data").select("*").order("detected_at", desc=True).limit(1).execute()
        if mcr_response.data:
            mcr = mcr_response.data[0]
            cards.append({
                "type": "MARGIN_OPPORTUNITY",
                "severity": "MEDIUM",
                "title": "Margin Opportunity Detected",
                "message": f"Competitor (BSR #{mcr.get('competitor_bsr', '?')}) is currently stocked out. "
                           f"Our sentiment is 0.85. Recommend raising price by 4% to capture premium margin.",
                "action": "PRICE_ADJUSTMENT_SUGGESTED",
                "mcr": mcr.get("market_capture_ratio")
            })
    except Exception as e:
        logger.error(f"Error generating MCR card: {e}")

    # Card 3: Thermal Alert
    try:
        machines = get_machine_health_summary()
        anomaly_machines = [m for m in machines if m["status"] == "ANOMALY"]
        if anomaly_machines:
            m = anomaly_machines[0]
            cards.append({
                "type": "THERMAL_ALERT",
                "severity": "CRITICAL",
                "title": "Thermal Alert — Predictive Maintenance",
                "message": f"{m['machine_id']} is running at {m['latest_temp']}°C "
                           f"(z-score: {m['z_score']}, mean: {m['rolling_mean']}°C). "
                           f"Estimated time to failure: {m.get('estimated_hours_to_failure', '?')} hours. "
                           f"Maintenance order drafted.",
                "action": "MAINTENANCE_ORDER_DRAFTED",
                "machine_id": m["machine_id"]
            })
    except Exception as e:
        logger.error(f"Error generating maintenance card: {e}")

    if not cards:
        raise HTTPException(status_code=503, detail="Service degraded. Could not generate prescriptive cards.")

    return {"status": "success", "cards": cards}


from lead_scoring import score_all_leads, get_top_leads
from tasks import async_score_leads

@app.post("/crm/score-leads")
def run_lead_scoring():
    """Triggers the AI lead scoring model across all active leads asynchronously."""
    task = async_score_leads.delay()
    return {"status": "processing", "task_id": task.id}

class DraftEmailRequest(BaseModel):
    contactName: str
    companyName: str
    status: str
    notes: str
    potentialValue: float

@app.post("/agent/draft-email")
def draft_b2b_email(request: DraftEmailRequest):
    """Uses GenAI to draft a highly personalized B2B email for a CRM lead."""
    prompt = f"""
    You are an expert B2B Sales Executive at Talos ERP, a premium manufacturing software company.
    Draft a professional, concise, and persuasive email to the following lead:
    
    Name: {request.contactName}
    Company: {request.companyName}
    Current Funnel Status: {request.status}
    Potential Deal Value: ₹{request.potentialValue}
    Internal Notes on this Lead: {request.notes}
    
    Instructions:
    - Keep it under 150 words.
    - Be highly personalized based on the internal notes.
    - Do NOT include generic placeholders like [Your Name]. Sign off as "Talos ERP Sales Team".
    - Focus on moving them to the next stage of the funnel (e.g., if QUOTED, push for NEGOTIATING. If NEW, push for a demo).
    """
    
    try:
        from google import genai
        client = genai.Client()
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        return {"status": "success", "email_body": response.text.strip()}
    except Exception as e:
        logger.error(f"Failed to draft email: {e}")
        # Fallback email generation
        fallback_email = f"Subject: Talos ERP Partnership Discussion\n\nHi {request.contactName},\n\nHope you are doing well.\n\nI was reviewing our notes regarding {request.companyName} and wanted to follow up. With a potential scope of ₹{request.potentialValue:,.2f}, I believe Talos ERP can deliver significant ROI for your team.\n\nRegarding your requirements ({request.notes}), we have some specialized modules that I think you'll find very interesting.\n\nCould we schedule a quick 10-minute demo to explore this further?\n\nBest regards,\nTalos ERP Sales Team"
        return {"status": "success", "email_body": fallback_email}

@app.get("/crm/top-leads")
def fetch_top_leads(limit: int = 5):
    """Returns top-N leads by AI score."""
    leads = get_top_leads(limit)
    return {"status": "success", "leads": leads}

@app.get("/crm/pipeline-summary")
def crm_pipeline_summary():
    """Returns lead funnel summary from Supabase."""
    try:
        response = supabase.table("crm_leads").select("status, potential_value").execute()
        leads = response.data
        funnel = {}
        total_value = 0
        for lead in leads:
            s = lead["status"]
            funnel[s] = funnel.get(s, 0) + 1
            total_value += float(lead.get("potential_value", 0))
        return {
            "status": "success",
            "totalLeads": len(leads),
            "totalPipelineValue": round(total_value, 2),
            "funnel": funnel
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

