import os
from dotenv import load_dotenv

load_dotenv()

# Helper to proxy config access (mostly direct env access now)
config = os.environ

GOOGLE_CLIENT_ID = config.get("GOOGLE_CLIENT_ID")
SUPABASE_URL = config.get("SUPABASE_URL")
SUPABASE_KEY = config.get("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_BUCKET = config.get("SUPABASE_BUCKET", "images") # Default to 'images' bucket
