# app/api/v1/schemas/setup_schemas.py
from pydantic import BaseModel
from typing import List, Optional

class SetupIn(BaseModel):
    start_weight_kg: float
    target_weight_kg: float
    goal_type: str        # pl. "weight_loss"
    diet_preference: str
    load_level: str       # pl. "Közepes"
    program_time: str     # pl. "30-45 perc"
    preference: str       # pl. "Vegyes"
    allergy_ids: List[int] = []
    injury_ids: List[int] = []
    condition_ids: List[int] = []
    medication_ids: List[int] = []

class SetupOut(BaseModel):
    status: str

class ProfileOut(BaseModel):
    """
    Séma a jelenlegi, aktív profilbeállítások visszaadására.
    """
    start_weight_kg: float
    target_weight_kg: float
    goal_type: str
    diet_preference: Optional[str] = None
    load_level: str
    allergy_ids: List[int] = []
    injury_ids: List[int] = []
    condition_ids: List[int] = []

    class Config:
        from_attributes = True

class ProfileUpdate(BaseModel):
    """
    Séma a profilbeállítások frissítéséhez (minden opcionális).
    """
    start_weight_kg: Optional[float] = None
    goal_type: Optional[str] = None
    diet_preference: Optional[str] = None
    target_weight_kg: Optional[float] = None
    load_level: Optional[str] = None
    allergy_ids: Optional[List[int]] = None
    injury_ids: Optional[List[int]] = None
    condition_ids: Optional[List[int]] = None
    medication_ids: Optional[List[int]] = None
