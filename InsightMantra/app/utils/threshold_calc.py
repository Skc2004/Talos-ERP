import os
from supabase import create_client

def get_supabase():
    url = os.getenv("SUPABASE_URL", "")
    key = os.getenv("SUPABASE_KEY", "")
    if not url or not key:
        print("Warning: Supabase keys not initialized in threshold_calc.")
    return create_client(url, key)

def update_reorder_config():
    """
    1️⃣ Fetch all rows from InventorySnapshot
    2️⃣ Aggregate total quantity per SKU (simulating 30 days usage)
    3️⃣ Calculate average daily usage: avg_daily = total_qty / 30
    4️⃣ Compute safety stock: safety_stock = 0.5 * avg_daily
    5️⃣ Set lead time: lead_time = 7
    6️⃣ Calculate reorder_point = (avg_daily * lead_time) + safety_stock
    7️⃣ Set target_level = GREATEST((max_capacity * 0.8)::integer, 100)
    8️⃣ Save to DB
    """
    supabase = get_supabase()
    
    # 1. Fetch raw snapshot data
    res = supabase.table('inventory_snapshot').select('*').execute()
    snapshots = res.data

    # 2. Aggregate
    sku_aggregates = {}
    for s in snapshots:
        sku = s['sku']
        if sku not in sku_aggregates:
            sku_aggregates[sku] = 0
        sku_aggregates[sku] += s['quantity']
        
    updated_count = 0
    for sku, total_qty in sku_aggregates.items():
        # 3. Avg Daily
        avg_daily = total_qty / 30.0
        
        # 4. Safety Stock
        safety_stock = 0.5 * avg_daily
        
        # 5. Lead Time
        lead_time = 7
        
        # 6. Reorder Point
        reorder_point = (avg_daily * lead_time) + safety_stock
        
        # Determine capacity context (assuming 2000 if not set)
        # 7. Target Level
        max_capacity = 2000
        target_level = max(int(max_capacity * 0.8), 100)
        
        # 8. Upsert DB
        config_data = {
            "sku": sku,
            "avg_daily_usage": round(avg_daily, 2),
            "lead_time_days": lead_time,
            "safety_stock": round(safety_stock, 2),
            "reorder_point": round(reorder_point, 2),
            "max_capacity": max_capacity,
            "target_level": target_level
        }
        
        supabase.table('reorder_config').upsert(config_data).execute()
        updated_count += 1
        
    return updated_count
