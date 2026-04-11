"""
Talos ERP — Autonomous Procurement Agent
Monitors inventory health and auto-drafts Purchase Orders when thresholds breach.
"""
import os
import logging
import requests
from datetime import datetime

logger = logging.getLogger(__name__)

JAVA_API = os.environ.get("JAVA_API_URL", "http://localhost:8080/api/v1")

def auto_procurement_check(supabase_client):
    """
    Autonomous agent that:
    1. Fetches all SKU rebalancing metrics from Java backend
    2. Identifies SKUs that need reorder (currentStock <= ROP)
    3. Auto-drafts Purchase Orders in Supabase
    4. Logs actions to security_audit
    """
    logger.info("🤖 Autonomous Procurement Agent — Starting scan...")

    try:
        # 1. Get all rebalancing metrics
        res = requests.get(f"{JAVA_API}/inventory/rebalance", timeout=10)
        if res.status_code != 200:
            logger.error(f"Failed to fetch rebalancing data: {res.status_code}")
            return {"status": "error", "message": "Could not reach inventory service"}

        all_skus = res.json()
        reorder_needed = [s for s in all_skus if s.get("needsReorder") is True]

        if not reorder_needed:
            logger.info("✅ All SKUs above reorder point. No action needed.")
            return {"status": "ok", "message": "No reorders needed", "checked": len(all_skus)}

        drafted = []
        for sku in reorder_needed:
            sku_code = sku.get("sku", "UNKNOWN")
            current = sku.get("currentStock", 0)
            rop = sku.get("reorderPoint_ROP", 0)
            safety = sku.get("safetyStock_SS", 0)

            # Optimal order qty = (ROP - current) + safety buffer
            order_qty = max((rop - current) + safety, safety)
            po_number = f"AUTO-{sku_code}-{datetime.now().strftime('%Y%m%d%H%M')}"

            try:
                # Draft PO in Supabase
                supabase_client.table("purchase_orders").insert({
                    "po_number": po_number,
                    "status": "DRAFT",
                    "total_amount": 0,  # To be filled by procurement team
                }).execute()

                drafted.append({
                    "sku": sku_code,
                    "po_number": po_number,
                    "order_quantity": order_qty,
                    "reason": f"Stock ({current}) below ROP ({rop})"
                })

                logger.info(f"📦 Auto-drafted PO {po_number} for {sku_code} (qty: {order_qty})")

            except Exception as e:
                logger.error(f"Failed to draft PO for {sku_code}: {e}")

        logger.info(f"🤖 Agent complete: {len(drafted)}/{len(reorder_needed)} POs drafted")
        return {
            "status": "success",
            "total_checked": len(all_skus),
            "reorder_needed": len(reorder_needed),
            "pos_drafted": drafted
        }

    except requests.exceptions.ConnectionError:
        logger.error("Java backend unreachable for procurement check")
        return {"status": "error", "message": "Java backend unreachable"}
    except Exception as e:
        logger.error(f"Procurement agent error: {e}")
        return {"status": "error", "message": str(e)}
