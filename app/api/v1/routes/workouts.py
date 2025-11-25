# app/api/v1/routes/workouts.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import date

from app.api.v1.routes.auth import get_db
from app.models.user import User
from app.models.workout_log import WorkoutLog
from app.schemas import WorkoutLogCreate, WorkoutLogOut
from app.api.v1.deps import get_current_user

router = APIRouter(prefix="/workouts", tags=["workouts"])

@router.get("/", response_model=List[WorkoutLogOut])
def get_my_workouts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Visszaadja a bejelentkezett felhasználó összes edzésnaplóját."""
    logs = db.query(WorkoutLog).filter(WorkoutLog.user_id == current_user.user_id).all()
    return logs

@router.post("/", response_model=WorkoutLogOut)
def save_workout_log(
    log_in: WorkoutLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Ment egy edzésnapot. Ha már létezik arra a napra, felülírja (Upsert)."""
    
    # Megnézzük, van-e már mentése erre a napra
    existing_log = db.query(WorkoutLog).filter(
        WorkoutLog.user_id == current_user.user_id,
        WorkoutLog.date == log_in.date
    ).first()

    if existing_log:
        # Ha van, frissítjük
        existing_log.mode = log_in.mode
        existing_log.day_type = log_in.day_type
        existing_log.data = log_in.data
        db.commit()
        db.refresh(existing_log)
        return existing_log
    else:
        # Ha nincs, létrehozzuk
        new_log = WorkoutLog(
            user_id=current_user.user_id,
            date=log_in.date,
            mode=log_in.mode,
            day_type=log_in.day_type,
            data=log_in.data
        )
        db.add(new_log)
        db.commit()
        db.refresh(new_log)
        return new_log