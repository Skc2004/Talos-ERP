import os
from celery import Celery
import logging
from mcr_engine import analyze_market_competitor
from lead_scoring import score_all_leads

logger = logging.getLogger(__name__)

REDIS_URL = os.environ.get("REDIS_URL", "sqla+sqlite:///celerydb.sqlite")

celery_app = Celery(
    "insight_mantra",
    broker=REDIS_URL,
    backend="db+sqlite:///celeryresults.sqlite"
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
)

@celery_app.task(bind=True)
def async_scan_competitor(self, competitor_url: str):
    logger.info(f"Starting async MCR scan for {competitor_url}")
    result = analyze_market_competitor(competitor_url)
    # The analyze_market_competitor might persist data, or we could handle it here.
    return result

@celery_app.task(bind=True)
def async_score_leads(self):
    logger.info("Starting async lead scoring")
    results = score_all_leads()
    return {"scored": len(results)}
