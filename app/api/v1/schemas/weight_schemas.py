from pydantic import BaseModel
import datetime
from typing import Optional

# Közös alap
class WeightLogBase(BaseModel):
    weight_kg: float
    date: datetime.date = datetime.date.today()

# Amit a klienstől várunk (Input)
class WeightLogIn(WeightLogBase):
    pass

# Amit a kliensnek visszaküldünk (Output)
class WeightLogOut(WeightLogBase):
    log_id: int
    
    class Config:
        from_attributes = True