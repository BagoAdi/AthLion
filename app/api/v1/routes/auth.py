from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from passlib.hash import bcrypt
from jose import jwt
import os
from app.db.session import SessionLocal
from app.models.user import User

JWT_SECRET = os.getenv("JWT_SECRET", "devsecret")
JWT_ALG = os.getenv("JWT_ALG", "HS256")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    user_name: str

class TokenOut(BaseModel):
    access_token: str

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=TokenOut)
def register(payload: RegisterIn, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(400, "Email already registered")
    u = User(
        email=payload.email,
        user_name=payload.user_name,
        password_hash=bcrypt.hash(payload.password)
    )
    db.add(u); db.commit(); db.refresh(u)
    token = jwt.encode({"sub": str(u.userid)}, JWT_SECRET, algorithm=JWT_ALG)
    return {"access_token": token}

class LoginIn(BaseModel):
    email: EmailStr
    password: str

@router.post("/login", response_model=TokenOut)
def login(payload: LoginIn, db: Session = Depends(get_db)):
    u = db.query(User).filter(User.email == payload.email).first()
    if not u or not bcrypt.verify(payload.password, u.password_hash):
        raise HTTPException(401, "Invalid credentials")
    token = jwt.encode({"sub": str(u.user_id)}, JWT_SECRET, algorithm=JWT_ALG)
    return {"access_token": token}
