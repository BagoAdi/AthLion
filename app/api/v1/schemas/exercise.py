# app/api/v1/schemas/exercise.py
from pydantic import BaseModel
from typing import Optional

class ExerciseOut(BaseModel):
    id: int
    name: str              # name_hu vagy fallback name_en
    level: Optional[str]
    force: Optional[str]
    primary_muscles: Optional[str]
    secondary_muscles: Optional[str]
    equipment: Optional[str]
    category: Optional[str]

    class Config:
        orm_mode = True
