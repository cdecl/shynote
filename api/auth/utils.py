from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from .. import database, models, schemas
import os
import uuid
import time

# CONSTANTS - In a real app, move SECRET_KEY to env vars
SECRET_KEY = "CHANGE_THIS_TO_A_SECURE_SECRET_KEY"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 7 days for convenience

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

def uuid7() -> str:
    """Generate a UUID v7 (Time-ordered)."""
    # 1. 48-bit timestamp
    t_ms = int(time.time() * 1000)
    
    # 2. Random bits
    # We need approx 74 bits of randomness. 
    # High 12 bits (rand_a), Low 62 bits (rand_b)
    
    rand_a = int.from_bytes(os.urandom(2), 'big') & 0xFFF
    rand_b = int.from_bytes(os.urandom(8), 'big') & 0x3FFFFFFFFFFFFFFF
    
    # Construct UUID int:
    # [48 bit timestamp] | [4 bit ver (7)] | [12 bit rand_a] | [2 bit var (10)] | [62 bit rand_b]
    uuid_int = (t_ms << 80) | (0x7 << 76) | (rand_a << 64) | (0x2 << 62) | rand_b
    
    return str(uuid.UUID(int=uuid_int))

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(database.get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        token_data = schemas.TokenData(user_id=user_id)
    except JWTError:
        raise credentials_exception
        
    user = db.query(models.User).filter(models.User.id == token_data.user_id).first()
    if user is None:
        raise credentials_exception
    return user
