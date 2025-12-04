from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from passlib.context import CryptContext
from datetime import date
import os
import traceback
from passlib.context import CryptContext
from passlib.hash import bcrypt_sha256
from app.db.session import SessionLocal
from app.models.user import User
from app.schemas import UserCreate, UserOut
from passlib.hash import pbkdf2_sha256
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from email_validator import validate_email, EmailNotValidError


router = APIRouter(prefix="/auth", tags=["auth"])

JWT_SECRET = os.getenv("JWT_SECRET", "devsecret")
JWT_ALG = os.getenv("JWT_ALG", "HS256")

pwd_ctx = CryptContext(schemes=["bcrypt_sha256"], deprecated="auto")

# --- ÁTHELYEZETT KÓD (get_db) ---
# A get_db-t idehoztuk, mert az új 'get_current_active_user' függőség is használja.
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
# --- ÁTHELYEZETT KÓD VÉGE ---


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

# Bármelyik végpontba "bekérhetjük", és az automatikusan ellenőrzi a tokent
# és visszaadja a bejelentkezett felhasználó adatbázis objektumát.


def get_current_active_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        user_id: str = payload.get("sub")
        if user_id is None:
            print("HIBA: A tokenben nincs 'sub' (user_id) mező.")
            raise credentials_exception
    except JWTError as e:
        print(f"HIBA: JWT dekódolási hiba: {e}")
        raise credentials_exception
    # --- KITERJESZTETT HIBAELKÉZELÉS ADATBÁZIS HIBA ESETÉN ---
    try:
        user = db.query(User).filter(User.user_id == int(user_id)).first()
    except Exception as e:
        import traceback
        print("\n" + "="*50)
        print("!!! KRITIKUS ADATBÁZIS HIBA A /users/me HÍVÁSNÁL !!!")
        print(f"Hibaüzenet: {e}")
        print("Részletes Traceback:")
        print(traceback.format_exc())
        print("="*50 + "\n")
        raise HTTPException(status_code=500, detail="Database connection error")

    if user is None:
        print(f"HIBA: Nem található user ezzel az ID-val: {user_id}")
        raise credentials_exception
        
    return user

    
# ======== Schemas ========
class RegisterIn(BaseModel):
    email: EmailStr
    user_name: str = Field(min_length=2, max_length=100)
    password: str = Field(min_length=6, max_length=128)
    

class TokenOut(BaseModel):
    access_token: str

class LoginIn(BaseModel):
    email: EmailStr
    password: str

# --- Biztonságos kimenet ---
# Erre azért van szükség, hogy a jelszó-hasht SOHA ne küldjük vissza a frontendnek.
class UserOut(BaseModel):
    user_id: int
    email: EmailStr
    user_name: str
    date_of_birth: date
    height_cm: float
    sex: str

    class Config:
        from_attributes = True

# ======== Routes ========
@router.post("/register", response_model=TokenOut)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    try:
        # --- 1. Szigorú E-mail Validáció (DNS ellenőrzéssel) ---
        try:
            valid = validate_email(user_in.email, check_deliverability=True)
            email_normalized = valid.email
        except EmailNotValidError as e:
            raise HTTPException(status_code=400, detail=f"Érvénytelen e-mail cím: {str(e)}")

        # --- 2. Dupla regisztráció szűrése ---
        if db.query(User).filter(User.email == email_normalized).first():
            raise HTTPException(status_code=400, detail="Ezzel az e-mail címmel már regisztráltak.")

        # --- 3. Jelszó hash ---
        try:
            password_hash = pbkdf2_sha256.hash(user_in.password)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Hiba a jelszó titkosításakor: {e}")

        # --- 4. Mentés az adatbázisba ---
        u = User(
            email=email_normalized,
            user_name=user_in.user_name,
            password_hash=password_hash,
            date_of_birth=getattr(user_in, 'date_of_birth', None),
            height_cm=getattr(user_in, 'height_cm', None),
            sex=getattr(user_in, 'sex', None)
        )
        db.add(u)
        db.commit()
        db.refresh(u)

        # --- 5. Token kiadása ---
        token = jwt.encode({"sub": str(u.user_id)}, JWT_SECRET, algorithm=JWT_ALG)
        return {"access_token": token}
    
    except HTTPException:
        raise
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Ezzel az e-mail címmel már regisztráltak.")
    except Exception as e:
        db.rollback()
        trace = traceback.format_exc(limit=1)
        raise HTTPException(status_code=500, detail=f"Internal error: {e}")
    
    
@router.post("/login", response_model=TokenOut)
def login(payload: LoginIn, db: Session = Depends(get_db)):
    u = db.query(User).filter(User.email == payload.email).first()
    if not u or not pbkdf2_sha256.verify(payload.password, str(u.password_hash)):
        raise HTTPException(401, "Invalid credentials")
    token = jwt.encode({"sub": str(u.user_id)}, JWT_SECRET, algorithm=JWT_ALG)
    return {"access_token": token}


# --- ÚJ VÉGPONT KEZDETE (/users/me) ---
@router.get("/users/me", response_model=UserOut)
def read_users_me(current_user: User = Depends(get_current_active_user)):
    """
    Lekéri a bejelentkezett felhasználó adatait a token alapján.
    """
    return current_user
