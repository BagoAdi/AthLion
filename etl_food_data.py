# etl_food_data.py
import pandas as pd
import time
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import IntegrityError

# Adatbázis és Modellek importálása
from app.db.session import SessionLocal
from app.models.allergen import Allergen
from app.models.diet_type import DietType
from app.models.food_item import FoodItem, FoodDietTypeLink

print("ETL szkript indul...")

### --- KONFIGURÁCIÓ (EZT MUSZÁJ NEKED BEÁLLÍTANI!) --- ###

# 1. Add meg a letöltött OpenFoodFacts .tsv fájl pontos helyét
OFF_FILE_PATH = "C:\Users\bagon\Desktop\Egyetem\BSc\5.félév\Projekt labor\openfoodfacts-products.jsonl\openfoodfacts-products.jsonl"

# 2. Add meg azokat a diéta címkéket, amiket importálni szeretnél
# (OFF Címke -> A te DietType táblád neve)
DIET_TAGS_TO_IMPORT = {
    'en:vegan': 'Vegán',
    'en:vegetarian': 'Vegetáriánus',
    'en:gluten-free': 'Gluténmentes',
    'en:lactose-free': 'Laktózmentes',
    'en:organic': 'Bio',
    # 'en:palm-oil-free': 'Pálmaolaj-mentes',
}

# 3. Add meg az allergén mappelést
# (OFF Címke -> A te Allergen táblád "allergen_name" értéke, amit az SQL-ben megadtál)
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

# Oszlopok, amiket beolvasunk az 59GB-os fájlból
COLUMNS_TO_USE = [
    'product_name', 
    'energy-kcal_100g', # Ellenőrizd, hogy ez-e a pontos kcal oszlopnév!
    'proteins_100g', 
    'carbohydrates_100g', 
    'fat_100g', 
    'allergens_tags', 
    'labels_tags'
]

# Feldolgozás mérete (egyszerre ennyi sort olvas be a memóriába)
CHUNK_SIZE = 50000 

db = SessionLocal()
try:
    print("Adatbázis kapcsolat OK.")
    
    # 1. Töltsük be a meglévő allergéneket a DB-ből a memóriába (gyorsabb keresés)
    allergen_cache = {a.allergen_name.lower(): a for a in db.query(Allergen).all()}
    if not allergen_cache:
        print("FIGYELEM: Az 'allergen' tábla üres. Az allergén mappelés nem fog működni.")
        print("Futtattad az INSERT SQL parancsokat a Neon-on?")
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


    # 3. Indulhat a nagy fájl feldolgozása (chunk-okban)
    print(f"'{OFF_FILE_PATH}' feldolgozása indul...")
    start_time = time.time()
    total_rows_processed = 0
    total_items_added = 0

    for i, chunk in enumerate(pd.read_csv(
        OFF_FILE_PATH, 
        sep='\t', 
        chunksize=CHUNK_SIZE, 
        usecols=COLUMNS_TO_USE, 
        low_memory=False,
        on_bad_lines='skip' # Hibás, olvashatatlan sorok átugrása
    )):
        
        chunk_start_time = time.time()
        
        # NaN/NaT értékek cseréje None-ra (amit az SQL ért)
        chunk = chunk.where(pd.notnull(chunk), None)

        for _, row in chunk.iterrows():
            total_rows_processed += 1
            
            # --- Alap szűrés ---
            # Csak akkor importáljuk, ha van neve ÉS kalóriaértéke
            if not row['product_name'] or not row['energy-kcal_100g']:
                continue
            
            # --- Új FoodItem létrehozása ---
            food = FoodItem(
                food_name=row['product_name'],
                kcal_100g=row['energy-kcal_100g'],
                protein_100g=row['proteins_100g'],
                carbs_100g=row['carbohydrates_100g'],
                fat_100g=row['fat_100g']
            )
            db.add(food) # Hozzáadjuk a sessionhöz (még nincs DB-ben)
            total_items_added += 1
            
            # --- Kapcsolatok kezelése ---

            # Allergének feldolgozása
            if row['allergens_tags']:
                tags = str(row['allergens_tags']).split(',')
                for tag in tags:
                    mapped_name = ALLERGEN_TAG_MAP.get(tag.strip())
                    if mapped_name and mapped_name in allergen_cache:
                        # Közvetlen hozzárendelés a many-to-many kapcsolathoz
                        # A SQLAlchemy kezeli a 'food_allergen_link' táblát
                        food.allergens.append(allergen_cache[mapped_name])

            # Diéták feldolgozása
            if row['labels_tags']:
                tags = str(row['labels_tags']).split(',')
                for tag in tags:
                    if tag.strip() in diet_type_cache:
                        # Itt a Link TÁBLÁT kell létrehoznunk
                        link = FoodDietTypeLink(
                            food_item=food, 
                            diet_type=diet_type_cache[tag.strip()]
                        )
                        db.add(link)
        
        # Chunk-onkénti commit (hogy ne szálljon el a memória és mentsen)
        db.commit()
        
        print(f"Feldolgozva {i+1}. chunk ({total_rows_processed} sor). "
              f"Új ételek ebben a körben: {total_items_added} (eddig összesen). "
              f"Chunk idő: {time.time() - chunk_start_time:.2f}s")

except FileNotFoundError:
    print(f"!!! HIBA: Nem található a fájl: '{OFF_FILE_PATH}'")
    print("Kérlek, ellenőrizd az útvonalat a szkript 11. sorában.")
    db.rollback()
except Exception as e:
    print(f"!!! HIBA történt a feldolgozás közben: {e}")
    print("Lehet, hogy az egyik oszlopnév (pl. 'energy-kcal_100g') hibás?")
    db.rollback()
finally:
    db.close()
    print("Adatbázis kapcsolat bezárva.")

print(f"\n--- ETL FUTÁS VÉGE ---")
print(f"Teljes futásidő: {time.time() - start_time:.2f}s")
print(f"Összesen feldolgozott sor: {total_rows_processed}")
print(f"Adatbázishoz hozzáadott ételek: {total_items_added}")