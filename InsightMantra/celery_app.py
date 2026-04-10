from celery import Celery
import os
import logging
from scraper import scrape_amazon_reviews
from nlp_engine import analyze_reviews

logger = logging.getLogger(__name__)

# Relying on Redis instance
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

app = Celery("mantra_tasks", broker=REDIS_URL, backend=REDIS_URL)

app.conf.update(
    task_serializer='json',
    accept_content=['json'], 
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
)

@app.task
def execute_nightly_intelligence_loop(asin: str):
    """
    Decoupled task that scrapes and runs heavy NLP processing without blocking the API.
    """
    logger.info(f"Celery Worker started for ASIN: {asin}")
    reviews = scrape_amazon_reviews(asin, max_pages=3)
    sentiment = analyze_reviews(reviews)
    
    # Post results to Supabase (Normally done here)
    logger.info(f"Task Completed. Sentiment results: {sentiment}")
    return sentiment
