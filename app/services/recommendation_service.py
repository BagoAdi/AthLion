# app/services/recommendation_service.py
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, not_
from fastapi import HTTPException
from datetime import date
import random

from app.models.user import User
from app.models.food_item import FoodItem
from app.models.diet_profile import DietProfile
from app.models.allergen import Allergen

class RecommendationService:
    def __init__(self, db: Session):
        self.db = db

    # Specifikus kulcsszavak (hogy reggelire ne pörköltet adjon)
    KEYWORDS = {
        "breakfast": [
            "%tojás%", "%rántotta%", "%virsli%", "%sonka%", "%sajt%", 
            "%túró%", "%joghurt%", "%zab%", "%müzli%", "%granola%", 
            "%kenyér%", "%zsemle%", "%kifli%", "%kalács%", "%bundás%"
        ],
        "lunch": [
            "%csirke%", "%pulyka%", "%marha%", "%sertés%", "%hal%", 
            "%rizs%", "%burgonya%", "%tészta%", "%főzelék%", "%ragu%", 
            "%sült%", "%rántott%", "%pörkölt%", "%gulyás%"
        ],
        "dinner": [
            "%csirke%", "%pulyka%", "%hal%", "%tonhal%", "%saláta%", 
            "%túró%", "%sajt%", "%joghurt%", "%tojás%", "%zöldség%"
        ],
        "snacks": [
            "%müzli%", "%szelet%", "%joghurt%", "%gyümölcs%", "%alma%", 
            "%banán%", "%dió%", "%mandula%", "%túró rudi%", "%fehérje%"
        ]
    }

    def calculate_needs(self, user: User):
        """Kiszámolja a napi kalória és fehérje keretet."""
        today = date.today()
        age = today.year - user.date_of_birth.year - ((today.month, today.day) < (user.date_of_birth.month, user.date_of_birth.day))

        # Súly meghatározása
        weight = 75.0 
        active_profile = self.db.query(DietProfile).filter(DietProfile.user_id == user.user_id, DietProfile.is_active == 1).first()
        if active_profile and active_profile.start:
            if hasattr(active_profile.start, 'weight_kg'): weight = active_profile.start.weight_kg
            elif hasattr(active_profile.start, 'weight'): weight = active_profile.start.weight

        # BMR
        if user.sex and user.sex.lower() in ['male', 'férfi']:
            bmr = (10 * weight) + (6.25 * user.height_cm) - (5 * age) + 5
        else:
            bmr = (10 * weight) + (6.25 * user.height_cm) - (5 * age) - 161

        # TDEE + Cél
        target_kcal = int(bmr * 1.55) - 300 # Enyhe deficit
        if target_kcal < 1300: target_kcal = 1300
        
        return target_kcal

    def suggest_single_item(self, user_id: int, meal_type: str):
        """
        Egyetlen konkrét ételt ajánl, kiszámolva az ideális mennyiséget.
        """
        user = self.db.query(User).get(user_id)
        daily_kcal = self.calculate_needs(user)
        
        # 1. Mennyi kalória jut erre az étkezésre?
        # Reggeli 25%, Ebéd 40%, Vacsora 30%, Nasi 5%
        ratios = {"breakfast": 0.25, "lunch": 0.40, "dinner": 0.30, "snacks": 0.05}
        target_meal_kcal = daily_kcal * ratios.get(meal_type, 0.1)
        
        # 2. Szűrés (Allergia + Kulcsszavak)
        allergy_ids = [ua.allergen_id for ua in user.allergies]
        query = self.db.query(FoodItem)
        
        if allergy_ids:
            query = query.filter(~FoodItem.allergens.any(Allergen.allergen_id.in_(allergy_ids)))
            
        # Kulcsszavas szűrés (Hogy reggelire reggelit kapj)
        keywords = self.KEYWORDS.get(meal_type, [])
        if keywords:
            search_filter = or_(*[FoodItem.food_name.ilike(kw) for kw in keywords])
            query = query.filter(search_filter)
        
        # Csak olyan ételt ajánlunk, aminek van kalória értéke
        query = query.filter(FoodItem.kcal_100g > 0)

        # 3. Választás
        count = query.count()
        if count == 0:
            return None # Nincs találat
        
        random_offset = random.randint(0, count - 1)
        food = query.offset(random_offset).first()
        
        # 4. Mennyiség számítása (Hogy pont kitöltse a keretet)
        # Képlet: (Cél Kalória / 100g Kalória) * 100
        suggested_grams = (target_meal_kcal / food.kcal_100g) * 100
        
        # Ésszerű határok (Ne ajánljon 1kg almát)
        if suggested_grams > 400: suggested_grams = 400
        if suggested_grams < 50: suggested_grams = 50 # Min. adag
        
        # Kerekítés 5g-ra
        suggested_grams = round(suggested_grams / 5) * 5
        
        return {
            "food": food, # Ez a teljes FoodItem objektum
            "quantity": int(suggested_grams),
            "target_kcal": int(target_meal_kcal)
        }