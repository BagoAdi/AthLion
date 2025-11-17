# app/api/v1/schemas/physical_activity.py
from pydantic import BaseModel
from typing import Optional


class PhysicalActivityOut(BaseModel):
    id: int
    name: str          # a DB-ben: specific_activities
    met: float
    major_heading: Optional[str] = None

    class Config:
        orm_mode = True
