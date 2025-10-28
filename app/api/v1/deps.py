# app/api/v1/deps.py
import os
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from pydantic import ValidationError # Bár itt közvetlenül nem hívjuk, jó ha itt van hibakezeléshez

from app.api.v1.routes.auth import get_db
from app.models.user import User

# Ezeket az auth.py-ból vesszük, de itt is definiáljuk, hogy ne legyen körkörös import
JWT_SECRET = os.getenv("JWT_SECRET", "devsecret")
JWT_ALG = os.getenv("JWT_ALG", "HS256")

# Az "oauth2_scheme" megmondja a FastAPInak, hogy a tokent
# a 'Bearer' tokenből olvassa ki a 'Authorization' fejlécből.
# A tokenUrl az a végpont, ahol a tokent meg lehet szerezni (a mi login logikánk).
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    """
    Dekódolja a JWT tokent, lekérdezi a felhasználót az adatbázisból, és visszaadja.
    HTTP 401 hibát dob, ha a token érvénytelen.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        user_id: Optional[str] = payload.get("sub")
        
        if user_id is None:
            raise credentials_exception
            
    except JWTError:
        raise credentials_exception
        raise credentials_exception
    
    try:
        user = db.query(User).filter(User.user_id == int(user_id)).first()
        if user is None:
            raise credentials_exception
            
        return user
        
    except Exception:
        # Bármilyen egyéb hiba (pl. adatbázis kapcsolat) esetén
        raise credentials_exception