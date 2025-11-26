# maintenance/map_exercises_met.py
import sys
import os

# Hozzáadjuk a projekt gyökerét a path-hoz, hogy lássa az app modult
sys.path.append(os.getcwd())

from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.excercise import Exercise
from app.models.physical_activity import PhysicalActivity

def map_exercises(db: Session):
    print("--- Mapping Exercises to MET values ---")
    
    # 1. Referencia aktivitások lekérése (Compendium kódok alapján)
    # 2050: Resistance training (Weight lifting, vigorous) - MET 6.0
    gym_vigorous = db.query(PhysicalActivity).filter(PhysicalActivity.compendium_code == '2050').first()
    # 2054: Resistance training (Moderate) - MET 3.5
    gym_moderate = db.query(PhysicalActivity).filter(PhysicalActivity.compendium_code == '2054').first()
    # 2101: Stretching - MET 2.3
    stretching = db.query(PhysicalActivity).filter(PhysicalActivity.compendium_code == '2101').first()
    # 2022: Calisthenics (moderate) - MET 3.8
    calisthenics = db.query(PhysicalActivity).filter(PhysicalActivity.compendium_code == '2022').first()
    # 2020: Calisthenics (vigorous) - MET 8.0
    calisthenics_hard = db.query(PhysicalActivity).filter(PhysicalActivity.compendium_code == '2020').first()

    # Fallback, ha nincs meg a kód (ne szálljon el)
    default_activity = gym_vigorous if gym_vigorous else db.query(PhysicalActivity).first()

    if not default_activity:
        print("CRITICAL: Nincsenek PhysicalActivity adatok! Futtasd le előbb a seedert/migrációt.")
        return

    exercises = db.query(Exercise).all()
    count = 0

    for ex in exercises:
        # Ha már van beállítva kézzel, nem bántjuk (opcionális logika)
        # if ex.default_physical_activity_id is not None: continue

        target_pa = default_activity

        # LOGIKA: Kategória és felszerelés alapján döntünk
        cat = (ex.category or "").lower()
        mech = (ex.mechanic or "").lower()
        equip = (ex.equipment or "").lower()

        if cat == 'stretching' or cat == 'yoga':
            target_pa = stretching or default_activity
        elif cat == 'plyometrics' or cat == 'cardio':
            target_pa = calisthenics_hard or default_activity
        elif equip == 'body only':
            target_pa = calisthenics or default_activity
        elif cat == 'strength':
            # Ha súlyzós, feltételezzük a kemény edzést
            target_pa = gym_vigorous or default_activity
        else:
            target_pa = gym_moderate or default_activity

        ex.default_physical_activity_id = target_pa.id
        count += 1
    
    db.commit()
    print(f"Siker! {count} gyakorlat frissítve MET referenciával.")

if __name__ == "__main__":
    db = SessionLocal()
    try:
        map_exercises(db)
    finally:
        db.close()