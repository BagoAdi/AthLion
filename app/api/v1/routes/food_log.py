# app/api/v1/routes/food_log.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from datetime import date 
from typing import List

# Modellek és Adatbázis
from app.db.session import SessionLocal
from app.api.v1.deps import get_current_active_user, get_db
from app.models.user import User
from app.models.user_food_log import UserFoodLog
from app.models.food_item import FoodItem

# Pydantic sémák
from pydantic import BaseModel

router = APIRouter(prefix="/food_log", tags=["food_log"])

# --- SÉMÁK ---
class FoodLogCreate(BaseModel):
    food_id: int
    meal_type: str  # 'breakfast', 'lunch', 'dinner', 'snacks'
    quantity_grams: float
    date: date

class FoodLogOut(BaseModel):
    log_id: int
    food_id: int
    food_name: str
    meal_type: str
    quantity_grams: float
    kcal_100g: float
    protein_100g: float
    carbs_100g: float
    fat_100g: float
    
    class Config:
        from_attributes = True

# --- VÉGPONTOK ---

@router.get("/", response_model=List[FoodLogOut])
def get_daily_log(
    date_str: str = Query(..., description="Dátum YYYY-MM-DD formátumban"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    try:
        target_date = date.fromisoformat(date_str)
    except ValueError:
        target_date = date.today()

    logs = db.query(UserFoodLog).options(joinedload(UserFoodLog.food_item)).filter(
        UserFoodLog.user_id == current_user.user_id,
        UserFoodLog.date == target_date
    ).all()

    results = []
    for log in logs:
        if log.food_item:
            results.append({
                "log_id": log.log_id,
                "food_id": log.food_id,
                "food_name": log.food_item.food_name,
                "meal_type": log.meal_type,
                "quantity_grams": log.quantity_grams,
                "kcal_100g": log.food_item.kcal_100g or 0,
                "protein_100g": log.food_item.protein_100g or 0,
                "carbs_100g": log.food_item.carbs_100g or 0,
                "fat_100g": log.food_item.fat_100g or 0
            })
    return results

@router.post("/", response_model=FoodLogOut)
def add_food_log(
    log_in: FoodLogCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    food = db.query(FoodItem).get(log_in.food_id)
    if not food:
        raise HTTPException(status_code=404, detail="Étel nem található")

    new_log = UserFoodLog(
        user_id=current_user.user_id,
        food_id=log_in.food_id,
        meal_type=log_in.meal_type,
        quantity_grams=log_in.quantity_grams,
        date=log_in.date
    )
    
    db.add(new_log)
    db.commit()
    db.refresh(new_log)
    
    return {
        "log_id": new_log.log_id,
        "food_id": food.food_id,
        "food_name": food.food_name,
        "meal_type": new_log.meal_type,
        "quantity_grams": new_log.quantity_grams,
        "kcal_100g": food.kcal_100g or 0,
        "protein_100g": food.protein_100g or 0,
        "carbs_100g": food.carbs_100g or 0,
        "fat_100g": food.fat_100g or 0
    }

@router.delete("/meal")
def delete_meal_group(
    date_str: str = Query(...), # <--- FONTOS: Query(...)
    meal_type: str = Query(...), # <--- FONTOS: Query(...)
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    CSOPORTOS TÖRLÉS
    """
    try:
        target_date = date.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Hibás dátum formátum")

    deleted_count = db.query(UserFoodLog).filter(
        UserFoodLog.user_id == current_user.user_id,
        UserFoodLog.date == target_date,
        UserFoodLog.meal_type == meal_type
    ).delete(synchronize_session=False)

    db.commit()
    
    return {"msg": f"Törölve: {deleted_count} tétel."}

@router.delete("/{log_id}")
def delete_food_log(
    log_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    log_entry = db.query(UserFoodLog).filter(
        UserFoodLog.log_id == log_id,
        UserFoodLog.user_id == current_user.user_id
    ).first()

    if not log_entry:
        raise HTTPException(status_code=404, detail="Bejegyzés nem található")

    db.delete(log_entry)
    db.commit()
    
    return {"msg": "Sikeresen törölve"}
