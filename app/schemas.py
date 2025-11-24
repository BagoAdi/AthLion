# app/schemas.py
from pydantic import BaseModel, EmailStr, Field
from datetime import date, datetime
from typing import Optional

# Használd a `from_attributes = True` beállítást,
# hogy a Pydantic modellek közvetlenül olvashassanak SQLAlchemy objektumokból.

class Config:
    from_attributes = True


# ======== Training Profile ========

class TrainingProfileOut(BaseModel):
    training_id: int
    start_id: int
    load_level: str
    program_time: Optional[str] = None
    preference: Optional[str] = None

    class Config:
        orm_mode = True

class TrainingProfileIn(BaseModel):
    """Séma edzésprofil létrehozásához."""
    start_id: int
    load_level: str = Field(max_length=50)
    program_time: str = Field(max_length=50)
    preference: Optional[str] = Field(None, max_length=100)
    
class TrainingProfileOut(BaseModel):
    """Séma edzésprofil visszaadásához."""
    training_id: int
    user_id: int
    start_id: int
    load_level: str
    program_time: str
    preference: Optional[str]
    is_active: int
    
    class Config(Config):
        pass

# ======== User ========

class UserOut(BaseModel):
    """Séma a felhasználói adatok biztonságos visszaadására (jelszó nélkül)."""
    user_id: int
    email: EmailStr
    user_name: str
    date_of_birth: date
    height_cm: float
    sex: str
    created_at: datetime

    
    training_profile: Optional[TrainingProfileOut] = None
    class Config(Config):
        pass

class UserUpdate(BaseModel):
    """Séma a felhasználói profil frissítéséhez (minden mező opcionális)."""
    user_name: Optional[str] = None
    height_cm: Optional[float] = None


# ======== Start State ========

class StartStateIn(BaseModel):
    """Séma a 'Start State' létrehozásához."""
    start_weight_kg: float
    target_weight_kg: float
    goal_type: str = Field(max_length=100)
    motivation_goal: Optional[str] = Field(None, max_length=255)

class StartStateOut(BaseModel):
    """Séma a 'Start State' visszaadásához."""
    start_id: int
    user_id: int
    start_weight_kg: float
    target_weight_kg: float
    goal_type: str
    motivation_goal: Optional[str]
    created_at: datetime
    
    class Config(Config):
        pass



# Ide tedd a többi sémát is (DietProfileIn/Out, UserAllergyIn/Out, stb.)
# ahogy haladtok előre.