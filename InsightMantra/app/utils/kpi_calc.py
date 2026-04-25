import os
from supabase import create_client

def get_supabase():
    url = os.getenv("SUPABASE_URL", "")
    key = os.getenv("SUPABASE_KEY", "")
    return create_client(url, key)

def generate_alerts():
    """
    Checks each SKU against its thresholds.
    Triggers 'Stockout' or 'BelowThreshold' alerts and saves to the Alert table.
    """
    supabase = get_supabase()
    
    # Get current physical stocks mapped from snapshots (simulated real-time)
    res_snap = supabase.table('inventory_snapshot').select('*').execute()
    current_stocks = {}
    for s in res_snap.data:
        sku = s['sku']
        current_stocks[sku] = current_stocks.get(sku, 0) + s['quantity']
        
    # Get thresholds
    res_config = supabase.table('reorder_config').select('*').execute()
    
    alerts_generated = 0
    for config in res_config.data:
        sku = config['sku']
        qty = current_stocks.get(sku, 0)
        
        alert_msg = None
        alert_type = None
        if qty == 0:
            alert_type = 'STOCKOUT'
            alert_msg = f"Zero physical inventory for SKU {sku}. Immediate restock required."
        elif qty <= config['reorder_point']:
            alert_type = 'BELOW_THRESHOLD'
            alert_msg = f"SKU {sku} dropped to {qty}, which is below ROP ({config['reorder_point']})."
            
        if alert_msg:
            supabase.table('alert').insert({
                "alert_type": alert_type,
                "sku": sku,
                "message": alert_msg
            }).execute()
            alerts_generated += 1
            
    return alerts_generated
