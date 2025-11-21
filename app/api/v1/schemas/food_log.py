from pydantic import BaseModel, Field
from datetime import date
from typing import Optional

class FoodLogEntryIn(BaseModel):
    """Séma egy étel hozzáadására a napi loghoz."""
    food_id: int
    meal_type: str = Field(..., max_length=50, description="pl.: 'breakfast', 'lunch'")
    quantity_grams: float = Field(..., gt=0)
    date: date # Dátum, amire mentjük

class FoodLogEntryOut(BaseModel):
    """Séma egy mentett log bejegyzés visszaadására,
    a frontend számára szükséges adatokkal."""
    log_id: int
    date: date
    meal_type: str
    quantity_grams: float
    food_name: str
    
    # Makró adatok (a frontendnek kell a makrók újraszámításához)
    kcal_100g: float
    protein_100g: float
    carbs_100g: float
    fat_100g: float

    class Config:
        from_attributes = True