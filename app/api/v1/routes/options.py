from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel

from app.api.v1.routes.auth import get_db
from app.models.allergen import Allergen
from app.models.injury import Injury
from app.models.health_condition import HealthCondition
from app.models.medication import Medication

router = APIRouter(prefix="/options", tags=["options"])

# Egyszerű kimeneti sémák
class OptionOut(BaseModel):
    id: int
    name: str
    class Config:
        from_attributes = True

@router.get("/allergens", response_model=List[OptionOut])
def get_allergens(db: Session = Depends(get_db)):
    items = db.query(Allergen).all()
    return [{"id": i.allergen_id, "name": i.allergen_name} for i in items]

@router.get("/injuries", response_model=List[OptionOut])
def get_injuries(db: Session = Depends(get_db)):
    items = db.query(Injury).all()
    return [{"id": i.injury_id, "name": i.injury_name} for i in items]

@router.get("/conditions", response_model=List[OptionOut])
def get_conditions(db: Session = Depends(get_db)):
    items = db.query(HealthCondition).all()
    return [{"id": i.condition_id, "name": i.condition_name} for i in items]