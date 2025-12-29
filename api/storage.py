from supabase import create_client, Client
from .config import SUPABASE_URL, SUPABASE_KEY, SUPABASE_BUCKET
import uuid

class Storage:
    def __init__(self):
        self.client: Client = None
        if SUPABASE_URL and SUPABASE_KEY:
            try:
                self.client = create_client(SUPABASE_URL, SUPABASE_KEY)
            except Exception as e:
                print(f"Failed to initialize Supabase client: {e}")
    
    def upload_file(self, file_content: bytes, filename: str, content_type: str, user_id: str) -> str:
        if not self.client:
            raise Exception("Supabase client not initialized. Check config.")
            
        # Clean filename to avoid issues, but keep extension
        # Using UUID for folder/path uniqueness
        unique_id = str(uuid.uuid4())
        path = f"uploads/{user_id}/{unique_id}/{filename}"
        
        # Supabase Python client upload
        # https://github.com/supabase-community/storage-py
        try:
            self.client.storage.from_(SUPABASE_BUCKET).upload(
                file=file_content,
                path=path,
                file_options={"content-type": content_type}
            )
            
            # Construct public URL
            public_url = self.client.storage.from_(SUPABASE_BUCKET).get_public_url(path)
            return public_url
        except Exception as e:
            # Re-raise to be handled by caller
            raise e

storage_service = Storage()
