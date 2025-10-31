# app/api/v1/routes/setup.py
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from datetime import datetime

from app.models.user import User
from app.models.start_state import StartState
from app.models.diet_profile import DietProfile
from app.models.training_profile import TrainingProfile
from app.api.v1.routes.auth import get_current_active_user, get_db

# --- 1. JAVÍTÁS: Importáld be az új SetupOut sémát ---
from app.api.v1.schemas.setup_schemas import SetupIn, SetupOut 

router = APIRouter(prefix="/setup", tags=["setup"])

# --- 2. JAVÍTÁS: Használd a SetupOut modellt a response_model-ben ---
@router.post("/initial", response_model=SetupOut)
def create_initial_setup(
    payload: SetupIn, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_active_user)
):
    """
    Létrehozza a felhasználó elsődleges beállításait (Start State, Diet Profile, Training Profile).
    """
    
    # Ellenőrzés: Létezik már profil?
    existing_profile = db.query(DietProfile).filter(DietProfile.user_id == current_user.user_id).first()
    if existing_profile:
        raise HTTPException(status_code=400, detail="User setup already completed.")

    try:
        # 2. Új StartState létrehozása
        new_start_state = StartState(
            start_weight_kg=payload.start_weight_kg,
            target_weight_kg=payload.target_weight_kg,
            goal_type=payload.goal_type,
            motivation_goal="Kezdő beállítás", # Opcionális mező kitöltése
            created_at=datetime.now().isoformat()
        )
        db.add(new_start_state)
        db.flush() 

        # 3. Új TrainingProfile létrehozása
        new_training_profile = TrainingProfile(
            user_id=current_user.user_id,
            start_id=new_start_state.start_id,
            load_level=payload.load_level,
            program_time=payload.program_time,
            preference=payload.preference,
            is_active=1
        )
        db.add(new_training_profile)

        # 4. Új DietProfile létrehozása
        new_diet_profile = DietProfile(
            user_id=current_user.user_id,
            start_id=new_start_state.start_id,
            diet_type=payload.goal_type, 
            is_active=1
        )
        db.add(new_diet_profile)

        # 5. Mentés
        db.commit()

        # --- 3. JAVÍTÁS: Add vissza a SetupOut sémának megfelelő objektumot ---
        return SetupOut(status="success")

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")