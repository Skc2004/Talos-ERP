from transformers import pipeline
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize the HuggingFace zero-shot sentiment analysis model
# Use a lightweight DistilBERT to conserve CPU/RAM on inference
sentiment_analyzer = pipeline(
    "sentiment-analysis", 
    model="distilbert-base-uncased-finetuned-sst-2-english",
    device=-1 # Set to 0 if a GPU is available
)

def analyze_reviews(reviews_list: list) -> dict:
    """
    Takes a list of raw text reviews scraped from Amazon/competitors
    and scores them. Aggregates the general sentiment.
    
    Expected format: [{'text': 'this product is great!', 'rating': 5.0}, ...]
    """
    if not reviews_list:
        return {"compound_score": 0.0, "total_processed": 0}
        
    texts = [r['text'] for r in reviews_list if len(r['text']) > 5] # filter empty
    if not texts:
        return {"compound_score": 0.0, "total_processed": 0}
        
    try:
        # Run batch inference
        results = sentiment_analyzer(texts)
        
        positive_count = 0
        cumulative_confidence = 0.0
        
        for res in results:
            if res['label'] == 'POSITIVE':
                positive_count += 1
                cumulative_confidence += res['score']
            else:
                cumulative_confidence -= res['score']
                
        # Normalize between -1.0 (Completely Negative) and 1.0 (Completely Positive)
        normalized_score = cumulative_confidence / len(texts)
        
        # Simple simulated YAKE Keyword Extraction (stubbed without importing heavy yake package)
        theme_simulations = {}
        if positive_count > (len(texts)/2):
            theme_simulations["Build Quality"] = "HIGH"
        else:
            theme_simulations["Durability"] = "LOW"
            
        return {
            "compound_score": round(normalized_score, 3),
            "total_processed": len(texts),
            "ratio_positive": round(positive_count / len(texts), 2),
            "themes": theme_simulations
        }
        
    except Exception as e:
        logger.error(f"Inference failed on review text: {e}")
        return {"compound_score": 0.0, "total_processed": 0, "themes": {}}

if __name__ == "__main__":
    d = [{"text": "Terrible plastic quality, broke in a day", "rating": 1},
         {"text": "Amazing value for money, fast delivery", "rating": 5}]
    print(analyze_reviews(d))
