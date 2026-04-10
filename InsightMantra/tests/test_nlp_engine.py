"""
Pytest suite for NLP Sentiment Analysis.
Validates edge cases and accuracy of the DistilBERT pipeline wrapper.
"""
import sys
import os
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


class TestSentimentAnalysis:
    """Tests for the analyze_reviews function."""

    def test_empty_input_returns_zero(self):
        from nlp_engine import analyze_reviews
        result = analyze_reviews([])
        assert result["compound_score"] == 0.0
        assert result["total_processed"] == 0

    def test_short_text_filtered(self):
        """Reviews shorter than 5 chars should be filtered out."""
        from nlp_engine import analyze_reviews
        result = analyze_reviews([{"text": "ok", "rating": 3}])
        assert result["total_processed"] == 0

    def test_positive_review_positive_score(self):
        """A clearly positive review should yield positive compound_score."""
        from nlp_engine import analyze_reviews
        result = analyze_reviews([
            {"text": "This product is absolutely amazing and wonderful!", "rating": 5}
        ])
        assert result["compound_score"] > 0

    def test_negative_review_negative_score(self):
        """A clearly negative review should yield negative compound_score."""
        from nlp_engine import analyze_reviews
        result = analyze_reviews([
            {"text": "Terrible quality, broke immediately, complete waste of money.", "rating": 1}
        ])
        assert result["compound_score"] < 0

    def test_themes_key_always_present(self):
        """Output must always contain 'themes' key regardless of input."""
        from nlp_engine import analyze_reviews
        result = analyze_reviews([
            {"text": "decent product overall", "rating": 3}
        ])
        assert "themes" in result

    def test_batch_processing(self):
        """Multiple reviews should all be processed."""
        from nlp_engine import analyze_reviews
        reviews = [
            {"text": "Great battery life and fast shipping", "rating": 5},
            {"text": "Poor build quality and flimsy plastic", "rating": 1},
            {"text": "Average product nothing special", "rating": 3},
        ]
        result = analyze_reviews(reviews)
        assert result["total_processed"] == 3
        assert 0 <= result["ratio_positive"] <= 1.0
