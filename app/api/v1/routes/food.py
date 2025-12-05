# app/api/v1/routes/food.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import select
from datetime import date
from typing import List, Optional

from app.db.session import SessionLocal
from app.api.v1.routes.auth import get_current_active_user, get_db
from app.models.user import User
from app.models.food_item import FoodItem, FoodDietTypeLink
from app.models.allergen import Allergen
from app.models.diet_type import DietType
from app.models.diet_profile import DietProfile
from app.models.user_food_log import UserFoodLog
from app.models.user_allergy import UserAllergy 

from pydantic import BaseModel
from app.api.v1.schemas.food_check import FoodCheckResponse

router = APIRouter(prefix="/foods", tags=["foods"])

# ... (A Sémák változatlanok maradnak: AllergenOut, DietTypeOut, FoodItemOut) ...
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
    diet_types: List[DietTypeOut] = []

    class Config:
        from_attributes = True

# --- ITT A MÓDOSÍTÁS ---

@router.get("/search", response_model=List[FoodItemOut])
def search_foods(
    q: str = Query(..., min_length=3, description="Keresőkifejezés"),
    limit: int = Query(20, gt=0, le=100),
    db: Session = Depends(get_db)
):
    search_term = f"%{q.lower()}%"
    
    # 1. Alap lekérdezés indítása
    stmt = select(FoodItem)

    # --- DEMO KAPCSOLÓ (IF RÉSZ) ---
    # Ezt a változót állítsd át False-ra, ha látni akarod a régi adatokat is!
    SHOW_ONLY_DEMO = False

    if SHOW_ONLY_DEMO:
        # Ha be van kapcsolva, hozzáadjuk a szűrést:
        stmt = stmt.where(FoodItem.is_demo == True)
    # -------------------------------

    # 2. Folytatjuk a lekérdezés építését (láncolás)
    stmt = (
        stmt
        .where(FoodItem.food_name.ilike(search_term))
        .options(
            selectinload(FoodItem.allergens),
            selectinload(FoodItem.diet_links).selectinload(FoodDietTypeLink.diet_type)
        )
        .limit(limit)
    )
    
    results = db.execute(stmt).scalars().unique().all()
    
    response_data = []
    for item in results:
        item_data = FoodItemOut.from_orm(item)
        item_data.diet_types = [DietTypeOut.from_orm(link.diet_type) for link in item.diet_links]
        response_data.append(item_data)

    return response_data

# ... (A check_food_safety függvény változatlan marad) ...
@router.get("/{food_id}/check", response_model=FoodCheckResponse)
def check_food_safety(
    food_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    warnings = []
    is_safe = True

    # 1. Étel lekérése (és betöltjük az allergénjeit)
    food = db.query(FoodItem).options(selectinload(FoodItem.allergens)).filter(FoodItem.food_id == food_id).first()
    if not food:
        raise HTTPException(status_code=404, detail="Food not found")

    # 2. ALLERGIA VIZSGÁLAT - A GOLYÓÁLLÓ MÓDSZER
    user_allergy_records = db.query(UserAllergy).filter(UserAllergy.user_id == current_user.user_id).all()
    my_allergen_ids = [record.allergen_id for record in user_allergy_records]
    
    for food_allergen in food.allergens:
        if food_allergen.allergen_id in my_allergen_ids:
            is_safe = False
            warnings.append(f"VESZÉLY: {food_allergen.allergen_name}-t tartalmazhat!")

    # 3. MAKRÓ VIZSGÁLAT
    active_profile = db.query(DietProfile).filter(
        DietProfile.user_id == current_user.user_id, 
        DietProfile.is_active == 1
    ).first()

    if active_profile:
        today_logs = db.query(UserFoodLog, FoodItem).join(FoodItem).filter(
            UserFoodLog.user_id == current_user.user_id,
            UserFoodLog.date == date.today()
        ).all()

        consumed_fat = 0
        consumed_carbs = 0
        for log, item in today_logs:
            ratio = log.quantity_grams / 100.0
            consumed_fat += (item.fat_100g or 0) * ratio
            consumed_carbs += (item.carbs_100g or 0) * ratio
        
        t_fat = active_profile.fat or 0
        t_carbs = active_profile.carbs or 0
        rem_fat = max(0, t_fat - consumed_fat)
        rem_carbs = max(0, t_carbs - consumed_carbs)

        if (food.fat_100g or 0) > rem_fat and rem_fat > 0:
            warnings.append(f"Vigyázz: 100g ebből túllépi a maradék zsírkereted ({round(rem_fat)}g)!")
        
        if (food.carbs_100g or 0) > rem_carbs and rem_carbs > 0:
            warnings.append(f"Vigyázz: 100g ebből túllépi a maradék szénhidrátkereted ({round(rem_carbs)}g)!")

    return FoodCheckResponse(is_safe=is_safe, warnings=warnings)