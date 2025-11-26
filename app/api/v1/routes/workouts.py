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

# Itt importáljuk a kalkulátort. 
# Ha a fájlt máshova tetted, módosítsd az importot (pl. app.services...)
from app.services.calorie_calculator import CalorieCalculator

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
    
    # ---------------------------------------------------------------
    # 1. Kalória kalkuláció (SZILÍCIUM VÖLGY LOGIKA)
    # ---------------------------------------------------------------
    calories_burned = 0.0
    
    # A bejövő data egy dict, másolatot készítünk, hogy módosíthassuk
    final_data = log_in.data.copy() if log_in.data else {}

    if log_in.mode == 'gym':
        # Gym esetén: duration + gyakorlatok listája
        duration = final_data.get('duration', 60) # Default 60 perc, ha nincs megadva
        main_ids = final_data.get('main_ids', [])
        extra_ids = final_data.get('extra_ids', [])
        all_ids = main_ids + extra_ids
        
        calories_burned = CalorieCalculator.estimate_gym_session(
            db, 
            user_id=current_user.user_id, 
            duration_minutes=duration, 
            exercise_ids=all_ids
        )

    elif log_in.mode == 'cardio':
        # Cardio esetén: duration + cardio_id
        c_id = final_data.get('cardio_id')
        duration = final_data.get('duration', 30) # Default 30 perc
        
        if c_id:
            calories_burned = CalorieCalculator.estimate_cardio_session(
                db,
                user_id=current_user.user_id,
                duration_minutes=duration,
                physical_activity_id=c_id
            )

    # Elmentjük a számolt értéket a JSON-be, így a frontendnek csak meg kell jelenítenie
    final_data['calories_burned'] = calories_burned

    # ---------------------------------------------------------------
    # 2. Adatbázis mentés (Upsert)
    # ---------------------------------------------------------------
    
    # Megnézzük, van-e már mentése erre a napra
    existing_log = db.query(WorkoutLog).filter(
        WorkoutLog.user_id == current_user.user_id,
        WorkoutLog.date == log_in.date
    ).first()

    if existing_log:
        # Ha van, frissítjük
        existing_log.mode = log_in.mode
        existing_log.day_type = log_in.day_type
        existing_log.data = final_data # A frissített data a kalóriával
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
            data=final_data # A frissített data a kalóriával
        )
        db.add(new_log)
        db.commit()
        db.refresh(new_log)
        return new_log