# app/api/v1/routes/options.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import logging

from app.api.v1.deps import get_db

# --- LOGGOLÁS ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- MODELLEK ---
try:
    from app.models.allergen import Allergen
    from app.models.injury import Injury
    from app.models.health_condition import HealthCondition
except ImportError as e:
    logger.error(f"IMPORT HIBA: {e}")

router = APIRouter(prefix="/options", tags=["options"])

@router.get("/all")
def get_all_options(db: Session = Depends(get_db)):
    try:
        logger.info("Opciók lekérdezése...")
        
        allergies = db.query(Allergen).all()
        injuries = db.query(Injury).all()
        conditions = db.query(HealthCondition).all()

        # JAVÍTÁS: Itt a modellnek megfelelő mezőneveket (allergen_id, injury_name stb.) 
        # kell használni, és átfordítani 'id' és 'name' kulcsokra a frontend számára.
        
        return {
            "allergies": [
                {"id": a.allergen_id, "name": a.allergen_name} 
                for a in allergies
            ],
            "injuries": [
                {"id": i.injury_id, "name": i.injury_name} 
                for i in injuries
            ],
            "conditions": [
                {"id": c.condition_id, "name": c.condition_name} 
                for c in conditions
            ],
        }

    except Exception as e:
        logger.error(f"HIBA AZ OPTIONS LEKÉRÉSNÉL: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Szerver hiba: {str(e)}")