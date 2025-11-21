import json
import sys
import os
from pathlib import Path
from sqlalchemy import text

# --- Rendszer beállítása, hogy elérjük az adatbázist ---
BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.append(str(BASE_DIR))

from app.db.session import SessionLocal

def apply_fixes():
    print("🚀 Javítások alkalmazása az AI logika alapján...")
    
    # Megkeressük a root mappában lévő broken_foods.json-t
    input_file = BASE_DIR / "broken_foods.json"
    
    if not input_file.exists():
        print(f"❌ HIBA: Nem találom a fájlt itt: {input_file}")
        return

    with open(input_file, "r", encoding="utf-8") as f:
        broken_items = json.load(f)
    
    db = SessionLocal()
    fixed_count = 0
    
    print(f"📦 {len(broken_items)} hibás tétel feldolgozása...")

    for item in broken_items:
        # Eredeti állapot mentése összehasonlításhoz
        name = item['name'].lower() if item['name'] else ""
        kcal = item['k'] or 0
        p = item['p'] or 0
        c = item['c'] or 0
        f = item['f'] or 0
        
        original_values = (kcal, p, c, f)

        # --- 1. SZABÁLY: OLAJOK JAVÍTÁSA ---
        # Ha olaj, de 0 zsír van írva -> kiszámoljuk kalóriából
        if 'oil' in name and 'cooking' not in name and f == 0 and kcal > 0:
            f = round(kcal / 9, 1)
            p = 0
            c = 0
            
        # --- 2. SZABÁLY: CUKOR/MÉZ JAVÍTÁSA ---
        # Ha cukor/méz, de 0 szénhidrát -> kiszámoljuk kalóriából
        elif any(x in name for x in ['sugar', 'honey', 'syrup', 'agave', 'candy', 'juice']) and c == 0 and kcal > 0:
            c = round(kcal / 4, 1)
            p = 0
            if f == 0: f = 0

        # --- 3. SZABÁLY: MATEMATIKAI KORREKCIÓ ---
        # Ha a makrók megvannak, de a kalória hibás (túl nagy eltérés)
        # Kivétel: Alkoholos dolgok (bor, kivonat), ott a matek nem érvényes
        if not any(x in name for x in ['wine', 'extract', 'vanilla', 'beer', 'liqueur', 'alcohol']):
            if p > 0 or c > 0 or f > 0:
                calc_kcal = (p * 4) + (c * 4) + (f * 9)
                diff = abs(kcal - calc_kcal)
                
                # Ha több mint 20 kcal ÉS 20% az eltérés, akkor a makrók alapján javítjuk a kalóriát
                if diff > 20 and (kcal == 0 or diff / kcal > 0.2):
                    kcal = round(calc_kcal)

        # --- MENTÉS AZ ADATBÁZISBA ---
        # Csak akkor írunk az adatbázisba, ha változott valami
        if (kcal, p, c, f) != original_values:
            try:
                db.execute(text("""
                    UPDATE food_item 
                    SET kcal_100g = :k, protein_100g = :p, carbs_100g = :c, fat_100g = :f
                    WHERE food_id = :id
                """), {
                    "k": kcal, "p": p, "c": c, "f": f, "id": item['id']
                })
                fixed_count += 1
            except Exception as e:
                print(f"Hiba mentéskor (ID {item['id']}): {e}")

    db.commit()
    db.close()
    print(f"\n✅ SIKER! Összesen {fixed_count} db ételt javítottam ki az adatbázisban.")

if __name__ == "__main__":
    apply_fixes()