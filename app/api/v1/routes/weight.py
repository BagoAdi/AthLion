from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from sqlalchemy import desc

from app.api.v1.deps import get_current_user, get_db
from app.models.user import User
from app.models.user_weight_log import UserWeightLog
from app.api.v1.schemas.weight_schemas import WeightLogIn, WeightLogOut
from app.models.diet_profile import DietProfile
from app.models.start_state import StartState

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

@router.get("/trend")
def get_weight_trend(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Visszaadja a kezdősúlyt és a jelenlegi súlyt, valamint a változást.
    """
    # 1. Jelenlegi súly (Legutolsó mérés)
    latest = db.query(UserWeightLog).filter(
        UserWeightLog.user_id == current_user.user_id
    ).order_by(UserWeightLog.date.desc(), UserWeightLog.log_id.desc()).first()

    current_weight = latest.weight_kg if latest else 0.0

    # 2. Kezdősúly meghatározása
    start_weight = 0.0
    
    # A: Megpróbáljuk a Profilból
    active_profile = db.query(DietProfile).filter(
        DietProfile.user_id == current_user.user_id, 
        DietProfile.is_active == 1
    ).first()

    if active_profile:
        st = db.query(StartState).filter(StartState.start_id == active_profile.start_id).first()
        if st:
            start_weight = st.start_weight_kg

    # B: Ha nincs profil, akkor a legelső mérés az alap
    if start_weight == 0.0:
        first_log = db.query(UserWeightLog).filter(
            UserWeightLog.user_id == current_user.user_id
        ).order_by(UserWeightLog.date.asc()).first()
        if first_log:
            start_weight = first_log.weight_kg
        else:
            # Ha még semmilyen adat nincs, akkor a start = jelenlegi
            start_weight = current_weight

    change = current_weight - start_weight

    return {
        "start": start_weight,
        "current": current_weight,
        "change": change
    }