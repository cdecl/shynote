from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import urllib.parse as urlparse

import os

# Check for Vercel's POSTGRES_URL or generic DATABASE_URL
SQLALCHEMY_DATABASE_URL = os.getenv("POSTGRES_URL") or os.getenv("DATABASE_URL")

if SQLALCHEMY_DATABASE_URL:
    url = SQLALCHEMY_DATABASE_URL

    # Parse and sanitize URL (remove 'supa' param if present, which breaks libpq)
    if 'supa' in url:
        u = urlparse.urlparse(url)
        query = urlparse.parse_qs(u.query)
        if 'supa' in query:
            del query['supa']
        
        # Reconstruct URL without 'supa'
        new_query = urlparse.urlencode(query, doseq=True)
        url = u._replace(query=new_query).geturl()
        SQLALCHEMY_DATABASE_URL = url
    
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
