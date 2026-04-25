from fastapi import APIRouter, UploadFile, File, BackgroundTasks
import pandas as pd
import io
from app.utils.threshold_calc import get_supabase
from app.utils.kpi_calc import generate_alerts

router = APIRouter()

def process_csv_async(content: bytes):
    df = pd.read_csv(io.BytesIO(content))
    supabase = get_supabase()
    
    # Store in DB (InventorySnapshot)
    for _, row in df.iterrows():
        # Expecting CSV columns: store_id, sku, quantity
        supabase.table('inventory_snapshot').insert({
            "store_id": str(row.get('store_id', 'UNKNOWN')),
            "sku": str(row.get('sku', 'UNKNOWN')),
            "quantity": int(row.get('quantity', 0))
        }).execute()
        
    # Trigger alerts after ingestion
    generate_alerts()

@router.post("/upload")
async def validate_file(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """
    Uploads CSV, Validates format, Stores in DB (InventorySnapshot), Triggers alerts
    """
    if not file.filename.endswith('.csv'):
        return {"error": "Only CSV files are supported"}
        
    content = await file.read()
    background_tasks.add_task(process_csv_async, content)
    
    return {"message": "CSV upload accepted. Processing started.", "filename": file.filename}
