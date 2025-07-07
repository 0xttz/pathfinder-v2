import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    SUPABASE_URL: str = os.environ.get("SUPABASE_URL")
    SUPABASE_KEY: str = os.environ.get("SUPABASE_KEY")
    GEMINI_API_KEY: str = os.environ.get("GEMINI_API_KEY")

settings = Settings()

if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
    raise Exception("Supabase credentials not found. Make sure to set SUPABASE_URL and SUPABASE_KEY in your .env file.") 