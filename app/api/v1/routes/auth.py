# app/api/v1/routes/auth.py
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from passlib.context import CryptContext
from jose import jwt
from datetime import date
import os
import traceback
from passlib.context import CryptContext
from passlib.hash import bcrypt_sha256
from app.db.session import SessionLocal
from app.models.user import User

from passlib.hash import pbkdf2_sha256


router = APIRouter(prefix="/auth", tags=["auth"])

JWT_SECRET = os.getenv("JWT_SECRET", "devsecret")
JWT_ALG = os.getenv("JWT_ALG", "HS256")

pwd_ctx = CryptContext(schemes=["bcrypt_sha256"], deprecated="auto")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ======== Schemas ========
class RegisterIn(BaseModel):
    email: EmailStr
    user_name: str = Field(min_length=2, max_length=100)
    password: str = Field(min_length=6, max_length=128)
    date_of_birth: date
    height_cm: float
    sex: str

class TokenOut(BaseModel):
    access_token: str

class LoginIn(BaseModel):
    email: EmailStr
    password: str

# ======== Routes ========
@router.post("/register", response_model=TokenOut)
def register(payload: RegisterIn, db: Session = Depends(get_db)):
    try:
        # 1) Dupla email védelem
        if db.query(User).filter(User.email == payload.email).first():
            raise HTTPException(status_code=400, detail="Email already registered")

        # 2) Jelszó hash (stabil CryptContext-tel)
        try:
            password_hash = pbkdf2_sha256.hash(payload.password)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Password hashing failed: {e}")

        # 3) Insert
        u = User(
            email=payload.email,
            user_name=payload.user_name,
            password_hash=password_hash,
            date_of_birth=payload.date_of_birth,
            height_cm=payload.height_cm,
            sex=payload.sex
        )
        db.add(u)
        db.commit()
        db.refresh(u)

        # 4) Token – FIGYELEM: user_id!
        token = jwt.encode({"sub": str(u.user_id)}, JWT_SECRET, algorithm=JWT_ALG)
        return {"access_token": token}
    
    except HTTPException:
        raise
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Email already registered")
    except Exception as e:
        # Ideiglenes – hogy lásd a valódi okot (később kivehetjük)
        db.rollback()
        trace = traceback.format_exc(limit=1)
        raise HTTPException(status_code=500, detail=f"Internal error: {e} | {trace}")
    
    
@router.post("/login", response_model=TokenOut)
def login(payload: LoginIn, db: Session = Depends(get_db)):
    u = db.query(User).filter(User.email == payload.email).first()
    if not u or not pbkdf2_sha256.verify(payload.password, str(u.password_hash)):
        raise HTTPException(401, "Invalid credentials")
    token = jwt.encode({"sub": str(u.user_id)}, JWT_SECRET, algorithm=JWT_ALG)
    return {"access_token": token}