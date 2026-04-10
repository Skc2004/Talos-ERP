"""
Lead Scoring Model — AI-Powered Lead Prioritization
=====================================================
Scores leads based on:
  - Potential value (higher = better)
  - Source quality (referrals > website > cold calls)
  - Company size signal (company name length as proxy)
  - Current factory load (if capacity is tight, prioritize high-margin leads)

Output: Score 0-100, where 100 = highest priority lead.
"""
import os
import json
import logging
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
else:
    logger.warning("Supabase credentials missing in lead_scoring.py")

# Load Business Rules
try:
    with open(os.path.join(os.path.dirname(__file__), "business_rules.json")) as f:
        RULES = json.load(f)["lead_scoring"]
except Exception as e:
    logger.error("Failed to load business_rules.json, using defaults.")
    RULES = {
        "source_weights": {"COLD_CALL": 0.5},
        "components": {"value_weight": 0.45, "source_weight": 0.25, "recency_weight": 0.15, "engagement_weight": 0.15},
        "max_expected_value": 500000.0,
        "status_scores": {"NEW": 20}
    }

def score_lead(lead: dict) -> float:
    """
    Computes a composite AI score (0-100) for a single lead using business rules.
    """
    comps = RULES["components"]
    
    # 1. Value Component
    max_value = RULES.get("max_expected_value", 500000.0)
    value = float(lead.get("potential_value", 0))
    value_component = min(100, (value / max_value) * 100)

    # 2. Source Quality Component
    source = lead.get("source", "COLD_CALL")
    source_weight = RULES["source_weights"].get(source, 0.5)
    source_component = source_weight * 100

    # 3. Recency Component
    recency_component = 70 if lead.get("notes") else 30

    # 4. Engagement signal
    engagement_component = RULES["status_scores"].get(lead.get("status", "NEW"), 20)

    # Weighted composite
    score = (
        value_component * comps.get("value_weight", 0.45) +
        source_component * comps.get("source_weight", 0.25) +
        recency_component * comps.get("recency_weight", 0.15) +
        engagement_component * comps.get("engagement_weight", 0.15)
    )

    return round(min(100, max(0, score)), 2)


def score_all_leads() -> list:
    """
    Fetches all non-closed leads from Supabase, scores them,
    and writes the AI score back to the database.
    """
    try:
        response = supabase.table("crm_leads").select("*").neq("status", "LOST").execute()
        leads = response.data
    except Exception as e:
        logger.error(f"Failed to fetch leads: {e}")
        return []

    scored = []
    for lead in leads:
        ai_score = score_lead(lead)
        scored.append({
            "id": lead["id"],
            "contact_name": lead["contact_name"],
            "company_name": lead.get("company_name"),
            "potential_value": lead.get("potential_value"),
            "status": lead.get("status"),
            "ai_score": ai_score
        })

        # Write score back to Supabase
        try:
            supabase.table("crm_leads").update({"ai_score": ai_score}).eq("id", lead["id"]).execute()
        except Exception as e:
            logger.warning(f"Failed to update score for {lead['id']}: {e}")

    # Sort by score descending
    scored.sort(key=lambda x: x["ai_score"], reverse=True)
    logger.info(f"Scored {len(scored)} leads. Top: {scored[0]['contact_name']} ({scored[0]['ai_score']})")
    return scored


def get_top_leads(limit: int = 5) -> list:
    """Returns the top-N leads by AI score directly from the database."""
    try:
        response = (
            supabase.table("crm_leads")
            .select("*")
            .neq("status", "LOST")
            .order("ai_score", desc=True)
            .limit(limit)
            .execute()
        )
        return response.data
    except Exception as e:
        logger.error(f"Failed to fetch top leads: {e}")
        return []


if __name__ == "__main__":
    results = score_all_leads()
    print(f"\n{'='*60}")
    print(f"  LEAD SCORING RESULTS ({len(results)} leads)")
    print(f"{'='*60}")
    for r in results:
        print(f"  [{r['ai_score']:5.1f}] {r['contact_name']} ({r['company_name']}) - ${r['potential_value']:,.0f} [{r['status']}]")
