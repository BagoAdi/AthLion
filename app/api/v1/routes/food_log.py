from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from datetime import date
from typing import List

from app.db.session import SessionLocal
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.user_food_log import UserFoodLog
from app.models.food_item import FoodItem
from app.api.v1.schemas.food_log import FoodLogEntryIn, FoodLogEntryOut

router = APIRouter(prefix="/food_log", tags=["food_log"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/", response_model=FoodLogEntryOut, status_code=status.HTTP_201_CREATED)
def add_food_to_log(
    payload: FoodLogEntryIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Étel hozzáadása a felhasználó napi fogyasztási naplójához."""
    
    food_item = db.query(FoodItem).filter(FoodItem.food_id == payload.food_id).first()
    if not food_item:
        raise HTTPException(status_code=404, detail="Food item not found")

    new_entry = UserFoodLog(
        user_id=current_user.user_id,
        food_id=payload.food_id,
        date=payload.date,
        meal_type=payload.meal_type,
        quantity_grams=payload.quantity_grams,
    )
    
    try:
        db.add(new_entry)
        db.commit()
        db.refresh(new_entry)
        
        # Válasz összeállítása az FoodLogEntryOut séma szerint, a FoodItem adatokkal
        return FoodLogEntryOut(
            log_id=new_entry.log_id,
            date=new_entry.date,
            meal_type=new_entry.meal_type,
            quantity_grams=new_entry.quantity_grams,
            food_name=food_item.food_name,
            kcal_100g=food_item.kcal_100g or 0,
            protein_100g=food_item.protein_100g or 0,
            carbs_100g=food_item.carbs_100g or 0,
            fat_100g=food_item.fat_100g or 0
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")

@router.get("/", response_model=List[FoodLogEntryOut])
def get_daily_food_log(
    date_str: str = Query(..., description="Dátum YYYY-MM-DD formátumban"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Visszaadja a felhasználó adott napi étel logját."""
    try:
        target_date = date.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
        
    logs = (
        db.query(UserFoodLog, FoodItem)
        .join(FoodItem)
        .filter(
            UserFoodLog.user_id == current_user.user_id,
            UserFoodLog.date == target_date
        )
        .all()
    )
    
    response = []
    for log, food_item in logs:
        response.append(FoodLogEntryOut(
            log_id=log.log_id,
            date=log.date,
            meal_type=log.meal_type,
            quantity_grams=log.quantity_grams,
            food_name=food_item.food_name,
            kcal_100g=food_item.kcal_100g or 0,
            protein_100g=food_item.protein_100g or 0,
            carbs_100g=food_item.carbs_100g or 0,
            fat_100g=food_item.fat_100g or 0
        ))
        
    return response