from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel
from typing import Optional
import os
from supabase import create_client, Client

router = APIRouter(prefix="/admin", tags=["Administrator"])

# Initialize supabase with SERVICE_ROLE_KEY for admin powers
SUPABASE_URL = os.environ.get("SUPABASE_URL", "http://127.0.0.1:54321")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "your-service-role-key")

supabase_admin: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

class RoleUpdateRequest(BaseModel):
    user_id: str
    role_claim: str

def verify_admin_token(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    token = authorization.replace("Bearer ", "")
    user_response = supabase_admin.auth.get_user(token)
    
    if not user_response.user:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    app_metadata = user_response.user.app_metadata
    if app_metadata.get("user_role") != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Forbidden. SUPER_ADMIN claim required.")

@router.post("/set-role")
def set_user_role(request: RoleUpdateRequest, _: None = Depends(verify_admin_token)):
    """
    Updates the app_metadata of a user to inject the JWT claim for custom RBAC.
    """
    if request.role_claim not in ["SUPER_ADMIN", "PLANNER", "WAREHOUSE_OP", "VIEWER"]:
        raise HTTPException(status_code=400, detail="Invalid role specified.")

    # Mutate the user's metadata using the admin api
    try:
        supabase_admin.auth.admin.update_user_by_id(
            request.user_id,
            {"app_metadata": {"user_role": request.role_claim}}
        )
        return {"status": "success", "message": f"User {request.user_id} assigned role {request.role_claim}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
