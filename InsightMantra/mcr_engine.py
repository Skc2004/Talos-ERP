from bs4 import BeautifulSoup
import requests
import random
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def calculate_mcr(our_rank: int, comp_ranks: list) -> float:
    """ Market Capture Ratio = our_rank / (our_rank + sum(top_5_competitors)) """
    total_market_velocity = our_rank + sum(comp_ranks[:5])
    if total_market_velocity == 0: return 0.0
    return round((our_rank / total_market_velocity), 3)

def analyze_market_competitor(competitor_url: str):
    """
    Scrapes a competitor page (mocked here due to captchas in headless)
    to parse their BSR and Pricing.
    """
    logger.info(f"Targeting Competitor URL: {competitor_url}")
    
    # In live, we'd use rotating proxies via Selenium.
    # We will simulate the extraction result for the pipeline.
    extracted_price = round(random.uniform(19.99, 49.99), 2)
    extracted_bsr = random.randint(100, 5000)
    
    # Calculate MCR Assuming our BSR is 1500
    our_bsr = 1500 
    mcr = calculate_mcr(our_bsr, [extracted_bsr])
    
    data = {
        "competitor_price": extracted_price,
        "competitor_bsr": extracted_bsr,
        "market_capture_ratio": mcr
    }
    
    logger.info(f"MCR Computed: {data}")
    return data
