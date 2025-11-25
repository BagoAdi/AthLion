# app/api/v1/deps.py
import os
from typing import Generator, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from pydantic import ValidationError

# Fontos: A SessionLocal-t közvetlenül a db modulból húzzuk be, 
# nem az auth-ból, így elkerüljük a körkörös importot!
from app.db.session import SessionLocal
from app.models.user import User

# Konfiguráció
JWT_SECRET = os.getenv("JWT_SECRET", "devsecret")
JWT_ALG = os.getenv("JWT_ALG", "HS256")

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

# --- 1. ADATBÁZIS FÜGGŐSÉG (get_db) ---
# Ezt itt definiáljuk, így a food_log.py és mások is innen importálhatják gond nélkül.
def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- 2. AUTH FÜGGŐSÉG (get_current_user) ---
def get_current_user(
    token: str = Depends(oauth2_scheme), 
    db: Session = Depends(get_db)
) -> User:
    """
    Token validálása és felhasználó lekérése.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        user_id: str = payload.get("sub")
        
        if user_id is None:
            raise credentials_exception
            
    except (JWTError, ValidationError):
        raise credentials_exception
    
    user = db.query(User).filter(User.user_id == int(user_id)).first()
    
    if user is None:
        raise credentials_exception
        
    return user

# --- 3. A HIÁNYZÓ FÜGGVÉNY (get_current_active_user) ---
# Ez volt a hiba forrása! Létrehozzuk, hogy a többi fájl megtalálja.
def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Jelenleg csak továbbadja a usert. 
    (Később itt lehet ellenőrizni, hogy active-e, ha lesz ilyen mező).
    """
    return current_user