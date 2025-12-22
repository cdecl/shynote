from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    provider = Column(String) # e.g. "google"
    provider_id = Column(String, index=True) # e.g. google sub
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_dark_mode = Column(Boolean, default=False)
    view_mode = Column(String, default="edit") # 'edit', 'split', 'preview'
    
    folders = relationship("Folder", back_populates="user")
    notes = relationship("Note", back_populates="user")

class Folder(Base):
    __tablename__ = "folders"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    
    user = relationship("User", back_populates="folders")
    notes = relationship("Note", back_populates="folder", cascade="all, delete-orphan")

class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    content = Column(Text)
    folder_id = Column(Integer, ForeignKey("folders.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
    
    user = relationship("User", back_populates="notes")
    folder = relationship("Folder", back_populates="notes")

    # Sharing
    share_id = Column(String, unique=True, index=True, nullable=True)
    is_shared = Column(Boolean, default=False)
