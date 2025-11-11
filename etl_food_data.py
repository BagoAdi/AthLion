# etl_food_data.py (JSONL verzió)
import json # Pandas helyett a 'json' modult használjuk
import time
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import IntegrityError

# Adatbázis és Modellek importálása
from app.db.session import SessionLocal
from app.models.allergen import Allergen
from app.models.diet_type import DietType
from app.models.food_item import FoodItem, FoodDietTypeLink

print("ETL szkript indul (JSONL verzió)...")

### --- KONFIGURÁCIÓ (EZT MUSZÁJ NEKED BEÁLLÍTANI!) --- ###

# 1. Add meg a letöltött .jsonl fájl pontos helyét
#    FONTOS: Használj r"..." (raw string) vagy / (per) jeleket a SyntaxError elkerülésére!
OFF_FILE_PATH = r'C:\Users\bagon\Desktop\Egyetem\BSc\5.félév\Projekt labor\openfoodfacts-products.jsonl\openfoodfacts-products.jsonl'

# 2. Add meg azokat a diéta címkéket, amiket importálni szeretnél
DIET_TAGS_TO_IMPORT = {
    'en:vegan': 'Vegán',
    'en:vegetarian': 'Vegetáriánus',
    'en:gluten-free': 'Gluténmentes',
    'en:lactose-free': 'Laktózmentes',
}

# 3. Add meg az allergén mappelést (OFF Címke -> A te DB-d neve)
ALLERGEN_TAG_MAP = {
    'en:milk': 'tej',
    'en:gluten': 'glutén',
    'en:eggs': 'tojás',
    'en:nuts': 'diófélék',
    'en:peanuts': 'földimogyoró',
    'en:soya': 'szója',
    'en:fish': 'hal',
    'en:crustaceans': 'rákfélék',
    'en:molluscs': 'puhatestűek',
    'en:mustard': 'mustár',
    'en:sesame-seeds': 'szezámmag',
    'en:celery': 'zeller',
    'en:lupin': 'csillagfürt',
    'en:sulphur-dioxide-and-sulphites': 'kén-dioxid',
}

### --- ETL FOLYAMAT --- ###

# Hány soronként mentsen az adatbázisba
COMMIT_CHUNK_SIZE = 10000 

db = SessionLocal()
try:
    print("Adatbázis kapcsolat OK.")
    
    # 1. Töltsük be a meglévő allergéneket a DB-ből a memóriába (gyorsabb keresés)
    allergen_cache = {a.allergen_name.lower(): a for a in db.query(Allergen).all()}
    if not allergen_cache:
        print("FIGYELEM: Az 'allergen' tábla üres. Az allergén mappelés nem fog működni.")
    print(f"Cache betöltve: {len(allergen_cache)} allergén.")

    # 2. Töltsük be / hozzuk létre a diéta típusokat
    diet_type_cache = {}
    for tag, name in DIET_TAGS_TO_IMPORT.items():
        try:
            dt = DietType(diet_name=name)
            db.add(dt)
            db.commit()
        except IntegrityError:
            db.rollback() # Visszavonás, ha már létezik
            dt = db.query(DietType).filter(DietType.diet_name == name).first()
        diet_type_cache[tag] = dt
    print(f"Cache betöltve: {len(diet_type_cache)} diéta típus.")


    # 3. Indulhat a nagy fájl feldolgozása (soronként)
    print(f"'{OFF_FILE_PATH}' feldolgozása indul...")
    start_time = time.time()
    total_rows_processed = 0
    total_items_added = 0

    # Megnyitjuk a .jsonl fájlt olvasásra
    with open(OFF_FILE_PATH, 'r', encoding='utf-8') as f:
        for line in f:
            total_rows_processed += 1
            
            try:
                # Minden sort külön JSON objektumként olvasunk be
                data = json.loads(line)
            except json.JSONDecodeError:
                print(f"Figyelem: Hibás JSON sor átugorva a {total_rows_processed}. sornál.")
                continue

            # --- Adatok kinyerése a JSON-ból ---

            # Először a magyar nevet keressük
            product_name = data.get('product_name_hu')

            # Ha nincs magyar, keressük az angolt
            if not product_name:
                product_name = data.get('product_name_en')

            nutriments = data.get('nutriments', {})
            kcal = nutriments.get('energy-kcal_100g')

            # --- Alap szűrés ---
            # Most már csak akkor megyünk tovább, ha van magyar VAGY angol név, ÉS van kcal
            if not product_name or not kcal:
                continue

            # --- Hossz-ellenőrzés (a múltkori hiba javítása) ---
            if len(product_name) > 255:
                continue
            # -------------------------------------

            protein = nutriments.get('proteins_100g')
            carbs = nutriments.get('carbohydrates_100g')
            fat = nutriments.get('fat_100g')
            
            allergens = data.get('allergens_tags', [])
            labels = data.get('labels_tags', [])

            # --- Új FoodItem létrehozása ---
            food = FoodItem(
                food_name=product_name,
                kcal_100g=kcal,
                protein_100g=protein,
                carbs_100g=carbs,
                fat_100g=fat
            )
            db.add(food)
            total_items_added += 1
            
            # --- Kapcsolatok kezelése ---

            # Allergének feldolgozása
            for tag in allergens:
                mapped_name = ALLERGEN_TAG_MAP.get(tag.strip())
                if mapped_name and mapped_name in allergen_cache:
                    food.allergens.append(allergen_cache[mapped_name])

            # Diéták feldolgozása
            for tag in labels:
                if tag.strip() in diet_type_cache:
                    link = FoodDietTypeLink(
                        food_item=food, 
                        diet_type=diet_type_cache[tag.strip()]
                    )
                    db.add(link)
            
            # --- Chunk-onkénti commit ---
            if total_items_added > 0 and total_items_added % COMMIT_CHUNK_SIZE == 0:
                db.commit()
                print(f"Feldolgozva {total_rows_processed} sor. "
                      f"Összesen hozzáadva: {total_items_added} étel. "
                      f"Idő: {time.time() - start_time:.2f}s")

    # A ciklus végén mentsük el a maradékot is
    db.commit()
    print(f"Utolsó mentés... Feldolgozva {total_rows_processed} sor.")

except FileNotFoundError:
    print(f"!!! HIBA: Nem található a fájl: '{OFF_FILE_PATH}'")
    print("Kérlek, ellenőrizd az útvonalat a szkript 12. sorában.")
    db.rollback()
except Exception as e:
    print(f"!!! HIBA történt a feldolgozás közben: {e}")
    db.rollback()
finally:
    db.close()
    print("Adatbázis kapcsolat bezárva.")

print(f"\n--- ETL FUTÁS VÉGE ---")
print(f"Teljes futásidő: {time.time() - start_time:.2f}s")
print(f"Összesen feldolgozott sor: {total_rows_processed}")
print(f"Adatbázishoz hozzáadott ételek: {total_items_added}")