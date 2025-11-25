from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from sqlalchemy import desc

from app.api.v1.deps import get_current_user, get_db
from app.models.user import User
from app.models.user_weight_log import UserWeightLog
from app.api.v1.schemas.weight_schemas import WeightLogIn, WeightLogOut

router = APIRouter(prefix="/weight", tags=["weight"])

@router.post("/", response_model=WeightLogOut)
def log_weight(
    payload: WeightLogIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Új súlymérés rögzítése a mai (vagy megadott) dátummal."""
    new_log = UserWeightLog(
        user_id=current_user.user_id,
        weight_kg=payload.weight_kg,
        date=payload.date
    )
    
    db.add(new_log)
    db.commit()
    db.refresh(new_log)
    return new_log

@router.get("/history", response_model=List[WeightLogOut])
def get_weight_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Visszaadja a teljes súlytörténetet időrendben (grafikonhoz)."""
    logs = db.query(UserWeightLog).filter(
        UserWeightLog.user_id == current_user.user_id
    ).order_by(UserWeightLog.date.asc()).all()
    
    return logs

@router.get("/latest", response_model=WeightLogOut)
def get_latest_weight(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Visszaadja a legfrissebb mérést."""
    latest = db.query(UserWeightLog).filter(
        UserWeightLog.user_id == current_user.user_id
    ).order_by(UserWeightLog.date.desc(), UserWeightLog.log_id.desc()).first()
    
    if not latest:
        raise HTTPException(status_code=404, detail="Nincs rögzített súlyadat.")
        
    return latest