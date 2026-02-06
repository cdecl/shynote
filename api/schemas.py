from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import Optional, List

# --- Auth & User Schemas ---


class UserBase(BaseModel):
    email: str


class UserCreate(UserBase):
    provider: str
    provider_id: str


class User(UserBase):
    id: str
    created_at: datetime
    is_dark_mode: bool = False
    view_mode: str = "edit"

    class Config:
        from_attributes = True


class UserProfileUpdate(BaseModel):
    is_dark_mode: Optional[bool] = None
    view_mode: Optional[str] = None


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    user_id: Optional[str] = None


class AuthRequest(BaseModel):
    provider: str
    token: str


# --- API Key & External Inbound ---


class ApiKeyResponse(BaseModel):
    api_key: Optional[str] = None


class ExternalNoteCreate(BaseModel):
    title: str = Field(alias="titile")
    content: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)


# --- App Schemas ---


class NoteBase(BaseModel):
    title: str
    content: Optional[str] = None
    folder_id: Optional[str] = None


class NoteCreate(NoteBase):
    id: str  # Client generated UUID


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    folder_id: Optional[str] = None
    is_pinned: Optional[bool] = None
    version: Optional[int] = None  # For Optimistic Locking


class Note(NoteBase):
    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime
    version: int
    share_id: Optional[str] = None
    is_shared: bool = False
    is_pinned: bool = False

    class Config:
        from_attributes = True


class FolderBase(BaseModel):
    name: str


class FolderCreate(FolderBase):
    id: str  # Client generated UUID


class FolderUpdate(FolderBase):
    pass


class Folder(FolderBase):
    id: str
    user_id: str
    notes: List[Note] = []

    class Config:
        from_attributes = True


# --- Backup & Restore Schemas ---


class BackupNote(BaseModel):
    id: str
    title: str
    content: Optional[str] = None
    folder_id: Optional[str] = None
    user_id: str
    created_at: datetime
    updated_at: datetime
    is_pinned: bool = False
    is_shared: bool = False
    share_id: Optional[str] = None
    version: int = 1

    class Config:
        from_attributes = True


class BackupFolder(BaseModel):
    id: str
    name: str
    user_id: str

    class Config:
        from_attributes = True


class BackupData(BaseModel):
    folders: List[BackupFolder]
    notes: List[BackupNote]
    backup_version: int = 1
    created_at: datetime = Field(default_factory=datetime.utcnow)
    backup_user_id: Optional[str] = None  # Track who created this backup
