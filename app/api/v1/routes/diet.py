# app/api/v1/routes/diet.py
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.start_state import StartState
from app.models.diet_profile import DietProfile
from app.models.training_profile import TrainingProfile # <-- 1. ÚJ IMPORT
from app.api.v1.routes.auth import get_current_active_user, get_db
from app.api.v1.schemas.diet_schemas import DietCalcOut # <-- DietCalcIn törölve
from datetime import date

router = APIRouter(prefix="/diet", tags=["diet"])

def calculate_age(dob: date) -> int:
    """Segédfüggvény a kor kiszámításához a születési dátúmból."""
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, today.day))

@router.post("/calculate", response_model=DietCalcOut) # Maradhat POST, ez egy "akció"
def calculate_macros(
    # --- 2. VÁLTOZÁS: Töröltük a 'payload: DietCalcIn' paramétert ---
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Kiszámolja a felhasználó TDEE-jét és makróit
    A BEJELENTKEZETT FELHASZNÁLÓ ADATBÁZISBAN LÉVŐ BEÁLLÍTÁSAI ALAPJÁN.
    """
    
    # 1. Adatok lekérése (DietProfile, StartState, TrainingProfile)
    active_diet_profile = db.query(DietProfile).filter(
        DietProfile.user_id == current_user.user_id,
        DietProfile.is_active == 1
    ).first()
    
    active_training_profile = db.query(TrainingProfile).filter(
        TrainingProfile.user_id == current_user.user_id,
        TrainingProfile.is_active == 1
    ).first()

    if not active_diet_profile or not active_training_profile:
        raise HTTPException(status_code=404, detail="Active Diet or Training profile not found. Please complete setup.")

    start_state = db.query(StartState).filter(
        StartState.start_id == active_diet_profile.start_id
    ).first()

    if not start_state:
        raise HTTPException(status_code=404, detail="StartState not found. Please complete setup.")
    
    # 2. Adatok gyűjtése az adatbázisból
    weight = start_state.start_weight_kg
    goal = start_state.goal_type
    load_level_str = active_training_profile.load_level # pl. "Közepes"
    
    height = current_user.height_cm
    sex = current_user.sex
    age = calculate_age(current_user.date_of_birth)

    # 3. Aktivitási szorzó meghatározása a string alapján
    activity_map = {
        "Könnyű": 1.375,
        "Közepes": 1.55,
        "Nehéz": 1.725
    }
    activity_multiplier = activity_map.get(load_level_str)
    if not activity_multiplier:
        raise HTTPException(status_code=400, detail=f"Invalid load_level: {load_level_str}")

    if weight <= 0 or height <= 0 or age <= 0:
        raise HTTPException(status_code=400, detail="Invalid user data (weight, height, or age)")

    # 4. BMR (Alapanyagcsere) számítása (Mifflin-St Jeor Formula)
    s_value = 5 if sex.lower() == 'férfi' else -161 
    bmr = (10 * weight) + (6.25 * height) - (5 * age) + s_value

    # 5. TDEE (Teljes Napi Energiafelhasználás) számítása
    tdee = bmr * activity_multiplier

    # 6. Cél-kalória beállítása
    target_calories = tdee
    if goal == "weight_loss": 
        target_calories -= 400 
    elif goal == "muscle_gain": 
        target_calories += 300 

    # 7. Makrók számítása (g-ban)
    protein_g = weight * 1.8
    protein_kcal = protein_g * 4
    fat_kcal = target_calories * 0.25
    fat_g = fat_kcal / 9
    carbs_kcal = target_calories - protein_kcal - fat_kcal
    carbs_g = carbs_kcal / 4

    if carbs_g < 0:
        carbs_g = 0 

    return DietCalcOut(
        calories=round(target_calories),
        protein=round(protein_g),
        carbs=round(carbs_g),
        fat=round(fat_g)
    )