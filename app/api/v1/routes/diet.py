# app/api/v1/routes/diet.py
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from datetime import date

# Modellek
from app.models.user import User
from app.models.start_state import StartState
from app.models.diet_profile import DietProfile
from app.models.training_profile import TrainingProfile
from app.models.user_weight_log import UserWeightLog 
from app.models.workout_log import WorkoutLog

# Auth és DB
from app.api.v1.routes.auth import get_current_active_user, get_db

# Schemas
from app.api.v1.schemas.diet_schemas import DietCalcOut

# --- ÚJ IMPORT (A generáló logika) ---
# Ez feltételezi, hogy létrehoztad a fájlt az 'app/services' mappában!
from app.services.recommendation_service import RecommendationService

router = APIRouter(prefix="/diet", tags=["diet"])

# --- SEGÉDFÜGGVÉNYEK ---

def calculate_age(dob: date) -> int:
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, today.day))

# --- VÉGPONTOK ---

@router.post("/calculate", response_model=DietCalcOut)
def calculate_macros(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Intelligens TDEE és makró számítás + EDZÉS KOMPENZÁCIÓ.
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
        raise HTTPException(status_code=404, detail="Active Diet or Training profile not found.")

    start_state = db.query(StartState).filter(
        StartState.start_id == active_diet_profile.start_id
    ).first()

    if not start_state:
        raise HTTPException(status_code=404, detail="StartState not found.")
    
    # 2. SÚLY MEGHATÁROZÁSA
    latest_log = db.query(UserWeightLog).filter(
        UserWeightLog.user_id == current_user.user_id
    ).order_by(UserWeightLog.date.desc(), UserWeightLog.log_id.desc()).first()

    weight = latest_log.weight_kg if latest_log else start_state.start_weight_kg

    # 3. Egyéb adatok
    goal = start_state.goal_type
    load_level_str = active_training_profile.load_level
    height = current_user.height_cm
    sex = current_user.sex
    age = calculate_age(current_user.date_of_birth)

    # 4. Aktivitás
    activity_map = {
        "könnyű": 1.375, "light": 1.375, "sedentary": 1.375,
        "közepes": 1.55, "moderate": 1.55, "active": 1.55,
        "nehéz": 1.725, "nehez": 1.725, "heavy": 1.725, "extreme": 1.725
    }
    load_key = load_level_str.lower().strip() if load_level_str else ""
    activity_multiplier = activity_map.get(load_key, 1.375)

    if weight <= 0 or height <= 0 or age <= 0:
        raise HTTPException(status_code=400, detail="Invalid user data")

    # 5. BMR számítás
    sex_lower = sex.lower().strip()
    is_male = sex_lower in ['férfi', 'ferfi', 'male', 'm', 'man']
    s_value = 5 if is_male else -161 
    
    bmr = (10 * weight) + (6.25 * height) - (5 * age) + s_value

    # 6. Alap TDEE
    tdee = bmr * activity_multiplier
    target_calories = tdee
    
    # Cél módosítás
    if goal == "weight_loss": 
        target_calories -= 400 
    elif goal == "muscle_gain": 
        target_calories += 300 

    # -------------------------------------------------------------
    # 7. EDZÉS KOMPENZÁCIÓ (SZILÍCIUM VÖLGY UPGRADE)
    # -------------------------------------------------------------
    # Lekérjük a MAI edzést
    today = date.today()
    todays_workout = db.query(WorkoutLog).filter(
        WorkoutLog.user_id == current_user.user_id,
        WorkoutLog.date == today
    ).first()

    burned_extra = 0.0
    if todays_workout and todays_workout.data:
        # Biztonságosan kivesszük a JSON-ből az értéket amit az előző lépésben számoltunk
        burned_extra = float(todays_workout.data.get("calories_burned", 0.0))

    # Hozzáadjuk a napi kerethez!
    target_calories += burned_extra

    # -------------------------------------------------------------
    # 8. Makrók szétosztása (A megnövelt kalória alapján)
    # -------------------------------------------------------------
    
    # Fehérje: Súly * 1.8g (ezt fixen tartjuk, vagy növelhetjük picit edzés napon)
    # Most hagyjuk fixen a súlyhoz kötve, a többlet kalória menjen CH-ba és Zsírba.
    protein_g = weight * 1.8 
    protein_kcal = protein_g * 4
    
    # Maradék kalória
    remaining_kcal = target_calories - protein_kcal
    
    # Ha valamiért negatív lenne (túl alacsony kalória), korrigálunk
    if remaining_kcal < 0: remaining_kcal = 0

    # Szétosztás: 30% Zsír, Maradék CH (klasszikus sportoló elosztás)
    fat_kcal = remaining_kcal * 0.30
    fat_g = fat_kcal / 9
    
    carbs_kcal = remaining_kcal * 0.70
    carbs_g = carbs_kcal / 4

    return DietCalcOut(
        calories=round(target_calories),
        protein=round(protein_g),
        carbs=round(carbs_g),
        fat=round(fat_g),
        current_weight=weight,
        burned_calories=burned_extra # Visszaküldjük infónak
    )

@router.get("/recommendation/suggest/{meal_type}")
def suggest_food_for_meal(
    meal_type: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Egyetlen ételt javasol a megadott étkezéshez (pl. 'breakfast').
    """
    service = RecommendationService(db)
    result = service.suggest_single_item(current_user.user_id, meal_type)
    
    if not result:
        raise HTTPException(status_code=404, detail="Nem találtam megfelelő ételt.")
    
    # Visszaadjuk az étel adatait és az ajánlott mennyiséget
    food = result['food']
    return {
        "food_id": food.food_id,
        "food_name": food.food_name,
        "kcal_100g": food.kcal_100g,
        "protein_100g": food.protein_100g,
        "carbs_100g": food.carbs_100g,
        "fat_100g": food.fat_100g,
        "suggested_quantity": result['quantity'],
        "target_kcal_for_meal": result['target_kcal']
    }