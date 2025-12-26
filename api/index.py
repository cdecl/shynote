import os
import uuid
import hashlib
from fastapi import FastAPI, Depends, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List
from . import models, schemas, database
from .auth import manager, utils

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

@app.get("/")
def read_root():
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"error": "Static files not found", "path": index_path}


# --- Auth Endpoints ---
@app.get("/auth/config")
def get_auth_config():
    from .config import GOOGLE_CLIENT_ID
    return {"google_client_id": GOOGLE_CLIENT_ID}

@app.post("/auth/login", response_model=schemas.Token)
def login(auth_request: schemas.AuthRequest, db: Session = Depends(database.get_db)):
    return manager.authenticate(db, auth_request)

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
    # Check if folder exists (Upsert-like behavior or just fail if collision - UUID collision unlikely)
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

    db_note = models.Note(
        id=note.id, # Use Client ID
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
        if "title" in update_data:
            db_note.title = update_data["title"]
        
        if "content" in update_data:
            db_note.content = update_data["content"]
            
        if "folder_id" in update_data:
            db_note.folder_id = update_data["folder_id"]

        if "is_pinned" in update_data:
            db_note.is_pinned = update_data["is_pinned"]
        
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
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
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


# Vercel will look for 'app' by default for ASGI.

