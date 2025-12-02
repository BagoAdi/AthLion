# app/schemas.py
from pydantic import BaseModel, EmailStr, Field
from datetime import date, datetime
from typing import Optional, List, Any, Dict
from typing import Optional, List, Dict, Any

# Config beállítás, hogy a Pydantic olvassa az SQL modelleket
class Config:
    from_attributes = True

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

# ======== Training Profile ========

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

# ======== User (FRISSÍTVE AZ ÚJ LOGIKÁHOZ) ========

class UserCreate(BaseModel):
    """
    Regisztrációhoz: Csak a szentháromság.
    A többi adatot (kor, súly, magasság) majd a Setup oldalon adjuk hozzá.
    """
    user_name: str
    email: EmailStr
    password: str

class UserUpdate(BaseModel):
    """
    Profil frissítéshez (pl. a Setup oldalról).
    Itt már beállíthatjuk a születésnapot és a nemet is.
    """
    user_name: Optional[str] = None
    height_cm: Optional[float] = None
    date_of_birth: Optional[date] = None # Hozzáadva a Setuphoz
    sex: Optional[str] = None           # Hozzáadva a Setuphoz
    dashboard_config: Optional[List[Dict[str, Any]]] = None

class UserOut(BaseModel):
    """
    Felhasználó adatainak visszaadása.
    Fontos: A fizikai adatok (birth, height, sex) opcionálisak,
    mert regisztráció után közvetlenül még nincsenek kitöltve!
    """
    user_id: int
    email: EmailStr
    user_name: str
    created_at: datetime

    # Ezeket átállítottuk Optional-ra, hogy ne dobjon hibát regisztrációkor
    date_of_birth: Optional[date] = None
    height_cm: Optional[float] = None
    sex: Optional[str] = None

    dashboard_config: Optional[List[Dict[str, Any]]] = None

    training_profiles: List[TrainingProfileOut] = [] 
    
    class Config(Config):
        pass

# ========= Workout Log ========

class WorkoutLogBase(BaseModel):
    date: date
    mode: str
    day_type: Optional[str] = None
    data: Dict[str, Any] 

class WorkoutLogCreate(WorkoutLogBase):
    pass

class WorkoutLogOut(WorkoutLogBase):
    id: int
    user_id: int

    class Config(Config):
        pass