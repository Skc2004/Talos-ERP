import time
import random
import os
import json
import logging
from supabase import create_client, Client

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

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

# Assuming 'IoT_telemetry' table is created in Supabase (or we just use it as logic mock)

def simulate_factory_floor():
    """
    Simulates real-time vibration and temperature telemetry from the factory floor machines.
    This pushes data continuously to Supabase, which the Executive Dashboard could pick up via Realtime subscriptions.
    """
    logger.info("Initializing Real-Time IoT Telemetry Stream...")
    
    machines = config.get("machines", [])
    anomaly_threshold = config.get("anomaly_threshold_hz", 59.0)
    
    while True:
        try:
            for machine in machines:
                payload = {
                    "machine_id": machine,
                    "vibration_hz": round(random.uniform(45.0, 60.5), 2),
                    "temp_celsius": round(random.uniform(180.0, 210.0), 2),
                    "status": "NOMINAL"
                }
                
                # If vibration spikes, mark anomaly (could trigger Kafka alert)
                if payload['vibration_hz'] > anomaly_threshold:
                    payload['status'] = "ANOMALY_DETECTED"
                    logger.warning(f"ANOMALY ON {machine}! {payload}")
                
                # Real-Time write (Uncomment when IoT table is migrated)
                # supabase.table("iot_telemetry").insert(payload).execute()
                
                logger.info(f"Published Telemetry: {json.dumps(payload)}")
                
            time.sleep(2) # 2-second real-time telemetry pulse
        except Exception as e:
            logger.error(f"Stream error: {e}")
            time.sleep(5)

if __name__ == "__main__":
    simulate_factory_floor()
