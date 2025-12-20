import os
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

# --- CRUD Operations (Protected) ---

@app.post("/api/folders", response_model=schemas.Folder)
def create_folder(
    folder: schemas.FolderCreate, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(utils.get_current_user)
):
    db_folder = models.Folder(name=folder.name, user_id=current_user.id)
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
    folder_id: int, 
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
    folder_id: int,
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
    folder_id: int = None, 
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
    note_id: int, 
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
    note_id: int, 
    note: schemas.NoteUpdate, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(utils.get_current_user)
):
    db_note = db.query(models.Note).filter(
        models.Note.id == note_id,
        models.Note.user_id == current_user.id
    ).first()
    if db_note is None:
        raise HTTPException(status_code=404, detail="Note not found")
    
    # Check folder ownership if changing folder
    if note.folder_id is not None and note.folder_id != db_note.folder_id:
         folder = db.query(models.Folder).filter(
            models.Folder.id == note.folder_id,
            models.Folder.user_id == current_user.id
        ).first()
         if not folder:
             raise HTTPException(status_code=400, detail="Invalid folder")

    db_note.title = note.title
    db_note.content = note.content
    if note.folder_id is not None:
        db_note.folder_id = note.folder_id
        
    db.commit()
    db.refresh(db_note)
    return db_note

@app.delete("/api/notes/{note_id}")
def delete_note(
    note_id: int, 
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

@app.post("/api/smart/process")
def process_smart_edit(
    request: schemas.SmartEditRequest,
    current_user: models.User = Depends(utils.get_current_user)
):
    import time
    time.sleep(1) # Simulate AI processing delay
    
    text = request.text
    action = request.action
    
    if action == "proofread":
        return {"result": text + "\n\n[Proofread: No errors found (Mock)]"}
    elif action == "summarize":
        return {"result": f"**Summary**: This note is about {len(text)} characters long. (Mock)"}
    elif action == "improve":
        return {"result": text + "\n\n[Improved: Flow adjusted (Mock)]"}
    
    return {"result": text}

# Vercel will look for 'app' by default for ASGI.

