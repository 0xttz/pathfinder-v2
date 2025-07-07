import uuid
from fastapi import APIRouter, HTTPException
from typing import List

from backend.db.supabase import supabase_client
from backend.models.schemas import Realm, RealmCreate, RealmUpdate

router = APIRouter()

@router.get("/realms", response_model=List[Realm])
async def get_realms():
    """Get all realms for the user"""
    response = supabase_client.table("realms").select("*").execute()
    if response.data is None:
        raise HTTPException(status_code=500, detail="Error fetching realms")
    return response.data

@router.get("/realms/{realm_id}", response_model=Realm)
async def get_realm(realm_id: str):
    """Get a single realm by its ID"""
    response = supabase_client.table("realms").select("*").eq("id", realm_id).single().execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Realm not found")
    return response.data

@router.post("/realms", response_model=Realm)
async def create_realm(realm: RealmCreate):
    """Create a new realm"""
    realm_id = str(uuid.uuid4())
    new_realm = {
        "id": realm_id,
        "name": realm.name,
        "system_prompt": realm.system_prompt
    }
    response = supabase_client.table("realms").insert(new_realm).execute()
    if not response.data:
        raise HTTPException(status_code=500, detail="Error creating realm")
    return response.data[0]

@router.put("/realms/{realm_id}", response_model=Realm)
async def update_realm(realm_id: str, realm_update: RealmUpdate):
    """Update an existing realm"""
    update_data = realm_update.dict(exclude_unset=True)
    response = supabase_client.table("realms").update(update_data).eq("id", realm_id).execute()
    
    if not response.data:
        raise HTTPException(status_code=404, detail="Realm not found or error updating")
        
    return response.data[0]

@router.delete("/realms/{realm_id}")
async def delete_realm(realm_id: str):
    """Delete a realm"""
    response = supabase_client.table("realms").delete().eq("id", realm_id).execute()
    
    if not response.data:
        raise HTTPException(status_code=404, detail="Realm not found or error deleting")
        
    return {"message": "Realm deleted successfully"} 