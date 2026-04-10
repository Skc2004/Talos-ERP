from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from bs4 import BeautifulSoup
import time
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def scrape_amazon_reviews(asin: str, max_pages: int = 1):
    """
    Automated Grid worker (Selenium) to scrape Amazon reviews.
    Currently runs headlessly on a single process, scalable via Celery later.
    """
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64)")

    driver = webdriver.Chrome(options=chrome_options)
    all_reviews = []
    
    try:
        for page in range(1, max_pages + 1):
            url = f"https://www.amazon.in/product-reviews/{asin}/ref=cm_cr_arp_d_paging_btm_next_{page}?pageNumber={page}"
            logger.info(f"Scraping {url}")
            driver.get(url)
            time.sleep(3) # Let JS load / Avoid immediate ban
            
            soup = BeautifulSoup(driver.page_source, "html.parser")
            review_blocks = soup.find_all("div", {"data-hook": "review"})
            
            for block in review_blocks:
                review_text_el = block.find("span", {"data-hook": "review-body"})
                rating_el = block.find("i", {"data-hook": "review-star-rating"})
                
                if review_text_el and rating_el:
                    text = review_text_el.get_text(strip=True)
                    rating_str = rating_el.get_text(strip=True)
                    # Example: "4.0 out of 5 stars" -> 4.0
                    rating = float(rating_str.split(" out")[0])
                    all_reviews.append({"text": text, "rating": rating})
                    
    except Exception as e:
        logger.error(f"Scraping failed: {e}")
    finally:
        driver.quit()
        
    return all_reviews

if __name__ == "__main__":
    # Example test
    reviews = scrape_amazon_reviews("B08L5WHFT9", 1)
    for r in reviews:
        print(f"Rating {r['rating']} - {r['text'][:50]}...")
