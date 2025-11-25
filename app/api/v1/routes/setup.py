# app/api/v1/routes/setup.py
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from datetime import datetime, date

from app.models.user import User
from app.models.start_state import StartState
from app.models.diet_profile import DietProfile
from app.models.training_profile import TrainingProfile
from app.models.user_allergy import UserAllergy
from app.models.user_injury import UserInjury
from app.models.user_condition import UserCondition
from app.models.user_medication import UserMedication
from app.models.user_weight_log import UserWeightLog

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
        # 1. Új StartState létrehozása
        new_start_state = StartState(
            start_weight_kg=payload.start_weight_kg,
            target_weight_kg=payload.target_weight_kg,
            goal_type=payload.goal_type,
            motivation_goal="Kezdő beállítás",
            created_at=datetime.now().isoformat()
        )
        db.add(new_start_state)
        db.flush() 

        # 2. Új TrainingProfile létrehozása
        new_training_profile = TrainingProfile(
            user_id=current_user.user_id,
            start_id=new_start_state.start_id,
            load_level=payload.load_level,
            program_time=payload.program_time,
            preference=payload.preference,
            is_active=1
        )
        db.add(new_training_profile)

        # 3. Új DietProfile létrehozása
        # ITT A JAVÍTÁS: A 'diet_preference'-t mentjük el, nem a 'goal_type'-ot!
        new_diet_profile = DietProfile(
            user_id=current_user.user_id,
            start_id=new_start_state.start_id,
            diet_type=payload.diet_preference, 
            is_active=1
        )
        db.add(new_diet_profile)

        # 4. Egészségügyi adatok mentése
        
        # Allergiák
        for alg_id in payload.allergy_ids:
            db.add(UserAllergy(user_id=current_user.user_id, allergen_id=alg_id, severity=1))

        # Sérülések
        for inj_id in payload.injury_ids:
            db.add(UserInjury(user_id=current_user.user_id, injury_id=inj_id, status="active"))

        # Egészségügyi állapotok
        for cond_id in payload.condition_ids:
            db.add(UserCondition(user_id=current_user.user_id, condition_id=cond_id))

        # Gyógyszerek
        for med_id in payload.medication_ids:
            db.add(UserMedication(user_id=current_user.user_id, medication_id=med_id))

        # 5. Kezdősúly rögzítése a naplóban is (hogy a mai dátummal legyen mérés)
        initial_weight_log = UserWeightLog(
            user_id=current_user.user_id,
            weight_kg=payload.start_weight_kg,
            date=date.today()
        )
        db.add(initial_weight_log)

        db.commit()
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
    # 1. Training profil keresése
    active_training_profile = db.query(TrainingProfile).filter(
        TrainingProfile.user_id == current_user.user_id,
        TrainingProfile.is_active == 1
    ).first()

    if not active_training_profile:
        raise HTTPException(status_code=404, detail="Active TrainingProfile not found.")

    # 2. Start state keresése
    start_state = db.query(StartState).filter(
        StartState.start_id == active_training_profile.start_id
    ).first()
    
    if not start_state:
        raise HTTPException(status_code=404, detail="Active StartState not found.")

    # 3. Diet profil keresése (az új mező miatt)
    active_diet_profile = db.query(DietProfile).filter(
        DietProfile.user_id == current_user.user_id,
        DietProfile.is_active == 1
    ).first()

    # Listák kinyerése a current_user relációkból
    allergy_ids = [a.allergen_id for a in current_user.allergies]
    injury_ids = [i.injury_id for i in current_user.injuries]
    condition_ids = [c.condition_id for c in current_user.conditions]
    medication_ids = [m.medication_id for m in current_user.medications]

    # Válasz összeállítása
    return ProfileOut(
        start_weight_kg=start_state.start_weight_kg,
        target_weight_kg=start_state.target_weight_kg,
        goal_type=start_state.goal_type,
        # ITT A JAVÍTÁS: Visszaadjuk a diéta preferenciát is
        diet_preference=active_diet_profile.diet_type if active_diet_profile else "Vegyes",
        load_level=active_training_profile.load_level,
        allergy_ids=allergy_ids,
        injury_ids=injury_ids,
        condition_ids=condition_ids,
        medication_ids=medication_ids
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
    # 1. Profilok betöltése
    active_training_profile = db.query(TrainingProfile).filter(
        TrainingProfile.user_id == current_user.user_id,
        TrainingProfile.is_active == 1
    ).first()

    if not active_training_profile:
        raise HTTPException(status_code=404, detail="Active TrainingProfile not found.")

    start_state = db.query(StartState).filter(
        StartState.start_id == active_training_profile.start_id
    ).first()
    
    if not start_state:
        raise HTTPException(status_code=404, detail="Active StartState not found.")

    # A DietProfilt is be kell tölteni a frissítéshez
    active_diet_profile = db.query(DietProfile).filter(
        DietProfile.user_id == current_user.user_id,
        DietProfile.is_active == 1
    ).first()

    try:
        update_data = payload.dict(exclude_unset=True)
        
        # 2. StartState frissítése
        if "target_weight_kg" in update_data:
            start_state.target_weight_kg = update_data["target_weight_kg"]
        
        if "start_weight_kg" in update_data:
            new_weight = update_data["start_weight_kg"]
            start_state.start_weight_kg = new_weight
            
            # Új súlynapló bejegyzés a változás miatt
            new_log = UserWeightLog(
                user_id=current_user.user_id,
                weight_kg=new_weight,
                date=date.today()
            )
            db.add(new_log)

        if "goal_type" in update_data:
            start_state.goal_type = update_data["goal_type"]
            
        db.add(start_state)
            
        # 3. TrainingProfile frissítése
        if "load_level" in update_data:
            active_training_profile.load_level = update_data["load_level"]
            db.add(active_training_profile)

        # 4. DietProfile frissítése (ITT A JAVÍTÁS)
        if "diet_preference" in update_data and active_diet_profile:
            active_diet_profile.diet_type = update_data["diet_preference"]
            db.add(active_diet_profile)

        # 5. Egészségügyi adatok (Listák) frissítése

        if "allergy_ids" in update_data:
            db.query(UserAllergy).filter(UserAllergy.user_id == current_user.user_id).delete()
            for aid in update_data["allergy_ids"]:
                db.add(UserAllergy(user_id=current_user.user_id, allergen_id=aid, severity=1))

        if "injury_ids" in update_data:
            db.query(UserInjury).filter(UserInjury.user_id == current_user.user_id).delete()
            for iid in update_data["injury_ids"]:
                db.add(UserInjury(user_id=current_user.user_id, injury_id=iid, status="active"))

        if "condition_ids" in update_data:
            db.query(UserCondition).filter(UserCondition.user_id == current_user.user_id).delete()
            for cid in update_data["condition_ids"]:
                db.add(UserCondition(user_id=current_user.user_id, condition_id=cid))

        if "medication_ids" in update_data:
            db.query(UserMedication).filter(UserMedication.user_id == current_user.user_id).delete()
            for mid in update_data["medication_ids"]:
                db.add(UserMedication(user_id=current_user.user_id, medication_id=mid))

        db.commit()
        return SetupOut(status="success")
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")