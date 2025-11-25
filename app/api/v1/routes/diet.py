# app/api/v1/routes/diet.py
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.start_state import StartState
from app.models.diet_profile import DietProfile
from app.models.training_profile import TrainingProfile
from app.models.user_weight_log import UserWeightLog  # <-- ÚJ IMPORT!
from app.api.v1.routes.auth import get_current_active_user, get_db
from app.api.v1.schemas.diet_schemas import DietCalcOut
from datetime import date

router = APIRouter(prefix="/diet", tags=["diet"])

def calculate_age(dob: date) -> int:
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, today.day))

@router.post("/calculate", response_model=DietCalcOut)
def calculate_macros(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Intelligens TDEE és makró számítás.
    Figyelembe veszi:
    1. A legfrissebb mért súlyt (ha van).
    2. A pontos aktivitási szintet (magyar/angol support).
    3. A nemet (magyar/angol support).
    """
    
    # 1. Profilok lekérése
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
        raise HTTPException(status_code=404, detail="StartState not found.")
    
    # 2. SÚLY MEGHATÁROZÁSA (AZ OKOS RÉSZ)
    # Megnézzük, mért-e már súlyt a felhasználó
    latest_log = db.query(UserWeightLog).filter(
        UserWeightLog.user_id == current_user.user_id
    ).order_by(UserWeightLog.date.desc(), UserWeightLog.log_id.desc()).first()

    if latest_log:
        weight = latest_log.weight_kg # Ha mért, használjuk a frisset
    else:
        weight = start_state.start_weight_kg # Ha nem, maradunk a kezdetinél

    # 3. Egyéb adatok
    goal = start_state.goal_type
    load_level_str = active_training_profile.load_level
    height = current_user.height_cm
    sex = current_user.sex
    age = calculate_age(current_user.date_of_birth)

    # 4. Aktivitás robusztus kezelése
    activity_map = {
        "könnyű": 1.375, "light": 1.375, "sedentary": 1.375,
        "közepes": 1.55, "moderate": 1.55, "active": 1.55,
        "nehéz": 1.725, "nehez": 1.725, "heavy": 1.725, "extreme": 1.725
    }
    load_key = load_level_str.lower().strip() if load_level_str else ""
    activity_multiplier = activity_map.get(load_key, 1.375)

    if weight <= 0 or height <= 0 or age <= 0:
        raise HTTPException(status_code=400, detail="Invalid user data")

    # 5. BMR számítás (Férfi/Nő detektálás javítva)
    sex_lower = sex.lower().strip()
    is_male = sex_lower in ['férfi', 'ferfi', 'male', 'm', 'man']
    s_value = 5 if is_male else -161 
    
    bmr = (10 * weight) + (6.25 * height) - (5 * age) + s_value

    # 6. Végső számítások
    tdee = bmr * activity_multiplier
    target_calories = tdee
    
    if goal == "weight_loss": 
        target_calories -= 400 
    elif goal == "muscle_gain": 
        target_calories += 300 

    protein_g = weight * 1.8 # Fehérje a (lehet, hogy új) testsúly alapján!
    protein_kcal = protein_g * 4
    fat_kcal = target_calories * 0.25
    fat_g = fat_kcal / 9
    carbs_kcal = target_calories - protein_kcal - fat_kcal
    carbs_g = carbs_kcal / 4

    return DietCalcOut(
        calories=round(target_calories),
        protein=round(protein_g),
        carbs=round(max(0, carbs_g)),
        fat=round(max(0, fat_g)),
        current_weight=weight
    )