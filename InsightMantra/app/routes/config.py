from fastapi import APIRouter
from app.utils.threshold_calc import update_reorder_config

router = APIRouter()

@router.post("/recalc_thresholds")
def recalc_thresholds():
    """
    API endpoint to trigger threshold calculations manually
    """
    count = update_reorder_config()
    return {"message": "Thresholds recalculated", "skus_updated": count}
