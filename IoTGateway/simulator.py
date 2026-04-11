import time
import random
import os
import json
import logging
import requests
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
PYTHON_API = os.environ.get("PYTHON_GATEWAY_URL", "http://localhost:8000")

if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
else:
    logger.warning("Supabase credentials missing, database integration will fail.")
    supabase = None

# Load Config
try:
    with open(os.path.join(os.path.dirname(__file__), "config.json")) as f:
        config = json.load(f)
except Exception as e:
    logger.warning("Could not load config.json, using fallback defaults.")
    config = {"machines": ["DEFAULT-MACHINE"], "anomaly_threshold_hz": 59.0}


def simulate_factory_floor():
    """
    Simulates real-time vibration and temperature telemetry from the factory floor machines.
    Streams live data to Supabase → picked up by DigitalTwin.tsx via Realtime subscriptions.
    On anomaly: auto-drafts a maintenance repair order.
    """
    logger.info("🏭 Initializing Real-Time IoT Telemetry Stream...")
    
    machines = config.get("machines", [])
    anomaly_threshold = config.get("anomaly_threshold_hz", 59.0)
    
    while True:
        try:
            for machine in machines:
                payload = {
                    "machine_id": machine,
                    "vibration_hz": round(random.uniform(45.0, 60.5), 2),
                    "temp_celsius": round(random.uniform(180.0, 215.0), 2),
                    "status": "NOMINAL"
                }
                
                # If vibration spikes, mark anomaly
                if payload['vibration_hz'] > anomaly_threshold:
                    payload['status'] = "ANOMALY_DETECTED"
                    logger.warning(f"🚨 ANOMALY ON {machine}! {payload}")
                    
                    # Auto-draft maintenance order
                    _draft_maintenance_order(machine, payload)
                
                # Write to Supabase (LIVE — feeds Digital Twin via Realtime)
                if supabase:
                    try:
                        supabase.table("iot_telemetry").insert(payload).execute()
                    except Exception as e:
                        logger.error(f"Failed to write telemetry: {e}")
                
                logger.info(f"📡 Telemetry: {json.dumps(payload)}")
                
            time.sleep(3)  # 3-second telemetry pulse
        except Exception as e:
            logger.error(f"Stream error: {e}")
            time.sleep(5)


def _draft_maintenance_order(machine_id: str, telemetry: dict):
    """Auto-draft a maintenance repair order when anomaly is detected."""
    if not supabase:
        return
    try:
        supabase.table("maintenance_orders").insert({
            "machine_id": machine_id,
            "order_type": "CORRECTIVE",
            "description": f"Auto-generated: Vibration {telemetry['vibration_hz']}Hz exceeds threshold. Temp: {telemetry['temp_celsius']}°C.",
            "priority": 10,
            "status": "DRAFT",
            "triggered_by": "SYSTEM",
            "estimated_downtime_hours": 4.0
        }).execute()
        logger.info(f"🔧 Maintenance order drafted for {machine_id}")
    except Exception as e:
        logger.error(f"Failed to draft maintenance order: {e}")


if __name__ == "__main__":
    simulate_factory_floor()
