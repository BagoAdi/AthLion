from pydantic import BaseModel
from typing import List

class FoodCheckResponse(BaseModel):
    is_safe: bool          # False, ha allergén van benne
    warnings: List[str]    # A hibaüzenetek listája (pl. "Mogyorót tartalmaz!")