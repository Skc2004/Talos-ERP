import os
from celery import Celery
import logging
from mcr_engine import analyze_market_competitor
from lead_scoring import score_all_leads

logger = logging.getLogger(__name__)

# ─── Broker Configuration ───
# Production: Redis (high-availability, in-memory, crash-safe)
# Local dev fallback: SQLite (no Redis required)
REDIS_URL = os.environ.get("REDIS_URL")

if REDIS_URL:
    broker_url = REDIS_URL
    result_backend = REDIS_URL
    logger.info("Celery using Redis broker: %s", REDIS_URL)
else:
    broker_url = "sqla+sqlite:///celerydb.sqlite"
    result_backend = "db+sqlite:///celeryresults.sqlite"
    logger.warning("REDIS_URL not set — falling back to SQLite broker (dev only)")

celery_app = Celery(
    "insight_mantra",
    broker=broker_url,
    backend=result_backend
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    # ─── Retry & Reliability ───
    task_acks_late=True,                 # Acknowledge task only after completion
    worker_prefetch_multiplier=1,        # Fair task distribution
    task_reject_on_worker_lost=True,     # Re-queue if worker crashes
    broker_connection_retry_on_startup=True,
)


@celery_app.task(bind=True, max_retries=3, retry_backoff=True, retry_backoff_max=300)
def async_scan_competitor(self, competitor_url: str):
    """Async competitor MCR scan with automatic retry on failure."""
    try:
        logger.info(f"Starting async MCR scan for {competitor_url}")
        result = analyze_market_competitor(competitor_url)
        return result
    except Exception as exc:
        logger.error(f"MCR scan failed for {competitor_url}: {exc}")
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=3, retry_backoff=True, retry_backoff_max=300)
def async_score_leads(self):
    """Async lead scoring with automatic retry on failure."""
    try:
        logger.info("Starting async lead scoring")
        results = score_all_leads()
        return {"scored": len(results)}
    except Exception as exc:
        logger.error(f"Lead scoring failed: {exc}")
        raise self.retry(exc=exc)
