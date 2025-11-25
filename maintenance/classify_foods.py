# maintenance/classify_foods.py (BILINGVÁLIS VERZIÓ)
import sys
import os

# Path beállítása
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import or_
from app.db.session import SessionLocal
from app.models.food_item import FoodItem

def classify_food_items():
    db = SessionLocal()
    print("--- Ételek kategorizálása (Magyar + Angol) indul ---")

    # ==========================================
    # 1. FEHÉRJE FORRÁSOK (Protein)
    # ==========================================
    protein_keywords = [
        # Magyar
        '%csirke%', '%pulyka%', '%marha%', '%sertés%', '%hal%', '%lazac%', 
        '%tonhal%', '%tofu%', '%sajt%', '%túró%', '%tojás%', '%sonka%',
        # Angol
        '%chicken%', '%turkey%', '%beef%', '%pork%', '%fish%', '%salmon%', 
        '%tuna%', '%cheese%', '%cottage cheese%', '%egg%', '%ham%', '%steak%'
    ]
    
    # Dinamikusan felépítjük az OR feltételt
    protein_filter = or_(*[FoodItem.food_name.ilike(kw) for kw in protein_keywords])

    rows_protein = db.query(FoodItem).filter(
        FoodItem.protein_100g > 10,
        protein_filter
    ).update({FoodItem.food_category: 'protein_source'}, synchronize_session=False)
    
    print(f"FRISSÍTVE: {rows_protein} db fehérjeforrás.")


    # ==========================================
    # 2. SZÉNHIDRÁT FORRÁSOK (Carb)
    # ==========================================
    carb_keywords = [
        # Magyar
        '%rizs%', '%burgonya%', '%krumpli%', '%tészta%', '%spagetti%', 
        '%penne%', '%kenyér%', '%zsemle%', '%kifli%', '%zab%', 
        '%kuszkusz%', '%bulgur%', '%hajdina%', '%galuska%', '%nokedli%',
        # Angol
        '%rice%', '%potato%', '%pasta%', '%spaghetti%', '%bread%', 
        '%bun%', '%oat%', '%couscous%', '%buckwheat%', '%noodle%', '%quinoa%'
    ]
    
    carb_filter = or_(*[FoodItem.food_name.ilike(kw) for kw in carb_keywords])

    # a) Újak kategorizálása
    rows_carbs_new = db.query(FoodItem).filter(
        FoodItem.food_category == None, 
        FoodItem.carbs_100g > 20,
        carb_filter
    ).update({FoodItem.food_category: 'carb_source'}, synchronize_session=False)

    # b) Javítás (Ha véletlenül fehérjének hittük, de valójában CH bomba)
    rows_carbs_fix = db.query(FoodItem).filter(
        FoodItem.food_category == 'protein_source',
        FoodItem.carbs_100g > 20,
        carb_filter,
        FoodItem.carbs_100g > (FoodItem.protein_100g * 2)
    ).update({FoodItem.food_category: 'carb_source'}, synchronize_session=False)

    print(f"FRISSÍTVE: {rows_carbs_new + rows_carbs_fix} db szénhidrátforrás.")


    # ==========================================
    # 3. ZÖLDSÉGEK (Vegetable)
    # ==========================================
    veg_keywords = [
        # Magyar
        '%brokkoli%', '%spenót%', '%saláta%', '%jégsaláta%', '%rukkola%', 
        '%paradicsom%', '%paprika%', '%uborka%', '%cukkini%', '%répa%', 
        '%sárgarépa%', '%karfiol%', '%hagyma%', '%zöldség%', '%káposzta%',
        # Angol
        '%broccoli%', '%spinach%', '%salad%', '%lettuce%', '%arugula%', 
        '%tomato%', '%pepper%', '%cucumber%', '%zucchini%', '%carrot%', 
        '%cauliflower%', '%onion%', '%vegetable%', '%cabbage%', '%kale%'
    ]

    veg_filter = or_(*[FoodItem.food_name.ilike(kw) for kw in veg_keywords])

    rows_veggies = db.query(FoodItem).filter(
        FoodItem.food_category == None,
        FoodItem.kcal_100g < 120, # Kicsit engedékenyebb határ
        veg_filter
    ).update({FoodItem.food_category: 'vegetable'}, synchronize_session=False)

    print(f"FRISSÍTVE: {rows_veggies} db zöldség.")

    db.commit()
    db.close()
    print("--- Kategorizálás kész! ---")

if __name__ == "__main__":
    classify_food_items()