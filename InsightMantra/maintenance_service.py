import os
import math
import requests
import logging
from collections import deque
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://nkctzzerpcughgwhpduf.supabase.co")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

JAVA_BACKEND_URL = os.environ.get("JAVA_BACKEND_URL", "http://localhost:8080")

# ─── Moving Z-Score Anomaly Detector ───
# Detects when a machine's reading deviates > 3σ from its rolling mean.

class MovingZScoreDetector:
    """
    Maintains a rolling window of readings per machine.
    Computes the mean and standard deviation on the fly.
    Flags an anomaly when the latest reading exceeds threshold_sigma.
    """
    def __init__(self, window_size: int = 50, threshold_sigma: float = 3.0):
        self.window_size = window_size
        self.threshold_sigma = threshold_sigma
        self.windows: dict[str, deque] = {}   # machine_id → deque of readings

    def ingest(self, machine_id: str, value: float) -> dict:
        if machine_id not in self.windows:
            self.windows[machine_id] = deque(maxlen=self.window_size)

        window = self.windows[machine_id]
        window.append(value)

        if len(window) < 5:
            return {"anomaly": False, "reason": "warming_up"}

        mean = sum(window) / len(window)
        variance = sum((x - mean) ** 2 for x in window) / len(window)
        std_dev = math.sqrt(variance) if variance > 0 else 0.001

        z_score = (value - mean) / std_dev

        is_anomaly = abs(z_score) > self.threshold_sigma

        return {
            "machine_id": machine_id,
            "value": value,
            "rolling_mean": round(mean, 2),
            "rolling_std": round(std_dev, 2),
            "z_score": round(z_score, 2),
            "threshold": self.threshold_sigma,
            "anomaly": is_anomaly
        }


# Global detector instance
detector = MovingZScoreDetector(window_size=50, threshold_sigma=3.0)


def analyze_telemetry_batch():
    """
    Pulls the latest IoT telemetry from Supabase and runs each reading
    through the Moving Z-Score detector.
    Returns a list of anomaly events.
    """
    logger.info("Executing EAM Maintenance Anomaly Detection Pass...")

    try:
        response = (
            supabase.table("iot_telemetry")
            .select("*")
            .order("recorded_at", desc=True)
            .limit(30)
            .execute()
        )
        rows = response.data
    except Exception as e:
        logger.error(f"Failed to fetch telemetry from Supabase: {e}")
        rows = []

    anomalies = []
    for row in rows:
        machine_id = row["machine_id"]
        temp = float(row["temp_celsius"])

        result = detector.ingest(machine_id, temp)

        if result["anomaly"]:
            logger.warning(
                f"THERMAL ANOMALY on {machine_id}: "
                f"{temp}°C (z={result['z_score']}, μ={result['rolling_mean']}, σ={result['rolling_std']})"
            )
            anomalies.append(result)

            # Ping Java backend to throttle production priority
            try:
                requests.post(
                    f"{JAVA_BACKEND_URL}/api/v1/maintenance/throttle/{machine_id}",
                    timeout=5
                )
                logger.info(f"Throttle signal sent to Java Core for {machine_id}")
            except Exception:
                logger.warning(f"Java Core not reachable, throttle deferred for {machine_id}")

    return anomalies


def get_machine_health_summary() -> list:
    """
    Returns a compact health summary for every tracked machine.
    Used by the Dashboard's Digital Twin panel.
    """
    summary = []
    for machine_id, window in detector.windows.items():
        if len(window) < 2:
            continue
        mean = sum(window) / len(window)
        variance = sum((x - mean) ** 2 for x in window) / len(window)
        std_dev = math.sqrt(variance) if variance > 0 else 0.001
        latest = window[-1]
        z = (latest - mean) / std_dev

        summary.append({
            "machine_id": machine_id,
            "latest_temp": round(latest, 1),
            "rolling_mean": round(mean, 1),
            "rolling_std": round(std_dev, 2),
            "z_score": round(z, 2),
            "status": "ANOMALY" if abs(z) > detector.threshold_sigma else "NOMINAL",
            "estimated_hours_to_failure": max(0, round(48 - (abs(z) * 12), 1)) if abs(z) > 2 else None
        })

    return summary
