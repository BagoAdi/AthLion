import os
from pathlib import Path
import pandas as pd
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
from app.models.physical_activity import PhysicalActivity

BASE_DIR = Path(__file__).resolve().parent
CSV_PATH = BASE_DIR / "compendium_clean.csv"
ROOT_DIR = BASE_DIR.parent  # AthLion/AthLion
load_dotenv(ROOT_DIR / ".env")  # <<-- ez a lényeg

def get_engine():
    raw = os.getenv("DATABASE_URL")
    print("DATABASE_URL raw:", raw)  # debug

    if not raw:
        raise RuntimeError("DATABASE_URL nincs beállítva")

    url = raw.replace("postgres://", "postgresql://", 1)
    return create_engine(url)


def main():
    # CSV beolvasás
    df = pd.read_csv(CSV_PATH)

    # oszlopnevek legyenek kisbetűsek (ugyanaz, mint a cleanerben)
    df.columns = [c.strip().lower() for c in df.columns]
    print("Oszlopok a compendium_clean.csv-ben:", df.columns.tolist())

    # MET oszlop biztosítása
    if "met" not in df.columns:
        raise RuntimeError("Nincs 'met' oszlop a compendium_clean.csv-ben :/")

    # numerikus MET
    df["met"] = pd.to_numeric(df["met"], errors="coerce")
    df = df.dropna(subset=["met"])

    # egy kis biztonság: ha hiányzik valamelyik oszlop, pótoljuk üres stringgel
    if "code" not in df.columns:
        df["code"] = None
    if "major heading" not in df.columns:
        df["major heading"] = ""
    if "specific activities" not in df.columns:
        df["specific activities"] = ""

    engine = get_engine()
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()

    try:
        for _, row in df.iterrows():
            pa = PhysicalActivity(
                compendium_code=str(row["code"]) if row["code"] is not None else None,
                major_heading=str(row["major heading"]),
                specific_activities=str(row["specific activities"]),
                met=float(row["met"]),
            )
            session.add(pa)

        session.commit()
        print("PhysicalActivity sorok betöltve az adatbázisba.")
    except Exception as e:
        session.rollback()
        print("Hiba történt, rollback:", e)
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
