# maintenance/clear_foods.py
import sys
import os
from pathlib import Path
from sqlalchemy import text

# --- Path hack, hogy lássuk az 'app' modult ---
BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.append(str(BASE_DIR))

from app.db.session import SessionLocal

def delete_with_dependencies(db, ids_to_delete, description):
    """
    Segédfüggvény, ami ID-k listája alapján töröl mindent (kapcsolatokat is).
    """
    if not ids_to_delete:
        print(f"   -> {description}: Nincs törlendő elem.")
        return

    print(f"   -> {description}: {len(ids_to_delete)} db étel törlése és a kapcsolódó adatok takarítása...")

    # 1. Törlés a kapcsolótáblákból (Allergének, Diéták, Logok)
    # A 'user_food_log' táblát is tisztítjuk, ha valaki véletlenül hibás ételt evett volna.
    
    # Megjegyzés: A :ids paramétert tuple-ként kell átadni az SQL-nek
    # Ha csak 1 elem van, a Python (1) nem tuple, hanem (1,), ezért figyelni kell.
    params = {"ids": tuple(ids_to_delete)}

    try:
        # Allergének kapcsolatai
        db.execute(text("DELETE FROM food_allergen_link WHERE food_id IN :ids"), params)
        
        # Diéta típusok kapcsolatai
        db.execute(text("DELETE FROM food_diet_type_link WHERE food_id IN :ids"), params)
        
        # Ha már van user_food_log tábla (a korábbi lépések alapján igen):
        try:
            db.execute(text("DELETE FROM user_food_log WHERE food_id IN :ids"), params)
        except Exception:
            # Ha mégsem létezne a log tábla, ne álljon meg a script
            pass

        # 2. Maguk az ételek törlése
        db.execute(text("DELETE FROM food_item WHERE food_id IN :ids"), params)
        
        db.commit()
        print(f"      ✅ Siker!")
        
    except Exception as e:
        print(f"      ❌ Hiba a törlés közben: {e}")
        db.rollback()

def clean_database():
    db = SessionLocal()
    print("🧹 Adatbázis takarítás indítása (biztonságos módban)...")
    
    try:
        # --- 1. FIZIKAI KÉPTELENSÉGEK ---
        print("1. Fizikailag lehetetlen adatok keresése...")
        
        invalid_sql = text("""
            SELECT food_id FROM food_item
            WHERE 
                (COALESCE(protein_100g, 0) + COALESCE(carbs_100g, 0) + COALESCE(fat_100g, 0)) > 105
                OR kcal_100g > 950
                OR kcal_100g < 0 OR protein_100g < 0 OR carbs_100g < 0 OR fat_100g < 0
        """)
        invalid_ids = [row[0] for row in db.execute(invalid_sql).fetchall()]
        delete_with_dependencies(db, invalid_ids, "Hibás makrók")

        # --- 2. HIÁNYOS ADATOK ---
        print("2. Hiányos adatok keresése...")
        
        missing_sql = text("""
            SELECT food_id FROM food_item
            WHERE food_name IS NULL OR TRIM(food_name) = '' OR kcal_100g IS NULL
        """)
        missing_ids = [row[0] for row in db.execute(missing_sql).fetchall()]
        delete_with_dependencies(db, missing_ids, "Hiányos adatok")

        # --- 3. DUPLIKÁCIÓK ---
        print("3. Duplikációk keresése (ez eltarthat egy ideig)...")
        
        # Ez a lekérdezés visszaadja az összes olyan ID-t, ami NEM az első előfordulása egy névnek
        # Tehát ha van 3 "Alma", megtartja a legkisebb ID-jút, és visszaadja a másik 2 ID-t törlésre.
        duplicate_sql = text("""
            SELECT food_id 
            FROM (
                SELECT food_id, 
                       ROW_NUMBER() OVER (PARTITION BY food_name ORDER BY food_id ASC) as rn
                FROM food_item
            ) t
            WHERE rn > 1
        """)
        
        # Mivel ez nagyon sok lehet, darabokban (chunk) töröljük, hogy ne akadjon ki a DB
        BATCH_SIZE = 5000
        all_duplicate_ids = [row[0] for row in db.execute(duplicate_sql).fetchall()]
        
        total_dupes = len(all_duplicate_ids)
        if total_dupes > 0:
            print(f"   -> Összesen {total_dupes} duplikációt találtam. Törlés darabokban...")
            
            for i in range(0, total_dupes, BATCH_SIZE):
                batch = all_duplicate_ids[i : i + BATCH_SIZE]
                delete_with_dependencies(db, batch, f"Duplikációk ({i+1}-{min(i+BATCH_SIZE, total_dupes)})")
        else:
             print("   -> Nincs duplikáció.")

        print("✅ TELJES TAKARÍTÁS KÉSZ!")

    except Exception as e:
        print(f"❌ Kritikus hiba: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    confirm = input("Ez a script TÖRÖLNI fog az adatbázisból. Biztosan futtatod? (igen/nem): ")
    if confirm.lower() == 'igen':
        clean_database()
    else:
        print("Megszakítva.")