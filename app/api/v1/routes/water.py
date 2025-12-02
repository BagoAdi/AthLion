from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date
from datetime import date, datetime
from pydantic import BaseModel
from typing import Optional

from app.api.v1.routes.auth import get_db
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.user_water_log import UserWaterLog

router = APIRouter(prefix="/water", tags=["water"])

class WaterAdd(BaseModel):
    amount_ml: int
    date: Optional[str] = None  # Opcionálissá tesszük, ha a frontend küldi

# --- EZT A VÉGPONTOT KERESTE A DIET.JS, DE NEM VOLT MEG ---
@router.get("/daily_sum")
def get_water_daily_sum(
    date_str: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Adott nap vízfogyasztása (YYYY-MM-DD formátum)"""
    try:
        query_date = date.fromisoformat(date_str)
    except ValueError:
        # Ha rossz a dátum, legyen a mai
        query_date = date.today()

    total_ml = db.query(func.sum(UserWaterLog.amount_ml)).filter(
        UserWaterLog.user_id == current_user.user_id,
        UserWaterLog.date == query_date
    ).scalar() or 0
    
    # A diet.js { total_ml: ... } formátumot vár
    return {"total_ml": int(total_ml)}

@router.get("/today")
def get_water_today(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Visszaadja a mai vízfogyasztást és a célt (Dashboardnak)."""
    today = date.today()
    
    total_ml = db.query(func.sum(UserWaterLog.amount_ml)).filter(
        UserWaterLog.user_id == current_user.user_id,
        UserWaterLog.date == today
    ).scalar() or 0

    target = 2500 

    return {"current": int(total_ml), "target": target}

@router.post("/add")
def add_water(
    payload: WaterAdd,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Hozzáad egy adag vizet."""
    # Ha a frontend küld dátumot, azt használjuk, ha nem, akkor a mait
    if payload.date:
        try:
            log_date = date.fromisoformat(payload.date)
        except ValueError:
            log_date = date.today()
    else:
        log_date = date.today()

    new_log = UserWaterLog(
        user_id=current_user.user_id,
        amount_ml=payload.amount_ml,
        date=log_date
    )
    db.add(new_log)
    db.commit()
    
    return {"message": "Sikeres mentés", "added": payload.amount_ml}