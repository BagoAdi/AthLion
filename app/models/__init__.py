# --- 1. Alap "Szülő" modellek (amikre mások hivatkoznak) ---
from .user import User
from .allergen import Allergen
from .medication import Medication
from .injury import Injury
from .health_condition import HealthCondition
from .start_state import StartState

# --- 2. Új "Szülő" modell (amit a food_item használ) ---
from .diet_type import DietType

# --- 3. Eredeti "Gyerek" modellek (amik a szülőkre hivatkoznak) ---
from .user_allergy import UserAllergy
from .user_medication import UserMedication
from .user_injury import UserInjury
from .user_condition import UserCondition
from .diet_profile import DietProfile
from .training_profile import TrainingProfile

# --- 4. Új "Gyerek" modell (Ennek kell a VÉGÉN lennie) ---
# Ez tölti be a FoodItem-et ÉS a kapcsolótáblákat.
from .food_item import FoodItem, FoodDietTypeLink, food_allergen_link

from .physical_activity import PhysicalActivity
from .excercise import Exercise

from .user_food_log import UserFoodLog
