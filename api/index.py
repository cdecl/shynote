import os
import uuid
import hashlib
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List
from . import models, schemas, database
from .auth import manager, utils
from .storage import storage_service

# Get the directory of the current file to resolve static paths correctly
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(os.path.dirname(BASE_DIR), "static")

app = FastAPI()


@app.on_event("startup")
def on_startup():
    try:
        models.Base.metadata.create_all(bind=database.engine)
    except Exception as e:
        print(f"Error creating database tables during startup: {e}")
        # Application continues; logs will show the issue.



# Mount static files
if os.path.exists(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.on_event("startup")
def configure_logging():
    import logging
    import sys
    import time
    
    class MillisecondFormatter(logging.Formatter):
        def formatTime(self, record, datefmt=None):
            from datetime import datetime
            ct = datetime.fromtimestamp(record.created)
            if datefmt:
                s = ct.strftime(datefmt)
            else:
                s = ct.strftime("%Y-%m-%d %H:%M:%S.%f")
            return s

    formatter = MillisecondFormatter(
        fmt='[%(asctime)s] %(levelname)s: %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S.%f'
    )
    
    # Configure Root Logger
    logging.basicConfig(level=logging.INFO)
    root = logging.getLogger()
    if root.handlers:
        for handler in root.handlers:
            handler.setFormatter(formatter)
            
    # Configure Uvicorn Loggers specifically (since they might have their own handlers)
    for logger_name in ["uvicorn", "uvicorn.access", "uvicorn.error"]:
        logger = logging.getLogger(logger_name)
        if logger.handlers:
            for handler in logger.handlers:
                handler.setFormatter(formatter)
        else:
             # If uvicorn hasn't added handlers yet (rare if running via CLI), add one
             h = logging.StreamHandler(sys.stdout)
             h.setFormatter(formatter)
             logger.addHandler(h)
             logger.setLevel(logging.INFO)

@app.get("/")
def read_root():
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"error": "Static files not found", "path": index_path}

@app.get("/sw.js")
def read_sw():
    sw_path = os.path.join(STATIC_DIR, "sw.js")
    if os.path.exists(sw_path):
        return FileResponse(sw_path, media_type="application/javascript")
    return {"error": "Service Worker not found", "path": sw_path}


# --- Auth Endpoints ---
@app.get("/auth/config")
def get_auth_config():
    from .config import GOOGLE_CLIENT_ID
    from .database import SQLALCHEMY_DATABASE_URL
    
    db_type = "unknown"
    if SQLALCHEMY_DATABASE_URL:
        db_type = SQLALCHEMY_DATABASE_URL.split(":")[0]
        
    return {"google_client_id": GOOGLE_CLIENT_ID, "db_type": db_type}

@app.post("/auth/login", response_model=schemas.Token)
def login(auth_request: schemas.AuthRequest, db: Session = Depends(database.get_db)):
    return manager.authenticate(db, auth_request)

# OAuth 2.0 Callback - GET: Serve Frontend (App loads -> extracts code -> calls POST)
@app.get("/auth/google/callback")
def serve_oauth_callback():
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"error": "Static files not found", "path": index_path}

# OAuth 2.0 Callback - POST: Handle Token Exchange
@app.post("/auth/google/callback")
async def google_oauth_callback(
    request: Request, 
    db: Session = Depends(database.get_db)
):
    import httpx
    from .config import GOOGLE_CLIENT_ID
    
    # Load Client Secret from Env (Dynamic)
    GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET')
    if not GOOGLE_CLIENT_SECRET:
         raise HTTPException(status_code=500, detail="Server config error: Missing Client Secret")

    try:
        data = await request.json()
        code = data.get('code')
        
        if not code:
            raise HTTPException(status_code=400, detail="No code provided")
        
        # 1. Exchange Code for Access Token
        token_url = "https://oauth2.googleapis.com/token"
        
        # Determine redirect_uri based on origin or hardcoded
        # Usually needs to match exactly what was sent in frontend
        # For simplicity, we can reconstruct it or trust the referrer? 
        # Better to be strict. Frontend sent: window.location.origin + '/auth/google/callback'
        # We need to match that.
        
        origin = request.headers.get('origin')
        if not origin:
             # Fallback from referer or assume standard
             referer = request.headers.get('referer')
             if referer:
                 from urllib.parse import urlparse
                 parsed = urlparse(referer)
                 origin = f"{parsed.scheme}://{parsed.netloc}"
        
        if not origin:
            raise HTTPException(status_code=400, detail="Could not determine origin for redirect_uri")

        redirect_uri = f"{origin}/auth/google/callback"
        
        async with httpx.AsyncClient() as client:
            token_response = await client.post(token_url, data={
                'code': code,
                'client_id': GOOGLE_CLIENT_ID,
                'client_secret': GOOGLE_CLIENT_SECRET,
                'redirect_uri': redirect_uri,
                'grant_type': 'authorization_code'
            })
            
            if token_response.status_code != 200:
                print(f"Token Error: {token_response.text}")
                raise HTTPException(status_code=400, detail="Failed to exchange code")
            
            tokens = token_response.json()
            access_token = tokens.get('access_token')
            
            # 2. Get User Info
            userinfo_response = await client.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={'Authorization': f'Bearer {access_token}'}
            )
            
            if userinfo_response.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to get user info")
            
            user_info = userinfo_response.json()
        
        # 3. Create or Get User (Similar to manager.verify_google_token logic)
        email = user_info.get('email')
        if not email:
            raise HTTPException(status_code=400, detail="Email not provided by Google")

        user = db.query(models.User).filter(models.User.email == email).first()
        
        if not user:
            user = models.User(
                email=email,
                name=user_info.get('name'),
                picture=user_info.get('picture'),
                provider='google'
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
             # Update info
            user.name = user_info.get('name')
            user.picture = user_info.get('picture')
            db.commit()
        
        # 4. Create local JWT
        jwt_token = manager.create_access_token(data={"sub": str(user.id)})
        
        return {
            "access_token": jwt_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "picture": user.picture
            }
        }
        
    except Exception as e:
        print(f"OAuth callback error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/auth/me", response_model=schemas.User)
def read_users_me(current_user: models.User = Depends(utils.get_current_user)):
    return current_user

@app.patch("/auth/me", response_model=schemas.User)
def update_user_profile(
    profile_update: schemas.UserProfileUpdate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(utils.get_current_user)
):
    if profile_update.is_dark_mode is not None:
        current_user.is_dark_mode = profile_update.is_dark_mode
    if profile_update.view_mode is not None:
        current_user.view_mode = profile_update.view_mode
    
    db.commit()
    db.refresh(current_user)
    return current_user

# --- CRUD Operations (Protected) ---

@app.post("/api/folders", response_model=schemas.Folder)
def create_folder(
    folder: schemas.FolderCreate, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(utils.get_current_user)
):
    # Check if folder exists (Upsert-like behavior)
    # Check if folder exists (Upsert-like behavior)
    # Check by ID only first to detect collisions with other users
    existing_folder = db.query(models.Folder).filter(models.Folder.id == folder.id).first()

    if existing_folder:
        if existing_folder.user_id != current_user.id:
             # ID collision with another user
             print(f"Collision: Folder {folder.id} exists for user {existing_folder.user_id}, but requested by {current_user.id}")
             raise HTTPException(status_code=409, detail="Folder ID collision with another user")
        
        # If user matches, it's an idempotent retry. Return existing.
        # Note: We don't update name on POST (use PUT for updates), just ensure existence.
        return existing_folder

    db_folder = models.Folder(id=folder.id, name=folder.name, user_id=current_user.id)
    db.add(db_folder)
    db.commit()
    db.refresh(db_folder)
    return db_folder

@app.get("/api/folders", response_model=List[schemas.Folder])
def read_folders(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(utils.get_current_user)
):
    folders = db.query(models.Folder).filter(models.Folder.user_id == current_user.id).offset(skip).limit(limit).all()
    return folders

@app.delete("/api/folders/{folder_id}")
def delete_folder(
    folder_id: str, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(utils.get_current_user)
):
    db_folder = db.query(models.Folder).filter(
        models.Folder.id == folder_id,
        models.Folder.user_id == current_user.id
    ).first()
    if db_folder is None:
        raise HTTPException(status_code=404, detail="Folder not found")
    
    db.delete(db_folder)
    db.commit()
    return {"message": "Folder deleted successfully"}

@app.put("/api/folders/{folder_id}", response_model=schemas.Folder)
def update_folder(
    folder_id: str,
    folder: schemas.FolderUpdate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(utils.get_current_user)
):
    db_folder = db.query(models.Folder).filter(
        models.Folder.id == folder_id,
        models.Folder.user_id == current_user.id
    ).first()
    if db_folder is None:
        raise HTTPException(status_code=404, detail="Folder not found")
    
    db_folder.name = folder.name
    db.commit()
    db.refresh(db_folder)
    return db_folder


@app.post("/api/notes", response_model=schemas.Note)
def create_note(
    note: schemas.NoteCreate, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(utils.get_current_user)
):
    # Verify folder belongs to user if folder_id is provided
    if note.folder_id:
        folder = db.query(models.Folder).filter(
            models.Folder.id == note.folder_id,
            models.Folder.user_id == current_user.id
        ).first()
        if not folder:
             raise HTTPException(status_code=404, detail="Folder not found")

    # UPSERT: Check if note already exists
    # Check by ID only first to detect collisions even if user_id doesn't match
    existing_note = db.query(models.Note).filter(models.Note.id == note.id).first()
    
    if existing_note:
        if existing_note.user_id != current_user.id:
             # ID collision with another user (or ghost data)
             print(f"Collision: Note {note.id} exists for user {existing_note.user_id}, but requested by {current_user.id}")
             # We return 409 Conflict. Client should handle this, or we just fail gracefully.
             # For now, let's treat it as a critical error but not 500.
             raise HTTPException(status_code=409, detail="Note ID collision with another user")

        # UPDATE: Update existing note (User matches)
        existing_note.title = note.title
        existing_note.content = note.content
        existing_note.folder_id = note.folder_id
        if hasattr(note, 'is_pinned'):
            existing_note.is_pinned = note.is_pinned
        if hasattr(note, 'is_shared'):
            existing_note.is_shared = note.is_shared
        db_note = existing_note
    else:
        # INSERT: Create new note
        db_note = models.Note(
            id=note.id,
            title=note.title, 
            content=note.content, 
            folder_id=note.folder_id,
            user_id=current_user.id
        )
        db.add(db_note)
    
    db.commit()
    db.refresh(db_note)
    return db_note

@app.get("/api/notes", response_model=List[schemas.Note])
def read_notes(
    skip: int = 0, 
    limit: int = 100, 
    folder_id: str = None, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(utils.get_current_user)
):
    query = db.query(models.Note).filter(models.Note.user_id == current_user.id)
    if folder_id is not None:
        query = query.filter(models.Note.folder_id == folder_id)
        
    notes = query.offset(skip).limit(limit).all()
    return notes

@app.get("/api/notes/{note_id}", response_model=schemas.Note)
def read_note(
    note_id: str, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(utils.get_current_user)
):
    db_note = db.query(models.Note).filter(
        models.Note.id == note_id,
        models.Note.user_id == current_user.id
    ).first()
    if db_note is None:
        raise HTTPException(status_code=404, detail="Note not found")
    return db_note

@app.put("/api/notes/{note_id}", response_model=schemas.Note)
def update_note(
    note_id: str, 
    note: schemas.NoteUpdate, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(utils.get_current_user)
):
    # Check if note exists
    db_note = db.query(models.Note).filter(
        models.Note.id == note_id,
        models.Note.user_id == current_user.id
    ).first()
    
    update_data = note.dict(exclude_unset=True)

    # Validate folder_id if present
    if "folder_id" in update_data and update_data["folder_id"] is not None:
        folder = db.query(models.Folder).filter(
            models.Folder.id == update_data["folder_id"],
            models.Folder.user_id == current_user.id
        ).first()
        if not folder:
             raise HTTPException(status_code=400, detail="Invalid folder")

    if db_note is None:
        # Not found? Create it! (Upsert for Sync)
        # We must allow creating with a specific ID to keep sync consistent
        # Only create if we have enough info (title, content generally optional but good to have)
        
        # Ensure we have a valid title if it's missing (fallback)
        title = update_data.get("title", "Untitled Note")
        content = update_data.get("content", "")
        folder_id = update_data.get("folder_id", None)
        
        db_note = models.Note(
            id=note_id,
            title=title,
            content=content,
            folder_id=folder_id,
            user_id=current_user.id,
            is_pinned=update_data.get("is_pinned", False)
        )
        db.add(db_note)
        # Note: In postgres, we might need to reset sequence after manual insert, 
        # but for simple sync recovery this should work. Validating ID collision handled by transaction.
    else:
        # Update existing
        
        # Optimistic Locking Check
        # If client sends a version, check if it matches current DB version
        # If mismatch, it means client is updating a stale copy -> Conflict (409)
        if note.version is not None:
            if db_note.version != note.version:
                print(f"Conflict: Note {note_id} version mismatch. DB={db_note.version}, Client={note.version}")
                raise HTTPException(status_code=409, detail="Conflict: Stale version")
        
        if "title" in update_data:
            db_note.title = update_data["title"]
        
        if "content" in update_data:
            db_note.content = update_data["content"]
            
        if "folder_id" in update_data:
            db_note.folder_id = update_data["folder_id"]

        if "is_pinned" in update_data:
            db_note.is_pinned = update_data["is_pinned"]
            
        # Increment Version on successful update
        db_note.version += 1
        
    db.commit()
    db.refresh(db_note)
    return db_note

@app.delete("/api/notes/{note_id}")
def delete_note(
    note_id: str, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(utils.get_current_user)
):
    db_note = db.query(models.Note).filter(
        models.Note.id == note_id,
        models.Note.user_id == current_user.id
    ).first()
    if db_note is None:
        raise HTTPException(status_code=404, detail="Note not found")
    
    db.delete(db_note)
    db.commit()
    return {"message": "Note deleted successfully"}

# --- Backup & Restore ---

@app.get("/api/backup", response_model=schemas.BackupData)
def backup_data(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(utils.get_current_user)
):
    """
    Exports all folders and notes for the current user.
    """
    folders = db.query(models.Folder).filter(models.Folder.user_id == current_user.id).all()
    notes = db.query(models.Note).filter(models.Note.user_id == current_user.id).all()
    
    return {"folders": folders, "notes": notes}


@app.post("/api/restore")
def restore_data(
    backup: schemas.BackupData,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(utils.get_current_user)
):
    """
    Restores folders and notes from a backup file. Appends data, skipping duplicates.
    """
    existing_folder_ids = {f.id for f in db.query(models.Folder.id).filter(models.Folder.user_id == current_user.id).all()}
    existing_note_ids = {n.id for n in db.query(models.Note.id).filter(models.Note.user_id == current_user.id).all()}
    
    new_folders = []
    for folder_data in backup.folders:
        if folder_data.id not in existing_folder_ids:
            new_folder = models.Folder(
                id=folder_data.id,
                name=folder_data.name,
                user_id=current_user.id
            )
            db.add(new_folder)
            new_folders.append(new_folder)
            existing_folder_ids.add(folder_data.id)

    all_folder_ids = existing_folder_ids

    new_notes = []
    for note_data in backup.notes:
        if note_data.id not in existing_note_ids:
            folder_id = note_data.folder_id
            if folder_id and folder_id not in all_folder_ids:
                folder_id = None

            new_note = models.Note(
                id=note_data.id,
                title=note_data.title,
                content=note_data.content,
                folder_id=folder_id,
                user_id=current_user.id,
                created_at=note_data.created_at,
                updated_at=note_data.updated_at,
                is_pinned=note_data.is_pinned
            )
            db.add(new_note)
            new_notes.append(new_note)
            
    db.commit()
    
    return {
        "message": "Restore successful",
        "folders_added": len(new_folders),
        "notes_added": len(new_notes)
    }


@app.delete("/api/reset")
def reset_account(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(utils.get_current_user)
):
    """
    NUCLEAR OPTION: Deletes ALL folders and notes for the current user.
    """
    # Delete notes first (foreign key constraint might not exist but logical order)
    db.query(models.Note).filter(models.Note.user_id == current_user.id).delete()
    # Delete folders
    db.query(models.Folder).filter(models.Folder.user_id == current_user.id).delete()
    
    db.commit()
    return {"message": "Account data reset successfully"}


# --- Sharing ---

@app.put("/api/notes/{note_id}/share")
def share_note_toggle(
    note_id: str, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(utils.get_current_user)
):
    db_note = db.query(models.Note).filter(
        models.Note.id == note_id,
        models.Note.user_id == current_user.id
    ).first()
    
    if not db_note:
        raise HTTPException(status_code=404, detail="Note not found")

    # If currently shared, toggle off
    if db_note.is_shared:
        db_note.is_shared = False
    else:
        # If toggling on, ensure share_id exists
        if not db_note.share_id:
            # Deterministic UUID generation: sha256(user_id:note_id:secret) -> uuid
            seed = f"{current_user.id}:{db_note.id}:SHYNOTE_SECRET_SALT"
            hash_object = hashlib.sha256(seed.encode())
            # create a uuid from the hash (using first 16 bytes)
            generated_uuid = str(uuid.UUID(bytes=hash_object.digest()[:16], version=4))
            db_note.share_id = generated_uuid
        
        db_note.is_shared = True
    
    db.commit()
    db.refresh(db_note)
    return {"is_shared": db_note.is_shared, "share_id": db_note.share_id}

@app.get("/share/{share_id}")
def view_shared_note(share_id: str, db: Session = Depends(database.get_db)):
    note = db.query(models.Note).filter(
        models.Note.share_id == share_id,
        models.Note.is_shared == True
    ).first()
    
    if not note:
        raise HTTPException(status_code=404, detail="Shared note not found")
        
    # Return simple HTML for viewing
    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{note.title} - SHYNOTE </title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://cdn.jsdelivr.net/npm/marked@4.3.0/marked.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
        <link href='//spoqa.github.io/spoqa-han-sans/css/SpoqaHanSansNeo.css' rel='stylesheet' type='text/css'>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.2.0/github-markdown-light.min.css">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css">
        <link rel="stylesheet" href="/static/style.css?v=7">
        <style>
            body {{ font-family: 'Spoqa Han Sans Neo', 'Inter', sans-serif; background-color: #ffffff; }}
            .markdown-body {{ 
                box-sizing: border-box; 
                min-width: 200px; 
                max-width: 980px; 
                margin: 0 auto; 
                padding: 45px; 
                font-size: 16px !important;
            }}
            @media (max-width: 767px) {{ .markdown-body {{ padding: 15px; }} }}
        </style>
    </head>
    <body>
        <div class="max-w-4xl mx-auto py-10 px-4">
            <h1 class="text-3xl font-bold text-gray-900 mb-2" style="font-family: 'Spoqa Han Sans Neo', sans-serif;">{note.title}</h1>
            <p class="text-xs text-gray-400 mb-8 font-mono">Shared via SHYNOTE</p>
            <div id="content" class="markdown-body shadow-none hidden">{note.content}</div>
            <div id="preview" class="markdown-body"></div>
        </div>
        <script>
            const content = document.getElementById('content').innerText;
            document.getElementById('preview').innerHTML = marked.parse(content);
            hljs.highlightAll();
        </script>
    </body>
    </html>
    """
    from fastapi.responses import HTMLResponse
    return HTMLResponse(content=html_content, status_code=200)


@app.post("/api/upload")
async def upload_image(
    file: UploadFile = File(...),
    current_user: models.User = Depends(utils.get_current_user)
):
    # Validate mime type
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only images allowed")
        
    try:
        content = await file.read()
        url = storage_service.upload_file(
            file_content=content,
            filename=file.filename,
            content_type=file.content_type,
            user_id=current_user.id
        )
        return {"url": url}
    except Exception as e:
        print(f"Upload failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Vercel will look for 'app' by default for ASGI.

