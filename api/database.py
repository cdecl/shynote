from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

import os

# Check for Vercel's POSTGRES_URL or generic DATABASE_URL
SQLALCHEMY_DATABASE_URL = os.getenv("POSTGRES_URL") or os.getenv("DATABASE_URL")

if SQLALCHEMY_DATABASE_URL:
    # SQLAlchemy requires 'postgresql://', but Vercel often provides 'postgres://'
    if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
        SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)
    
    # Sanitize URL: Remove problematic query parameters like Supabase's '?options=project%3D...'
    # which can cause 'invalid connection option' errors in psycopg2.
    if "?" in SQLALCHEMY_DATABASE_URL:
        # Keep the base URL but strip options if they are known to be problematic
        # or just strip all params if they are not strictly needed for standard connections.
        base_url, query_params = SQLALCHEMY_DATABASE_URL.split("?", 1)
        if "options=project" in query_params:
            print(f"Sanitizing database URL: removing problematic options from {base_url}")
            SQLALCHEMY_DATABASE_URL = base_url
    
    try:
        engine = create_engine(SQLALCHEMY_DATABASE_URL)
    except Exception as e:
        print(f"Error creating DB engine: {e}")
        # Fallback to a dummy engine to prevent complete module import failure
        SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
        engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})

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
