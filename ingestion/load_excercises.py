from pathlib import Path
import sys
import os
import json

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# --- path + .env hack, hogy az "app" import működjön ---

BASE_DIR = Path(__file__).resolve().parent          # ingestion/
ROOT_DIR = BASE_DIR.parent                          # projekt gyökér (ahol az app/ és .env is van)

if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

load_dotenv(ROOT_DIR / ".env")

from app.models.excercise import Exercise  # noqa


JSON_PATH = BASE_DIR / "exercises.json"


def get_engine():
    raw = os.getenv("DATABASE_URL")
    if not raw:
        raise RuntimeError("DATABASE_URL nincs beállítva (.env?)")
    url = raw.replace("postgres://", "postgresql://", 1)
    return create_engine(url)


def main():
    if not JSON_PATH.exists():
        raise FileNotFoundError(f"Nem találom az exercises.json-t itt: {JSON_PATH}")

    raw = JSON_PATH.read_text(encoding="utf-8")
    data = json.loads(raw)

    # ha esetleg {"exercises": [...]} a struktúra:
    if isinstance(data, dict) and "exercises" in data:
        items = data["exercises"]
    else:
        items = data  # lista of dict

    engine = get_engine()
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()

    try:
        for item in items:
            ext_id = str(item.get("id"))

            if not ext_id:
                continue

            # ne duplikáljunk
            existing = session.query(Exercise).filter_by(external_id=ext_id).first()
            if existing:
                continue

            name_en = item.get("name") or "Unnamed exercise"

            primary = item.get("primaryMuscles") or []
            secondary = item.get("secondaryMuscles") or []

            if isinstance(primary, list):
                primary_str = ", ".join(primary)
            else:
                primary_str = str(primary)

            if isinstance(secondary, list):
                secondary_str = ", ".join(secondary)
            else:
                secondary_str = str(secondary)

            ex = Exercise(
                external_id=ext_id,
                name_en=name_en,
                name_hu=None,  # később fordítjuk magyarra

                force=item.get("force"),
                level=item.get("level"),
                mechanic=item.get("mechanic"),
                equipment=item.get("equipment"),
                category=item.get("category"),

                primary_muscles=primary_str,
                secondary_muscles=secondary_str,

                instructions=item.get("instructions") or [],
                images=item.get("images") or [],

                default_physical_activity_id=None,  # majd mapping script tölti
            )

            session.add(ex)

        session.commit()
        print("Exercises betöltve az adatbázisba.")
    except Exception as e:
        session.rollback()
        print("Hiba történt, rollback:", e)
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
