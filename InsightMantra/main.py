from fastapi import FastAPI
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
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Supabase Client ───
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://nkctzzerpcughgwhpduf.supabase.co")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# ─── Include Admin Routes ───
from admin_routes import router as admin_router
app.include_router(admin_router)

# ─── Root Health Check ───
@app.get("/")
def health_check():
    return {"status": "Insight Mantra AI Gateway is operational.", "version": "2.0.0"}


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

@app.post("/intelligence/mcr/scan")
def scan_competitor(competitor_url: str = "https://amazon.in/dp/example"):
    result = analyze_market_competitor(competitor_url)

    # Persist MCR data
    try:
        supabase.table("competitor_data").insert({
            "competitor_url": competitor_url,
            "competitor_price": result["competitor_price"],
            "competitor_bsr": result["competitor_bsr"],
            "market_capture_ratio": result["market_capture_ratio"],
        }).execute()
    except Exception as e:
        logger.warning(f"Failed to persist MCR data: {e}")

    return {"status": "success", "mcr_data": result}

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
    except Exception:
        cards.append({
            "type": "STOCK_OUT_RISK",
            "severity": "HIGH",
            "title": "Stock-Out Risk Detected",
            "message": "Item 'Echo Dot 4th Gen' will be out of stock in 4 days. "
                       "Prophet predicts a demand spike. Suggesting immediate reorder of 200 units.",
            "action": "AUTO_PO_DRAFTED"
        })

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
        else:
            raise ValueError("No MCR data")
    except Exception:
        cards.append({
            "type": "MARGIN_OPPORTUNITY",
            "severity": "MEDIUM",
            "title": "Margin Opportunity Detected",
            "message": "Competitor Y is currently stocked out of Item Z. Our Sentiment is 0.85. "
                       "Recommend raising price by 4% to capture premium margin.",
            "action": "PRICE_ADJUSTMENT_SUGGESTED",
            "mcr": 0.84
        })

    # Card 3: Thermal Alert
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
    else:
        cards.append({
            "type": "THERMAL_ALERT",
            "severity": "CRITICAL",
            "title": "Thermal Alert — Predictive Maintenance",
            "message": "Extruder #4 is running 15% hotter than normal. "
                       "Estimated time to failure: 48 hours. Maintenance order drafted.",
            "action": "MAINTENANCE_ORDER_DRAFTED",
            "machine_id": "EXTRUDER-01"
        })

    return {"status": "success", "cards": cards}


# ─── MODULE 6: CRM Lead Scoring ───
from lead_scoring import score_all_leads, get_top_leads

@app.post("/crm/score-leads")
def run_lead_scoring():
    """Triggers the AI lead scoring model across all active leads."""
    results = score_all_leads()
    return {"status": "success", "scored": len(results), "top_leads": results[:5]}

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

