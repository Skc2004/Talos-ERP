"""
Chaos Monkey — Resilience Testing for Mantra ERP
=================================================
Simulates service failures by probing each microservice endpoint.
If a service is down, it measures how the system degrades and logs
the result to the `test_logs` table in Supabase.

Usage:
    python chaos_monkey.py
"""
import os
import time
import random
import logging
import requests
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [CHAOS] %(message)s")
logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://nkctzzerpcughgwhpduf.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

SERVICES = {
    "JAVA_CORE": {
        "name": "Inventory Maintainer (Spring Boot)",
        "health_url": "http://localhost:8080/api/v1/inventory/rebalance",
        "critical": True
    },
    "PYTHON_AI": {
        "name": "Insight Mantra (FastAPI)",
        "health_url": "http://localhost:8000/",
        "critical": True
    },
    "SUPABASE_DB": {
        "name": "Supabase Cloud (PostgreSQL)",
        "health_url": f"{SUPABASE_URL}/rest/v1/sku_master?select=id&limit=1",
        "headers": {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"},
        "critical": True
    }
}


def probe_service(service_id: str, config: dict) -> dict:
    """Probe a single service and return health status + latency."""
    start = time.time()
    try:
        headers = config.get("headers", {})
        resp = requests.get(config["health_url"], headers=headers, timeout=5)
        latency_ms = round((time.time() - start) * 1000, 2)
        status = "UP" if resp.status_code < 400 else "DEGRADED"
        return {
            "service": service_id,
            "name": config["name"],
            "status": status,
            "http_code": resp.status_code,
            "latency_ms": latency_ms,
            "critical": config["critical"]
        }
    except requests.exceptions.ConnectionError:
        return {
            "service": service_id,
            "name": config["name"],
            "status": "DOWN",
            "http_code": 0,
            "latency_ms": round((time.time() - start) * 1000, 2),
            "critical": config["critical"]
        }
    except requests.exceptions.Timeout:
        return {
            "service": service_id,
            "name": config["name"],
            "status": "TIMEOUT",
            "http_code": 0,
            "latency_ms": 5000.0,
            "critical": config["critical"]
        }


def run_chaos_sweep() -> dict:
    """Probes all services and generates a resilience report."""
    run_id = f"CHAOS-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
    logger.info(f"Starting Chaos Sweep: {run_id}")

    results = []
    for svc_id, config in SERVICES.items():
        result = probe_service(svc_id, config)
        results.append(result)

        icon = "✅" if result["status"] == "UP" else "❌"
        logger.info(f"  {icon} {result['name']}: {result['status']} ({result['latency_ms']}ms)")

    # Compute aggregate metrics
    total = len(results)
    up_count = sum(1 for r in results if r["status"] == "UP")
    down_services = [r for r in results if r["status"] != "UP"]
    avg_latency = sum(r["latency_ms"] for r in results) / total if total else 0

    system_status = "OPERATIONAL"
    if any(r["status"] != "UP" and r["critical"] for r in results):
        system_status = "DEGRADED"
    if all(r["status"] != "UP" for r in results):
        system_status = "TOTAL_FAILURE"

    report = {
        "run_id": run_id,
        "timestamp": datetime.utcnow().isoformat(),
        "system_status": system_status,
        "services_up": up_count,
        "services_total": total,
        "pass_rate": round((up_count / total) * 100, 1),
        "avg_latency_ms": round(avg_latency, 2),
        "down_services": [r["name"] for r in down_services],
        "details": results
    }

    # Log to Supabase test_logs table
    try:
        notes = f"System: {system_status}. Down: {', '.join(report['down_services']) or 'None'}"
        supabase.table("test_logs").insert({
            "run_id": run_id,
            "suite": "CHAOS",
            "total_tests": total,
            "passed": up_count,
            "failed": total - up_count,
            "pass_rate": report["pass_rate"],
            "avg_response_ms": report["avg_latency_ms"],
            "execution_time_s": round(sum(r["latency_ms"] for r in results) / 1000, 2),
            "notes": notes
        }).execute()
        logger.info(f"Results logged to Supabase: {run_id}")
    except Exception as e:
        logger.warning(f"Failed to log to Supabase: {e}")

    return report


if __name__ == "__main__":
    report = run_chaos_sweep()
    print("\n" + "=" * 60)
    print(f"  CHAOS MONKEY REPORT: {report['run_id']}")
    print(f"  System Status:  {report['system_status']}")
    print(f"  Services Up:    {report['services_up']}/{report['services_total']}")
    print(f"  Pass Rate:      {report['pass_rate']}%")
    print(f"  Avg Latency:    {report['avg_latency_ms']}ms")
    if report["down_services"]:
        print(f"  WARNING DOWN: {', '.join(report['down_services'])}")
    print("=" * 60)
