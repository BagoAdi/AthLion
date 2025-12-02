# app/api/v1/routes/workouts.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import date, timedelta # Timedelta kell a streakhez

from app.api.v1.routes.auth import get_db
from app.models.user import User
from app.models.workout_log import WorkoutLog
from app.schemas import WorkoutLogCreate, WorkoutLogOut
from app.api.v1.deps import get_current_user

# Az eredeti import, ami jó volt:
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
    """Ment egy edzésnapot (Upsert logic)."""
    
    # 1. Kalória kalkuláció (EREDETI, MŰKÖDŐ LOGIKA)
    calories_burned = 0.0
    final_data = log_in.data.copy() if log_in.data else {}

    # Ha a Calculator hibát dobna, itt nem kapjuk el, mert "jó volt" a fájl.
    if log_in.mode == 'gym':
        duration = final_data.get('duration', 60)
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
        c_id = final_data.get('cardio_id')
        duration = final_data.get('duration', 30)
        
        if c_id:
            calories_burned = CalorieCalculator.estimate_cardio_session(
                db,
                user_id=current_user.user_id,
                duration_minutes=duration,
                physical_activity_id=c_id
            )

    final_data['calories_burned'] = calories_burned

    # 2. Mentés
    existing_log = db.query(WorkoutLog).filter(
        WorkoutLog.user_id == current_user.user_id,
        WorkoutLog.date == log_in.date
    ).first()

    result_log = None

    if existing_log:
        existing_log.mode = log_in.mode
        existing_log.day_type = log_in.day_type
        existing_log.data = final_data
        result_log = existing_log
    else:
        new_log = WorkoutLog(
            user_id=current_user.user_id,
            date=log_in.date,
            mode=log_in.mode,
            day_type=log_in.day_type,
            data=final_data
        )
        db.add(new_log)
        result_log = new_log
        
        # --- XP JUTALOM (Csak új edzésnél) ---
        # Ha hibát dob (pl. nincs current_xp oszlop), akkor a DB séma a baj
        if hasattr(current_user, 'current_xp'):
            current_user.current_xp = (current_user.current_xp or 0) + 50
            db.merge(current_user)

    db.commit()
    db.refresh(result_log)
    return result_log

# --- ÚJ VÉGPONT A DASHBOARDHOZ (STREAK) ---
@router.get("/weekly_streak")
def get_weekly_streak(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Heti edzésnapok lekérése a widgethez."""
    today = date.today()
    start_of_week = today - timedelta(days=today.weekday())
    
    logs = db.query(WorkoutLog.date).filter(
        WorkoutLog.user_id == current_user.user_id,
        WorkoutLog.date >= start_of_week
    ).all()
    
    active_days = set(log.date for log in logs)
    
    streak_data = []
    days_labels = ["H", "K", "Sz", "Cs", "P", "Sz", "V"]
    
    for i in range(7):
        loop_date = start_of_week + timedelta(days=i)
        streak_data.append({
            "day_index": i,
            "label": days_labels[i],
            "is_active": (loop_date in active_days),
            "is_today": (loop_date == today)
        })

    return {
        "days": streak_data,
        "count": len(active_days)
    }