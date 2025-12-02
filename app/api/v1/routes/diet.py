# app/api/v1/routes/diet.py
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import Date, cast, func
from sqlalchemy.orm import Session
from datetime import date
from sqlalchemy import or_

# Modellek
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.start_state import StartState
from app.models.diet_profile import DietProfile
from app.models.training_profile import TrainingProfile
from app.models.user_food_log import UserFoodLog
from app.models.user_weight_log import UserWeightLog 
from app.models.workout_log import WorkoutLog
from app.models.food_item import FoodItem

# Auth és DB
from app.api.v1.routes.auth import get_current_active_user, get_db

# Schemas
from app.api.v1.schemas.diet_schemas import DietCalcOut

# Service
from app.services.recommendation_service import RecommendationService

router = APIRouter(prefix="/diet", tags=["diet"])

# --- SEGÉDFÜGGVÉNYEK ---

def calculate_age(dob: date) -> int:
    today = date.today()
    if not dob: return 30 # Fallback
    return today.year - dob.year - ((today.month, today.day) < (dob.month, today.day))

def get_target_data(db: Session, user: User, raise_error_if_missing: bool = False) -> dict:
    """
    Közös logika a célok és az edzés kompenzáció kiszámítására.
    JAVÍTVA: Több edzést is összegez és többféle kulcsot keres a JSON-ben.
    """
    # 1. Profilok lekérése (Ez a rész változatlan)
    active_diet = db.query(DietProfile).filter(DietProfile.user_id == user.user_id, DietProfile.is_active == 1).first()
    active_train = db.query(TrainingProfile).filter(TrainingProfile.user_id == user.user_id, TrainingProfile.is_active == 1).first()

    if (not active_diet or not active_train):
        if raise_error_if_missing:
            raise HTTPException(status_code=404, detail="Diet or Training profile not found.")
        else:
            return {'target_calories': 2000, 'protein': 150, 'carbs': 200, 'fat': 70, 'weight': 70, 'burned_extra': 0}

    start_state = db.query(StartState).filter(StartState.start_id == active_diet.start_id).first()
    if not start_state and raise_error_if_missing:
         raise HTTPException(status_code=404, detail="StartState not found.")

    # 2. Súly és Alapadatok (Változatlan)
    latest_log = db.query(UserWeightLog).filter(UserWeightLog.user_id == user.user_id).order_by(UserWeightLog.date.desc(), UserWeightLog.log_id.desc()).first()
    weight = latest_log.weight_kg if latest_log else (start_state.start_weight_kg if start_state else 70)

    goal = start_state.goal_type if start_state else "weight_loss"
    load_level_str = active_train.load_level if active_train else "moderate"
    height = user.height_cm
    sex = user.sex
    age = calculate_age(user.date_of_birth) if user.date_of_birth else 30

    # 3. BMR és TDEE Számítás (Változatlan)
    activity_map = {
        "könnyű": 1.375, "light": 1.375, "sedentary": 1.375,
        "közepes": 1.55, "moderate": 1.55, "active": 1.55,
        "nehéz": 1.725, "nehez": 1.725, "heavy": 1.725, "extreme": 1.725
    }
    load_key = load_level_str.lower().strip() if load_level_str else ""
    activity_multiplier = activity_map.get(load_key, 1.375)

    sex_lower = sex.lower().strip() if sex else "male"
    is_male = sex_lower in ['férfi', 'ferfi', 'male', 'm', 'man']
    s_value = 5 if is_male else -161 
    bmr = (10 * weight) + (6.25 * height) - (5 * age) + s_value

    tdee = bmr * activity_multiplier
    target_calories = tdee
    
    if goal == "weight_loss": target_calories -= 400 
    elif goal == "muscle_gain": target_calories += 300 

    # ------------------------------------------------------------------
    # 4. EDZÉS KOMPENZÁCIÓ (JAVÍTOTT RÉSZ)
    # ------------------------------------------------------------------
    today = date.today()
    
    # LEKÉRJÜK AZ ÖSSZES AZNAPI EDZÉST (nem csak az elsőt!)
    todays_workouts = db.query(WorkoutLog).filter(
        WorkoutLog.user_id == user.user_id,
        WorkoutLog.date == today
    ).all()

    burned_extra = 0.0
    
    for workout in todays_workouts:
        if workout.data:
            # Megpróbáljuk kinyerni az értéket bármilyen lehetséges kulcs alól
            # A 'calories_burned' a standard, de lehet 'calories' vagy 'burned' is
            val = (
                workout.data.get("calories_burned") or 
                workout.data.get("calories") or 
                workout.data.get("burned") or 
                workout.data.get("kcal") or 
                0
            )
            try:
                burned_extra += float(val)
            except (ValueError, TypeError):
                pass

    # Hozzáadjuk a napi kerethez
    target_calories += burned_extra

    # 5. Makrók (Változatlan)
    protein_g = weight * 1.8 
    remaining_kcal = target_calories - (protein_g * 4)
    if remaining_kcal < 0: remaining_kcal = 0
    fat_kcal = remaining_kcal * 0.30
    carbs_kcal = remaining_kcal * 0.70
    
    return {
        'target_calories': round(target_calories),
        'protein': round(protein_g),
        'carbs': round(carbs_kcal / 4),
        'fat': round(fat_kcal / 9),
        'weight': weight,
        'burned_extra': burned_extra
    }

# --- VÉGPONTOK ---

@router.post("/calculate", response_model=DietCalcOut)
def calculate_macros(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Intelligens TDEE és makró számítás + EDZÉS KOMPENZÁCIÓ.
    Szigorúan ellenőrzi a profilok meglétét.
    """
    data = get_target_data(db, current_user, raise_error_if_missing=True)
    
    return DietCalcOut(
        calories=data['target_calories'],
        protein=data['protein'],
        carbs=data['carbs'],
        fat=data['fat'],
        current_weight=data['weight'],
        burned_calories=data['burned_extra']
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

@router.get("/dashboard-summary")
def get_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Kifejezetten a Dashboardnak: 
    Visszaadja a Napi Célt (Target) és a Mai Fogyasztást (Consumed).
    Most már tartalmazza az EDZÉS KOMPENZÁCIÓT is!
    """
    # 1. Cél lekérése (Közös logikával!)
    calc_data = get_target_data(db, current_user, raise_error_if_missing=False)
    target_calories = calc_data['target_calories']

    # 2. Mai fogyasztás összegzése
    today = date.today()
    
    consumed_calories = db.query(
        func.sum((UserFoodLog.quantity_grams * FoodItem.kcal_100g) / 100)
    ).join(
        FoodItem, UserFoodLog.food_id == FoodItem.food_id
    ).filter(
        UserFoodLog.user_id == current_user.user_id,
        UserFoodLog.date == today
    ).scalar() or 0

    return {
        "target": target_calories,
        "consumed": int(consumed_calories)
    }