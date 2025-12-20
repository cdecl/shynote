from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import urllib.parse as urlparse

import os

# Check for Vercel's POSTGRES_URL or generic DATABASE_URL
SQLALCHEMY_DATABASE_URL = os.getenv("POSTGRES_URL") or os.getenv("DATABASE_URL")

if SQLALCHEMY_DATABASE_URL:
    # SQLAlchemy/psycopg2 requires 'postgresql://', but many providers use 'postgres://'
    if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
        SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)

    # Parse and sanitize URL (remove 'supa' param if present, which breaks libpq)
    # This matches the successful approach used in the 'noti' project reference provided by the user.
    if 'supa' in SQLALCHEMY_DATABASE_URL:
        u = urlparse.urlparse(SQLALCHEMY_DATABASE_URL)
        query = urlparse.parse_qs(u.query)
        if 'supa' in query:
            del query['supa']
        
        # Reconstruct URL without 'supa'
        new_query = urlparse.urlencode(query, doseq=True)
        SQLALCHEMY_DATABASE_URL = u._replace(query=new_query).geturl()
        print(f"Sanitized Database URL (removed 'supa'): {SQLALCHEMY_DATABASE_URL.split('@')[-1]}")
    
    try:
        engine = create_engine(SQLALCHEMY_DATABASE_URL)

    except Exception as e:
        print(f"Error creating DB engine: {e}")
        # Fallback to a memory engine to allow the app to start
        engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})

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
