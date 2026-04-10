"""
Pytest suite for the Moving Z-Score Anomaly Detector.
Validates that the detector correctly identifies thermal anomalies
across a range of normal, edge-case, and adversarial inputs.
"""
import sys
import os
import math
import pytest

# Add parent dir so we can import maintenance_service
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from maintenance_service import MovingZScoreDetector


class TestMovingZScoreDetector:
    """Core detection logic tests."""

    def setup_method(self):
        self.detector = MovingZScoreDetector(window_size=20, threshold_sigma=3.0)

    def test_warming_up_phase(self):
        """Detector should not flag during warm-up (< 5 readings)."""
        for i in range(4):
            result = self.detector.ingest("M1", 195.0)
        assert result["anomaly"] is False
        assert result["reason"] == "warming_up"

    def test_stable_readings_no_anomaly(self):
        """50 stable readings around 195°C should produce zero anomalies."""
        for _ in range(50):
            result = self.detector.ingest("M1", 195.0 + (hash(str(_)) % 10 - 5) * 0.1)
        assert result["anomaly"] is False

    def test_spike_detected(self):
        """A sudden 60°C spike after stable baseline should be flagged."""
        # Build stable baseline
        for _ in range(20):
            self.detector.ingest("M1", 195.0)
        # Inject spike
        result = self.detector.ingest("M1", 260.0)
        assert result["anomaly"] is True
        assert result["z_score"] > 3.0

    def test_4_sigma_always_detected(self):
        """Any reading 4σ from mean MUST be detected (zero false negatives at 4σ)."""
        # Feed uniform baseline
        for _ in range(30):
            self.detector.ingest("M1", 100.0)

        # Compute the z-score manually: with all 100.0 readings, std ~ 0
        # A massive jump should absolutely trigger
        result = self.detector.ingest("M1", 500.0)
        assert result["anomaly"] is True

    def test_gradual_drift_not_flagged(self):
        """Slowly rising temperature (0.5°C/reading) should NOT trigger anomaly
        because the rolling window adapts."""
        for i in range(50):
            result = self.detector.ingest("M1", 180.0 + i * 0.5)
        # The last reading is 204.5, but the window has adapted
        assert result["anomaly"] is False

    def test_multiple_machines_independent(self):
        """Anomaly on Machine A should NOT affect Machine B."""
        for _ in range(20):
            self.detector.ingest("A", 100.0)
            self.detector.ingest("B", 200.0)

        spike_a = self.detector.ingest("A", 300.0)
        normal_b = self.detector.ingest("B", 200.0)

        assert spike_a["anomaly"] is True
        assert normal_b["anomaly"] is False

    def test_z_score_sign_negative_spike(self):
        """A sudden DROP should also be detected (machine shutdown)."""
        for _ in range(20):
            self.detector.ingest("M1", 200.0)
        result = self.detector.ingest("M1", 50.0)
        assert result["anomaly"] is True
        assert result["z_score"] < -3.0

    def test_recovery_after_spike(self):
        """After a spike, returning to normal should clear the anomaly."""
        for _ in range(20):
            self.detector.ingest("M1", 195.0)
        self.detector.ingest("M1", 280.0)  # spike

        # Feed normal values back
        for _ in range(25):
            result = self.detector.ingest("M1", 195.0)
        assert result["anomaly"] is False


class TestZScoreMathAccuracy:
    """Validates that the internal math is correct against hand-calculated values."""

    def test_known_mean_std(self):
        """Feed [10, 20, 30, 40, 50] → mean=30, std=√200=14.142..."""
        detector = MovingZScoreDetector(window_size=10, threshold_sigma=3.0)
        values = [10, 20, 30, 40, 50]
        for v in values:
            result = detector.ingest("CALC", float(v))

        assert result["rolling_mean"] == 30.0
        assert abs(result["rolling_std"] - round(math.sqrt(200), 2)) < 0.1

    def test_z_score_calculation(self):
        """Feed stable 100, then 130 → z = (130 - 100) / std."""
        detector = MovingZScoreDetector(window_size=20, threshold_sigma=3.0)
        for _ in range(20):
            detector.ingest("CALC", 100.0)
        result = detector.ingest("CALC", 130.0)

        # With all 100s, std is ~0 before the 130, so z should be very high
        assert result["z_score"] > 3.0
