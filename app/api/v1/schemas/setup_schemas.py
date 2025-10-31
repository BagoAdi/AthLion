# app/api/v1/schemas/setup_schemas.py
from pydantic import BaseModel
from typing import Optional

class SetupIn(BaseModel):
    start_weight_kg: float
    target_weight_kg: float
    goal_type: str        # pl. "weight_loss"
    load_level: str       # pl. "Közepes"
    program_time: str     # pl. "30-45 perc"
    preference: str       # pl. "Vegyes"

# --- ÚJ OSZTÁLY HOZZÁADÁSA ---
# Ezzel definiáljuk a kimeneti JSON-t: {"status": "valami"}
class SetupOut(BaseModel):
    status: str
# --- ÚJ OSZTÁLY VÉGE ---