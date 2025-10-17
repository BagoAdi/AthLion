from app.db.session import engine
from app.db.base import Base
# init_db.py
print("🔄 Adatbázis inicializálása...")

# --- Fontos: modellek importálása, hogy regisztrálódjanak a Base.metadata alatt ---
from app.models.user import User
from app.models.injury import Injury
from app.models.allergen import Allergen
from app.models.medication import Medication
from app.models.start_state import StartState
from app.models.health_condition import HealthCondition

from app.models.user_allergy import UserAllergy
from app.models.user_medication import UserMedication
from app.models.user_injury import UserInjury
from app.models.user_condition import UserCondition
from app.models.diet_profile import DietProfile
from app.models.training_profile import TrainingProfile
# -------------------------------------------------------------------------------

Base.metadata.create_all(bind=engine)
print("✅ Táblák létrehozva!")
