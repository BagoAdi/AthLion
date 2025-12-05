import sys
import os

# Projekt gyökér path hozzáadása
sys.path.append(os.getcwd())

from app.db.session import SessionLocal
from app.models.food_item import FoodItem, FoodDietTypeLink
from app.models.diet_type import DietType
from app.models.allergen import Allergen  # <--- Importáljuk az Allergén modellt

def seed_data():
    db = SessionLocal()
    
    print("🌱 Demó ételek betöltése (Allergén-biztos módban)...")

    # 1. Előkészítés: Betöltjük a LÉTEZŐ allergéneket és diétákat
    # Nem hozunk létre újakat, csak a meglévőkből dolgozunk.
    
    # Diéta típusok betöltése / létrehozása (ezek fixek)
    required_diets = ["Vegán", "Vegetáriánus", "Gluténmentes", "Laktózmentes"]
    diet_map = {} 
    for diet_name in required_diets:
        dt = db.query(DietType).filter(DietType.diet_name == diet_name).first()
        if not dt:
            dt = DietType(diet_name=diet_name)
            db.add(dt)
            db.commit()
            db.refresh(dt)
        diet_map[diet_name] = dt

    # Allergének betöltése (CSAK olvasunk!)
    # Feltételezzük, hogy az adatbázisban már vannak allergének (pl. 'Glutén', 'Tej', 'Tojás', 'Földimogyoró')
    # Ha üres az adatbázis, akkor nem fog allergént hozzárendelni, ami biztonságos.
    existing_allergens = {a.allergen_name: a for a in db.query(Allergen).all()} 
    print(f"ℹ️  Ismert allergének a rendszerben: {list(existing_allergens.keys())}")

    # 2. Ételek listája (Allergénekkel kiegészítve)
    # A "my_allergens" listában soroljuk fel, miket szeretnénk rákötni.
    demo_foods = [
        # --- 1. REGGELI ---
        {"name": "Tojásrántotta (3 tojásból)", "cat": "Reggeli", "kcal": 280, "p": 16.0, "c": 1.0, "f": 22.0, "tags": ["Gluténmentes", "Laktózmentes"], "my_allergens": ["Tojás"]},
        {"name": "Sonkás szendvics (fehér kenyérrel)", "cat": "Reggeli", "kcal": 250, "p": 12.0, "c": 35.0, "f": 8.0, "tags": [], "my_allergens": ["Glutén"]}, 
        {"name": "Kakaós csiga", "cat": "Reggeli", "kcal": 380, "p": 6.0, "c": 50.0, "f": 18.0, "tags": [], "my_allergens": ["Glutén", "Tej", "Tojás"]},
        {"name": "Zabkása (vízzel, bogyós gyümölccsel)", "cat": "Reggeli", "kcal": 80, "p": 3.0, "c": 14.0, "f": 1.5, "tags": ["Vegán", "Vegetáriánus", "Laktózmentes"], "my_allergens": ["Glutén"]}, # Zab gyakran szennyezett
        {"name": "Görög joghurt (natúr)", "cat": "Reggeli", "kcal": 59, "p": 10.0, "c": 3.6, "f": 0.4, "tags": ["Vegetáriánus", "Gluténmentes"], "my_allergens": ["Tej"]},
        {"name": "Chia mag puding (mandulatejjel)", "cat": "Reggeli", "kcal": 120, "p": 4.0, "c": 10.0, "f": 7.0, "tags": ["Vegán", "Gluténmentes", "Laktózmentes"], "my_allergens": ["Diófélék"]}, # Mandula
        {"name": "Bundáskenyér (olajban sült)", "cat": "Reggeli", "kcal": 290, "p": 10.0, "c": 28.0, "f": 15.0, "tags": ["Vegetáriánus"], "my_allergens": ["Glutén", "Tojás"]},
        {"name": "Vajas kifli", "cat": "Reggeli", "kcal": 280, "p": 7.0, "c": 45.0, "f": 8.0, "tags": ["Vegetáriánus"], "my_allergens": ["Glutén", "Tej"]},

        # --- 2. EBÉD ---
        {"name": "Marhapörkölt nokedlivel", "cat": "Ebéd", "kcal": 180, "p": 16.0, "c": 20.0, "f": 9.0, "tags": [], "my_allergens": ["Glutén", "Tojás"]}, # Nokedli
        {"name": "Rántott csirkemell sült krumplival", "cat": "Ebéd", "kcal": 240, "p": 18.0, "c": 25.0, "f": 12.0, "tags": [], "my_allergens": ["Glutén", "Tojás"]}, # Panír
        {"name": "Bolognai spagetti (sertés)", "cat": "Ebéd", "kcal": 170, "p": 9.0, "c": 24.0, "f": 6.0, "tags": [], "my_allergens": ["Glutén"]},
        {"name": "Sajtos-tejfölös tészta", "cat": "Ebéd", "kcal": 220, "p": 8.0, "c": 30.0, "f": 10.0, "tags": ["Vegetáriánus"], "my_allergens": ["Glutén", "Tej"]},
        {"name": "Grillezett csirkemell jázmin rizzsel", "cat": "Ebéd", "kcal": 145, "p": 22.0, "c": 18.0, "f": 2.0, "tags": ["Gluténmentes", "Laktózmentes"], "my_allergens": []}, # Mentes
        {"name": "Tárkonyos csirkeragu leves", "cat": "Ebéd", "kcal": 75, "p": 6.0, "c": 4.0, "f": 3.0, "tags": ["Gluténmentes"], "my_allergens": ["Tej"]}, # Tejszín/Tejföl
        {"name": "Tonhalas tészta (paradicsomos)", "cat": "Ebéd", "kcal": 155, "p": 10.0, "c": 20.0, "f": 3.0, "tags": ["Laktózmentes"], "my_allergens": ["Glutén", "Hal"]},

        # --- 3. VACSORA ---
        {"name": "Melegszendvics (sonkás-sajtos)", "cat": "Vacsora", "kcal": 260, "p": 14.0, "c": 30.0, "f": 11.0, "tags": [], "my_allergens": ["Glutén", "Tej"]},
        {"name": "Pizza szelet (sonkás)", "cat": "Vacsora", "kcal": 270, "p": 11.0, "c": 35.0, "f": 10.0, "tags": [], "my_allergens": ["Glutén", "Tej"]},
        {"name": "Cézár saláta (csirkével, öntet nélkül)", "cat": "Vacsora", "kcal": 100, "p": 12.0, "c": 4.0, "f": 3.0, "tags": ["Gluténmentes", "Laktózmentes"], "my_allergens": []},
        {"name": "Túróval töltött paprika", "cat": "Vacsora", "kcal": 95, "p": 9.0, "c": 5.0, "f": 3.0, "tags": ["Vegetáriánus", "Gluténmentes"], "my_allergens": ["Tej"]},
        {"name": "Grillezett Halloumi sajt", "cat": "Vacsora", "kcal": 320, "p": 22.0, "c": 2.0, "f": 25.0, "tags": ["Vegetáriánus", "Gluténmentes"], "my_allergens": ["Tej"]},
        {"name": "Mozzarella saláta (Caprese)", "cat": "Vacsora", "kcal": 180, "p": 12.0, "c": 3.0, "f": 14.0, "tags": ["Vegetáriánus", "Gluténmentes"], "my_allergens": ["Tej"]},
        {"name": "Tonhalkrém (majonézes)", "cat": "Vacsora", "kcal": 210, "p": 14.0, "c": 1.0, "f": 16.0, "tags": ["Gluténmentes", "Laktózmentes"], "my_allergens": ["Hal", "Tojás"]}, # Majonézben tojás

        # --- 4. NASI ---
        {"name": "Túró Rudi", "cat": "Nasi", "kcal": 360, "p": 10.0, "c": 35.0, "f": 20.0, "tags": ["Vegetáriánus"], "my_allergens": ["Tej", "Szója"]},
        {"name": "Csokoládé (Tej)", "cat": "Nasi", "kcal": 540, "p": 7.0, "c": 55.0, "f": 30.0, "tags": ["Vegetáriánus", "Gluténmentes"], "my_allergens": ["Tej"]},
        {"name": "Sós mogyoró", "cat": "Nasi", "kcal": 600, "p": 26.0, "c": 15.0, "f": 50.0, "tags": ["Vegán"], "my_allergens": ["Földimogyoró"]},
        {"name": "Tejsavó fehérje shake (vízzel)", "cat": "Nasi", "kcal": 40, "p": 8.0, "c": 1.0, "f": 0.5, "tags": ["Vegetáriánus", "Gluténmentes"], "my_allergens": ["Tej"]},
        {"name": "Kefir", "cat": "Nasi", "kcal": 55, "p": 3.4, "c": 4.5, "f": 2.5, "tags": ["Vegetáriánus", "Gluténmentes"], "my_allergens": ["Tej"]},
        {"name": "Mandula (natúr)", "cat": "Nasi", "kcal": 579, "p": 21.0, "c": 22.0, "f": 49.0, "tags": ["Vegán", "Gluténmentes", "Laktózmentes"], "my_allergens": ["Diófélék"]},
    ]

    added_count = 0
    tags_count = 0
    allergens_linked_count = 0

    for food_data in demo_foods:
        # 3. Étel keresése / Létrehozása
        food = db.query(FoodItem).filter(FoodItem.food_name == food_data["name"]).first()
        
        if not food:
            food = FoodItem(
                food_name=food_data["name"],
                food_category=food_data["cat"],
                kcal_100g=food_data["kcal"],
                protein_100g=food_data["p"],
                carbs_100g=food_data["c"],
                fat_100g=food_data["f"],
                is_demo=True
            )
            db.add(food)
            db.commit()
            db.refresh(food)
            added_count += 1
        
        # 4. DietType Címkék (Tags)
        if "tags" in food_data:
            for tag_name in food_data["tags"]:
                diet_obj = diet_map.get(tag_name)
                if diet_obj:
                    link = db.query(FoodDietTypeLink).filter_by(
                        food_id=food.food_id, 
                        diet_type_id=diet_obj.diet_type_id
                    ).first()
                    if not link:
                        new_link = FoodDietTypeLink(food_id=food.food_id, diet_type_id=diet_obj.diet_type_id)
                        db.add(new_link)
                        tags_count += 1

        # 5. Allergének bekötése (BIZTONSÁGOSAN)
        # Csak akkor kötjük be, ha létezik az adatbázisban ("existing_allergens" mapben van)
        if "my_allergens" in food_data:
            current_allergens = food.allergens # SQLAlchemy relationship
            
            for alg_name in food_data["my_allergens"]:
                # Keresés a betöltött map-ben
                allergen_obj = existing_allergens.get(alg_name)
                
                if allergen_obj:
                    # Ellenőrzés: Még nincs hozzárendelve ehhez az ételhez?
                    if allergen_obj not in current_allergens:
                        food.allergens.append(allergen_obj)
                        allergens_linked_count += 1
                else:
                    # Itt a biztonsági pont: Ha nincs ilyen allergén, nem csinálunk semmit.
                    # Opcionális: kiírhatjuk, hogy mi hiányzik
                    # print(f"⚠️  Figyelem: '{alg_name}' allergén nem létezik az adatbázisban, kihagyva.")
                    pass

        db.commit()

    db.close()
    
    print("------------------------------------------------")
    print(f"✅ Kész! Ételek: {added_count} új.")
    print(f"🏷️  Diéta címkék: {tags_count} db.")
    print(f"⚠️  Allergén kapcsolatok: {allergens_linked_count} db (Csak létező allergénekkel!).")
    print("------------------------------------------------")

if __name__ == "__main__":
    seed_data()