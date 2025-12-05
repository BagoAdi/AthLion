# app/services/recommendation_service.py
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
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

    # =========================================================================
    #  ULTRA-SZIGORÚ MAGYAR KULCSSZAVAK
    #  Kivettük a "közös" szavakat (bacon, grill, steak, protein), 
    #  hogy az angol termékek véletlenül se csússzanak át.
    # =========================================================================
    KEYWORDS = {
        "breakfast": [
            # Tojás (Csak magyarul)
            "%tojás%", "%rántotta%", "%tükörtojás%", "%bundás%", 
            # Húsfélék (Bacon helyett szalonna)
            "%virsli%", "%sonka%", "%szalámi%", "%kolbász%", "%párizsi%", 
            "%szalonna%", "%császár%", "%felvágott%", "%májas%", "%kenő%",
            # Tejtermékek
            "%sajt%", "%túró%", "%joghurt%", "%kefir%", "%tejföl%", "%vaj%", 
            "%körözött%", "%mozzarella%", "%trappista%", "%edami%",
            # Pékáru
            "%kenyér%", "%zsemle%", "%kifli%", "%bagett%", "%pirítós%", "%kalács%", 
            "%pékáru%", "%pogácsa%", "%szendvics%",
            # Gabona
            "%zabkása%", "%zabpehely%", "%müzli%", "%pehely%"
        ],
        "lunch": [
            # Húsok (Steak helyett konkrét magyar nevek)
            "%csirke%", "%pulyka%", "%marha%", "%sertés%", "%kacsa%", "%liba%", 
            "%borjú%", "%bárány%", "%zúza%", "%máj%",
            # Halak (Csak magyar nevek)
            "%halfilé%", "%halászlé%", "%lazac%", "%tonhal%", "%tőkehal%", "%hekk%", 
            "%pisztráng%", "%harcsa%", "%ponty%", "%süllő%", "%keszeg%", "%busa%",
            # Elkészítési módok (Grill helyett grillezett)
            "%rántott%", "%sült%", "%főtt%", "%párolt%", "%grillezett%", 
            "%pörkölt%", "%tokány%", "%fasírt%", "%gulyás%", "%rakott%", 
            "%töltött%", "%brassói%", "%vadas%", "%paprikás%", "%bácskai%", 
            "%leves%", "%főzelék%",
            # Köretek
            "%rizs%", "%burgonya%", "%krumpli%", "%tészta%", 
            "%galuska%", "%nokedli%", "%lecsó%", "%főzelék%"
        ],
        "dinner": [
            # Könnyű vacsorák
            "%csirkemell%", "%pulykamell%", "%tonhal%", "%lazac%", 
            "%saláta%", "%zöldség%", 
            "%túró%", "%sajt%", "%mozzarella%", "%főtt tojás%", 
            "%virsli%", "%sonka%", "%joghurt%"
        ],
        "snacks": [
            # Protein helyett fehérje
            "%müzli%", "%szelet%", "%joghurt%", "%kefir%", "%puding%", "%túró rudi%",
            "%gyümölcs%", "%alma%", "%banán%", "%barack%", "%narancs%", "%körte%", "%meggy%",
            "%dió%", "%mandula%", "%mogyoró%", "%kesudió%",
            "%fehérje%", "%keksz%", "%csoki%", "%nápolyi%"
        ]
    }

    def calculate_needs(self, user: User):
        today = date.today()
        age = today.year - user.date_of_birth.year - ((today.month, today.day) < (user.date_of_birth.month, user.date_of_birth.day))

        weight = 75.0 
        active_profile = self.db.query(DietProfile).filter(DietProfile.user_id == user.user_id, DietProfile.is_active == 1).first()
        if active_profile and active_profile.start:
            if hasattr(active_profile.start, 'weight_kg'): weight = active_profile.start.weight_kg
            elif hasattr(active_profile.start, 'weight'): weight = active_profile.start.weight

        if user.sex and user.sex.lower() in ['male', 'férfi']:
            bmr = (10 * weight) + (6.25 * user.height_cm) - (5 * age) + 5
        else:
            bmr = (10 * weight) + (6.25 * user.height_cm) - (5 * age) - 161

        tdee = bmr * 1.55 
        target_kcal = tdee - 300 
        if target_kcal < 1300: target_kcal = 1300
        
        return int(target_kcal)

    def suggest_single_item(self, user_id: int, meal_type: str):
        user = self.db.query(User).get(user_id)
        daily_kcal = self.calculate_needs(user)
        
        ratios = {"breakfast": 0.25, "lunch": 0.40, "dinner": 0.30, "snacks": 0.05}
        target_meal_kcal = daily_kcal * ratios.get(meal_type, 0.1)
        
        query = self.db.query(FoodItem)

        # =========================================================
        #  DEMO KAPCSOLÓ - CSAK A TISZTA ADATOK HASZNÁLATA
        # =========================================================
        SHOW_ONLY_DEMO = True
        
        if SHOW_ONLY_DEMO:
             query = query.filter(FoodItem.is_demo == True)
        # =========================================================
        
        allergy_ids = [ua.allergen_id for ua in user.allergies]
        if allergy_ids:
            query = query.filter(~FoodItem.allergens.any(Allergen.allergen_id.in_(allergy_ids)))
            
        # SZIGORÚ SZŰRÉS
        keywords = self.KEYWORDS.get(meal_type, [])
        if keywords:
            search_filter = or_(*[FoodItem.food_name.ilike(kw) for kw in keywords])
            query = query.filter(search_filter)
        else:
            return None
        
        query = query.filter(FoodItem.kcal_100g > 30, FoodItem.kcal_100g < 600)

        count = query.count()
        if count == 0:
            return None
        
        random_offset = random.randint(0, count - 1)
        food = query.offset(random_offset).first()
        
        if food.kcal_100g > 0:
            suggested_grams = (target_meal_kcal / food.kcal_100g) * 100
        else:
            suggested_grams = 100 

        if suggested_grams > 350: suggested_grams = 350
        if suggested_grams < 50: suggested_grams = 50
        suggested_grams = round(suggested_grams / 5) * 5
        
        return {
            "food": food,
            "quantity": int(suggested_grams),
            "target_kcal": int(target_meal_kcal)
        }