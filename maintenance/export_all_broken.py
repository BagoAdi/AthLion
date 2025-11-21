import sys
import os
import json
from pathlib import Path
from sqlalchemy import text

# --- Path hack ---
BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.append(str(BASE_DIR))

from app.db.session import SessionLocal

def export_broken_data():
    db = SessionLocal()
    print("🔍 Teljes adatbázis átvizsgálása matematikai hibák után...")
    
    # Ez a lekérdezés megkeresi azokat az ételeket, ahol a matek nem jön ki.
    # (A számított kalória és a megadott kalória között több mint 20% vagy 20 kcal eltérés van)
    # VAGY ahol valamelyik érték hiányzik.
    
    query = text("""
        SELECT food_id, food_name, kcal_100g, protein_100g, carbs_100g, fat_100g
        FROM food_item 
        WHERE 
           -- 1. Hiányzó kritikus adatok
           kcal_100g IS NULL 
           OR protein_100g IS NULL 
           OR carbs_100g IS NULL 
           OR fat_100g IS NULL
           
           -- 2. Vagy ahol a matek nagyon nem stimmel (Tolerancia: 20 kcal)
           OR ABS(
                (COALESCE(protein_100g, 0) * 4 + 
                 COALESCE(carbs_100g, 0) * 4 + 
                 COALESCE(fat_100g, 0) * 9) - kcal_100g
              ) > 25
        
        LIMIT 10000 -- Biztonsági limit, hogy ne fagyjon le a chat feltöltéskor (növelheted, ha kell)
    """)
    
    print("Lekérdezés futtatása...")
    results = db.execute(query).fetchall()
    
    export_list = []
    print(f"Találat: {len(results)} db problémás étel.")
    
    for row in results:
        export_list.append({
            "id": row.food_id,
            "name": row.food_name,
            "k": row.kcal_100g,
            "p": row.protein_100g,
            "c": row.carbs_100g,
            "f": row.fat_100g
        })
    
    # Mentés fájlba
    output_file = "broken_foods.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(export_list, f, indent=2, ensure_ascii=False)
        
    print(f"✅ Kész! A hibás ételek listája mentve ide: {output_file}")
    print("Ezt a fájlt töltsd fel a chat-be!")

    db.close()

if __name__ == "__main__":
    export_broken_data()