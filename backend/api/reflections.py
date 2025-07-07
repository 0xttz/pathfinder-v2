from fastapi import APIRouter, HTTPException
from typing import List
import uuid
from pydantic import BaseModel

from backend.db.supabase import supabase_client
from backend.models.schemas import Reflection

router = APIRouter()

class ReflectionUpdate(BaseModel):
    answer: str

@router.get("/realms/{realm_id}/reflections", response_model=List[Reflection])
async def get_reflections(realm_id: str):
    """Get all unanswered reflections for a given realm."""
    response = supabase_client.table("reflections").select("*").eq("realm_id", realm_id).is_("answer", "null").execute()
    if response.data is None:
        return []
    return response.data

@router.get("/realms/{realm_id}/reflections/archived", response_model=List[Reflection])
async def get_archived_reflections(realm_id: str):
    """Get all answered reflections for a given realm."""
    response = supabase_client.table("reflections").select("*").eq("realm_id", realm_id).not_.is_("answer", "null").execute()
    if response.data is None:
        return []
    return response.data

@router.put("/reflections/{reflection_id}", response_model=Reflection)
async def update_reflection(reflection_id: str, reflection_update: ReflectionUpdate):
    """Update the answer for a specific reflection"""
    update_data = {"answer": reflection_update.answer}
    response = supabase_client.table("reflections").update(update_data).eq("id", reflection_id).execute()
    
    if not response.data:
        raise HTTPException(status_code=404, detail="Reflection not found or error updating")
        
    return response.data[0] 