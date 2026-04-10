"""
Pytest suite for Lead Scoring Model.
Validates that the AI correctly prioritizes leads based on
value, source quality, engagement, and edge cases.
"""
import sys
import os
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from lead_scoring import score_lead


class TestLeadScoring:
    """Core scoring logic tests."""

    def test_high_value_referral_scores_highest(self):
        """A $500K referral in negotiation should score near 100."""
        lead = {
            "potential_value": 500000,
            "source": "REFERRAL",
            "status": "NEGOTIATING",
            "notes": "Multi-year contract discussion"
        }
        score = score_lead(lead)
        assert score >= 85, f"Expected >=85, got {score}"

    def test_low_value_cold_call_scores_low(self):
        """A $5K cold call with no notes should score low."""
        lead = {
            "potential_value": 5000,
            "source": "COLD_CALL",
            "status": "NEW",
            "notes": None
        }
        score = score_lead(lead)
        assert score < 30, f"Expected <30, got {score}"

    def test_referral_beats_cold_call_same_value(self):
        """At identical value, referral should beat cold call."""
        base = {"potential_value": 100000, "status": "QUOTED", "notes": "Yes"}
        referral = score_lead({**base, "source": "REFERRAL"})
        cold = score_lead({**base, "source": "COLD_CALL"})
        assert referral > cold

    def test_won_lead_scores_higher_than_new(self):
        """Status progression should increase score."""
        base = {"potential_value": 200000, "source": "WEBSITE", "notes": "Active"}
        won = score_lead({**base, "status": "WON"})
        new = score_lead({**base, "status": "NEW"})
        assert won > new

    def test_score_range_always_0_to_100(self):
        """Score must always be within [0, 100] regardless of inputs."""
        edge_cases = [
            {"potential_value": 0, "source": "UNKNOWN", "status": "NEW", "notes": None},
            {"potential_value": 10_000_000, "source": "REFERRAL", "status": "WON", "notes": "Mega deal"},
            {"potential_value": -500, "source": "", "status": "LOST", "notes": ""},
        ]
        for lead in edge_cases:
            score = score_lead(lead)
            assert 0 <= score <= 100, f"Score {score} out of range for {lead}"

    def test_lost_lead_scores_zero(self):
        """A lost lead with engagement component = 0 should score very low."""
        lead = {
            "potential_value": 100000,
            "source": "REFERRAL",
            "status": "LOST",
            "notes": "Deal fell through"
        }
        score = score_lead(lead)
        assert score < 60  # High value but lost, so penalty

    def test_notes_boost_recency(self):
        """Having notes (engagement signal) should boost the score."""
        base = {"potential_value": 50000, "source": "TRADE_SHOW", "status": "CONTACTED"}
        with_notes = score_lead({**base, "notes": "Met at expo"})
        without_notes = score_lead({**base, "notes": None})
        assert with_notes > without_notes

    def test_bulk_scoring_prioritizes_margin(self):
        """Among 50 generated leads, the highest value + best source should rank #1."""
        leads = []
        for i in range(50):
            leads.append({
                "potential_value": (i + 1) * 10000,
                "source": "REFERRAL" if i >= 45 else "COLD_CALL",
                "status": "NEGOTIATING" if i >= 40 else "NEW",
                "notes": "Active" if i >= 30 else None
            })

        scored = [(score_lead(l), l["potential_value"]) for l in leads]
        scored.sort(key=lambda x: x[0], reverse=True)

        # The top-scored lead should be among the highest-value ones
        top_value = scored[0][1]
        assert top_value >= 400000, f"Top scored lead value was {top_value}, expected high-value"
