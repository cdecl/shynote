from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List

# --- Auth & User Schemas ---

class UserBase(BaseModel):
    email: str

class UserCreate(UserBase):
    provider: str
    provider_id: str

class User(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    user_id: Optional[int] = None

class AuthRequest(BaseModel):
    provider: str
    token: str

# --- App Schemas ---

class NoteBase(BaseModel):
    title: str
    content: Optional[str] = None
    folder_id: Optional[int] = None

class NoteCreate(NoteBase):
    pass

class NoteUpdate(NoteBase):
    pass

class Note(NoteBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class FolderBase(BaseModel):
    name: str

class FolderCreate(FolderBase):
    pass

class SmartEditRequest(BaseModel):
    action: str
    text: str
    context: Optional[dict] = {}

class Folder(FolderBase):
    id: int
    user_id: int
    notes: List[Note] = []

    class Config:
        from_attributes = True
