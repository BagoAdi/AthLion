# app/api/v1/schemas/diet_schemas.py
from pydantic import BaseModel
from typing import Optional


# Ezt fogjuk visszaküldeni a számítás után
class DietCalcOut(BaseModel):
    calories: float
    protein: float
    carbs: float
    fat: float
    current_weight: float