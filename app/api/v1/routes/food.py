# app/api/v1/routes/foods.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import select
from app.db.session import SessionLocal
from app.models.food_item import FoodItem, FoodDietTypeLink
from app.models.allergen import Allergen
from app.models.diet_type import DietType
from pydantic import BaseModel, Field
from typing import List, Optional

router = APIRouter(prefix="/foods", tags=["foods"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- Pydantic Sémák a válaszhoz ---

class AllergenOut(BaseModel):
    allergen_id: int
    allergen_name: str
    class Config:
        from_attributes = True

class DietTypeOut(BaseModel):
    diet_type_id: int
    diet_name: str
    class Config:
        from_attributes = True

class FoodItemOut(BaseModel):
    food_id: int
    food_name: str
    kcal_100g: Optional[float]
    protein_100g: Optional[float]
    carbs_100g: Optional[float]
    fat_100g: Optional[float]
    
    allergens: List[AllergenOut] = []
    diet_types: List[DietTypeOut] = [] # Ezt külön töltjük fel

    class Config:
        from_attributes = True

@router.get("/search", response_model=List[FoodItemOut])
def search_foods(
    q: str = Query(..., min_length=3, description="Keresőkifejezés"),
    limit: int = Query(20, gt=0, le=100),
    db: Session = Depends(get_db)
):
    """
    Ételek keresése a saját adatbázisunkban.
    """
    search_term = f"%{q.lower()}%"
    
    # Szuperhatékony lekérdezés:
    # 1. Lekéri a FoodItem-et
    # 2. "selectinload" -> Külön lekérdezéssel, de hatékonyan betölti a kapcsolódó allergéneket
    # 3. "selectinload" -> Betölti a link-táblát, ÉS a hozzá tartozó diéta típust
    stmt = (
        select(FoodItem)
        .where(FoodItem.food_name.ilike(search_term))
        .options(
            selectinload(FoodItem.allergens),
            selectinload(FoodItem.diet_links).selectinload(FoodDietTypeLink.diet_type)
        )
        .limit(limit)
    )
    
    results = db.execute(stmt).scalars().unique().all()
    
    # Manuálisan összeállítjuk a választ, hogy a @property helyett a szép listát kapjuk
    response_data = []
    for item in results:
        item_data = FoodItemOut.from_orm(item)
        item_data.diet_types = [DietTypeOut.from_orm(link.diet_type) for link in item.diet_links]
        response_data.append(item_data)

    return response_data