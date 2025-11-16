# app/api/v1/routes/setup.py
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from datetime import datetime

from app.models.user import User
from app.models.start_state import StartState
from app.models.diet_profile import DietProfile
from app.models.training_profile import TrainingProfile
from app.api.v1.routes.auth import get_current_active_user, get_db
 
from app.api.v1.schemas.setup_schemas import SetupIn, SetupOut, ProfileOut, ProfileUpdate

router = APIRouter(prefix="/setup", tags=["setup"])


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
    
@router.get("/active", response_model=ProfileOut)
def get_active_profile(
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_active_user)
):
    """
    Visszaadja a bejelentkezett felhasználó aktív profilbeállításait.
    """
    # 1. Keressük meg az aktív training profilt
    active_training_profile = db.query(TrainingProfile).filter(
        TrainingProfile.user_id == current_user.user_id,
        TrainingProfile.is_active == 1
    ).first()

    if not active_training_profile:
        raise HTTPException(status_code=404, detail="Active TrainingProfile not found.")

    # 2. Az ahhoz tartozó start state-et töltsük be
    start_state = db.query(StartState).filter(
        StartState.start_id == active_training_profile.start_id
    ).first()
    
    if not start_state:
        raise HTTPException(status_code=404, detail="Active StartState not found.")

    # 3. Építsük össze a válasz sémát
    return ProfileOut(
        start_weight_kg=start_state.start_weight_kg,
        target_weight_kg=start_state.target_weight_kg,
        goal_type=start_state.goal_type,
        load_level=active_training_profile.load_level
    )

@router.put("/active", response_model=SetupOut)
def update_active_profile(
    payload: ProfileUpdate,
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_active_user)
):
    """
    Frissíti a bejelentkezett felhasználó aktív profilbeállításait.
    """
    # 1. Keressük meg az aktív training profilt
    active_training_profile = db.query(TrainingProfile).filter(
        TrainingProfile.user_id == current_user.user_id,
        TrainingProfile.is_active == 1
    ).first()

    if not active_training_profile:
        raise HTTPException(status_code=404, detail="Active TrainingProfile not found.")

    # 2. Keressük meg a hozzá tartozó start state-et
    start_state = db.query(StartState).filter(
        StartState.start_id == active_training_profile.start_id
    ).first()
    
    if not start_state:
        raise HTTPException(status_code=404, detail="Active StartState not found.")

    # ... az update_active_profile függvény fejlécében ...
    try:
        update_data = payload.dict(exclude_unset=True)
        
        # 3. Frissítés (csak ami nem None)
        # Ezek a StartState táblát frissítik
        if "target_weight_kg" in update_data:
            start_state.target_weight_kg = update_data["target_weight_kg"]
        
        # --- INNENTŐL ADD HOZZÁ ---
        if "start_weight_kg" in update_data:
            start_state.start_weight_kg = update_data["start_weight_kg"]

        if "goal_type" in update_data:
            start_state.goal_type = update_data["goal_type"]
        # --- EDDIG ---
            
        db.add(start_state) # Elég egyszer hozzáadni
            
        # Ez a TrainingProfile táblát frissíti
        if "load_level" in update_data:
            active_training_profile.load_level = update_data["load_level"]
            db.add(active_training_profile)

        db.commit()
        return SetupOut(status="success")
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")