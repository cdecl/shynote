from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

import os

# Check for Vercel's POSTGRES_URL or generic DATABASE_URL
SQLALCHEMY_DATABASE_URL = os.getenv("POSTGRES_URL") or os.getenv("DATABASE_URL")

if SQLALCHEMY_DATABASE_URL:
    # SQLAlchemy requires 'postgresql://', but Vercel often provides 'postgres://'
    if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
        SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)
    
    
    try:
        engine = create_engine(SQLALCHEMY_DATABASE_URL)
    except Exception as e:
        print(f"Error creating DB engine: {e}")
        raise e
else:
    # Fallback to SQLite
    # On Vercel, the root is read-only. Use /tmp if local DB is needed.
    if os.environ.get("VERCEL"):
        SQLALCHEMY_DATABASE_URL = "sqlite:///./SHYNOTE.db" # Default fail logic or...
        # Better: use /tmp
        SQLALCHEMY_DATABASE_URL = "sqlite:////tmp/SHYNOTE.db"
        print("Running on Vercel without POSTGRES_URL. Using ephemeral /tmp/SHYNOTE.db")
    else:
        SQLALCHEMY_DATABASE_URL = "sqlite:///./SHYNOTE.db"
        
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
    )
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
