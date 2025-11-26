from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from datetime import date
from typing import List

from app.db.session import SessionLocal
from app.api.v1.deps import get_current_active_user, get_db
from app.models.user import User
from app.models.user_water_log import UserWaterLog
from app.api.v1.schemas.water_schemas import WaterLogCreate, WaterLogOut

router = APIRouter(prefix="/water", tags=["water"])

@router.get("/daily_sum")
def get_daily_water_sum(
    date_str: str = Query(..., description="YYYY-MM-DD"),
    temp: int = Query(0, description="Cache busting timestamp"), # <--- EZ A KULCS!
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    try:
        target_date = date.fromisoformat(date_str)
    except ValueError:
        target_date = date.today()
    
    # Debug kiírás a terminálba (hogy lásd, tényleg megjön-e a kérés)
    print(f"💧 VÍZ LEKÉRÉS: User={current_user.email}, Dátum={target_date}")

    total = db.query(func.sum(UserWaterLog.amount_ml)).filter(
        UserWaterLog.user_id == current_user.user_id,
        UserWaterLog.date == target_date
    ).scalar()
    
    val = total or 0
    print(f"   -> Eredmény: {val} ml")
    
    return {"total_ml": val}

@router.post("/", response_model=WaterLogOut)
def add_water_log(
    log_in: WaterLogCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Új vízbevitel rögzítése (pl. egy pohár víz)."""
    new_log = UserWaterLog(
        user_id=current_user.user_id,
        date=log_in.date,
        amount_ml=log_in.amount_ml
    )
    db.add(new_log)
    db.commit()
    db.refresh(new_log)
    return new_log

@router.delete("/{log_id}")
def delete_water_log(
    log_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Vízbevitel törlése."""
    log = db.query(UserWaterLog).filter(
        UserWaterLog.log_id == log_id,
        UserWaterLog.user_id == current_user.user_id
    ).first()
    
    if not log:
        raise HTTPException(status_code=404, detail="Nem található")
        
    db.delete(log)
    db.commit()
    return {"msg": "Törölve"}