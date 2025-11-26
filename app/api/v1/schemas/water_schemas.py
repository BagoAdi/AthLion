from pydantic import BaseModel, Field
from datetime import date

class WaterLogCreate(BaseModel):
    amount_ml: int = Field(..., description="Víz mennyisége ml-ben")
    date: date

class WaterLogOut(BaseModel):
    log_id: int
    amount_ml: int
    date: date

    class Config:
        from_attributes = True