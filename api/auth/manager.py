from sqlalchemy.orm import Session
from fastapi import HTTPException
from .. import models, schemas
from .utils import create_access_token, uuid7
from .providers.google import verify_google_token

def authenticate(db: Session, auth_request: schemas.AuthRequest):
    # 1. Verify 3rd party token
    if auth_request.provider == "google":
        user_info = verify_google_token(auth_request.token)
    else:
        raise HTTPException(status_code=400, detail="Unsupported provider")
    
    # 2. Check if user exists
    user = db.query(models.User).filter(
        models.User.email == user_info["email"]
    ).first()

    # 3. Create if not exists
    if not user:
        user = models.User(
            id=uuid7(), # Explicitly assign UUID v7
            email=user_info["email"],
            provider=auth_request.provider,
            provider_id=user_info["provider_id"]
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    
    # 4. Mint internal JWT
    access_token = create_access_token(data={"sub": str(user.id)})
    return schemas.Token(access_token=access_token, token_type="bearer")
