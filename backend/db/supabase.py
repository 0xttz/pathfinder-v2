from supabase import create_client, Client
from backend.core.config import settings

# Use the service key if available to bypass RLS for admin-level operations.
# Fall back to the anon key if the service key is not set.
key = settings.SUPABASE_SERVICE_KEY if settings.SUPABASE_SERVICE_KEY else settings.SUPABASE_KEY
supabase_client: Client = create_client(settings.SUPABASE_URL, key)

def get_db():
    return supabase_client 