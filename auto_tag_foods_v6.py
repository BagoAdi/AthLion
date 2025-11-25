# auto_tag_foods_v6.py (BILINGVÁLIS: MAGYAR + ANGOL)
import time
from sqlalchemy.orm import selectinload
from app.db.session import SessionLocal
from app.models.food_item import FoodItem
from app.models.allergen import Allergen
from app.models.diet_type import DietType

db = SessionLocal()

print("--- Ételek BILINGVÁLIS (HU/EN) címkézése (V6) ---")

# --- 1. ELŐKÉSZÍTÉS ---
allergens_db = {a.allergen_name: a for a in db.query(Allergen).all()}
diet_types_db = {d.diet_name: d for d in db.query(DietType).all()}

# --- 2. KÉTNYELVŰ SZABÁLYRENDSZER ---
rules = {
    "Laktóz": {
        "keywords": [
            # Magyar
            "tej", "sajt", "joghurt", "túró", "kefir", "tejföl", "vaj", "tejszín", "latte", "cappuccino", "tejsavó", 
            # Angol
            "milk", "cheese", "yogurt", "yoghurt", "butter", "cream", "whey", "casein", "lactose", "dairy", "cheddar", "mozzarella", "parmesan", "gouda"
        ],
        "exceptions": [
            "mentes", "laktózmentes", "növényi", "vegán", "vegan", "kókusz", "mandula", "rizs", "zab", "szója", "kesu", "mogyoró",
            "free", "plant", "almond", "rice", "oat", "soy", "coconut", "peanut", "cashew" # Angol kivételek
        ]
    },
    "Glutén": {
        "keywords": [
            # Magyar
            "kenyér", "tészta", "liszt", "búza", "rozs", "árpa", "keksz", "sütemény", "panír", "zsemle", "kifli", "bagett", "pizza",
            # Angol
            "bread", "pasta", "flour", "wheat", "barley", "rye", "biscuit", "cookie", "cake", "bun", "baguette", "pizza", "gluten", "seitan", "spaghetti", "macaroni"
        ],
        "exceptions": [
            "mentes", "gluténmentes", "gm ", "kukorica", "rizs", "kókusz", "mandula",
            "free", "gluten-free", "gf ", "corn", "rice", "coconut", "almond"
        ]
    },
    "Földimogyoró": {
        "keywords": ["mogyoró", "mogyi", "nutella", "snickers", "peanut", "butter"], # Peanut butter miatt
        "exceptions": ["törökmogyoró", "erdei", "hazelnut", "walnut", "almond", "cashew"] # Ezek más diófélék
    },
    "Tojás": {
        "keywords": ["tojás", "rántotta", "omlett", "majonéz", "egg", "omelet", "omelette", "mayonnaise", "mayo"],
        "exceptions": ["mentes", "free", "plant", "vegan"]
    },
    "Hal": {
        "keywords": ["hal", "tonhal", "lazac", "pisztráng", "ponty", "hekk", "sushi", "fish", "tuna", "salmon", "trout", "carp", "cod", "sardine"],
        "exceptions": []
    },
    "Rákfélék": {
        "keywords": ["rák", "garnéla", "homár", "kagyló", "tintahal", "shrimp", "crab", "lobster", "prawn", "shellfish", "clam", "mussel", "oyster", "squid"],
        "exceptions": []
    },
    "Szója": {
        "keywords": ["szója", "tofu", "szósz", "soy", "soya", "tofu", "edamame", "tempeh", "teriyaki"],
        "exceptions": ["mentes", "free"]
    },
    "Diófélék": {
        "keywords": ["dió", "mandula", "kesu", "pisztácia", "nut", "walnut", "almond", "cashew", "pistachio", "pecan", "macadamia", "hazelnut"],
        "exceptions": ["földimogyoró", "peanut", "nutmeg", "coconut", "kókusz", "szerecsendió"] # A kókusz és szerecsendió technikailag nem dióféle allergén
    },
    "Zeller": {
        "keywords": ["zeller", "celery"],
        "exceptions": []
    },
    "Mustár": {
        "keywords": ["mustár", "mustard"],
        "exceptions": ["mustard greens"] # Mustárlevél nem feltétlenül allergén, de ritka
    },
    "Szezámmag": {
        "keywords": ["szezám", "sesame", "tahini", "halva"],
        "exceptions": []
    }
}

# Állati eredetű kulcsszavak (Vegán szűréshez) - Angolul is!
not_vegan_keywords = [
    "hús", "csirke", "marha", "sertés", "hal", "tojás", "tej", "sajt", "méz", "sonka", "kolbász", "szalonna", "joghurt",
    "meat", "chicken", "beef", "pork", "fish", "egg", "milk", "cheese", "honey", "ham", "sausage", "bacon", "yogurt", "yoghurt", "cream", "butter", "whey", "casein", "gelatin", "lard"
]

# --- 3. FELDOLGOZÁS (TURBO MÓD) ---
BATCH_SIZE = 5000
total_foods = db.query(FoodItem).count()
print(f"Összesen {total_foods} étel ellenőrzése...")

processed_count = 0
added_count = 0
removed_count = 0
start_time = time.time()
last_seen_id = 0

while True:
    batch = db.query(FoodItem)\
              .options(selectinload(FoodItem.allergens))\
              .filter(FoodItem.food_id > last_seen_id)\
              .order_by(FoodItem.food_id)\
              .limit(BATCH_SIZE)\
              .all()

    if not batch:
        break

    for food in batch:
        name = food.food_name.lower()
        
        # --- ALLERGÉNEK ---
        for alg_name, rule in rules.items():
            if alg_name not in allergens_db: continue
            
            allergen_obj = allergens_db[alg_name]
            
            has_keyword = any(k in name for k in rule["keywords"])
            is_exempt = any(exc in name for exc in rule["exceptions"])
            should_have_allergen = has_keyword and not is_exempt

            if should_have_allergen:
                if allergen_obj not in food.allergens:
                    food.allergens.append(allergen_obj)
                    added_count += 1
            else:
                if allergen_obj in food.allergens:
                    food.allergens.remove(allergen_obj)
                    removed_count += 1

        last_seen_id = food.food_id

    db.commit()
    processed_count += len(batch)

    elapsed = time.time() - start_time
    if elapsed > 0:
        speed = processed_count / elapsed
        eta = (total_foods - processed_count) / speed / 60
        if processed_count % 20000 == 0: # Ritkábban írjuk ki
            print(f"[{processed_count}/{total_foods}] (+{added_count} / -{removed_count}) - {int(speed)} étel/mp - ETA: {int(eta)} perc")

db.close()
print(f"\n✅ KÉSZ! Hozzáadva: {added_count}, Javítva: {removed_count}")