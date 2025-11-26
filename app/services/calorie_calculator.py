# app/services/calorie_calculator.py
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models.user_weight_log import UserWeightLog
from app.models.physical_activity import PhysicalActivity
from app.models.excercise import Exercise

class CalorieCalculator:
    
    @staticmethod
    def get_user_weight(db: Session, user_id: int) -> float:
        """Lekéri a legfrissebb súlyt, vagy fallback 75kg."""
        latest = db.query(UserWeightLog)\
            .filter(UserWeightLog.user_id == user_id)\
            .order_by(desc(UserWeightLog.date))\
            .first()
        return float(latest.weight_kg) if latest else 75.0

    @staticmethod
    def calculate_kcal(met: float, weight_kg: float, duration_minutes: float) -> float:
        """ACSM képlet: (MET * 3.5 * kg) / 200 * perc"""
        if duration_minutes <= 0: return 0.0
        return round((met * 3.5 * weight_kg / 200) * duration_minutes, 1)

    @classmethod
    def estimate_gym_session(cls, db: Session, user_id: int, duration_minutes: int, exercise_ids: list[int]) -> float:
        """
        Kiszámolja a kalóriát Gym edzésre.
        Logika: Átlagoljuk a gyakorlatokhoz rendelt MET értékeket.
        """
        weight = cls.get_user_weight(db, user_id)
        
        if not exercise_ids:
            # Fallback: ha nincs gyakorlat ID, használjunk egy általános súlyzós MET-et (pl. 6.0)
            return cls.calculate_kcal(6.0, weight, duration_minutes)

        # Lekérjük a gyakorlatokhoz tartozó MET-eket
        exercises = db.query(Exercise).filter(Exercise.id.in_(exercise_ids)).all()
        
        met_values = []
        for ex in exercises:
            if ex.default_physical_activity:
                met_values.append(ex.default_physical_activity.met)
            else:
                met_values.append(6.0) # Biztonsági fallback

        if not met_values:
            return cls.calculate_kcal(6.0, weight, duration_minutes)

        avg_met = sum(met_values) / len(met_values)
        
        # Opcionális: Ha nagyon sok a pihenő, korrigálhatunk, 
        # de a MET 6.0 már eleve tartalmaz pihenőket a "Resistance training" definíciójában.
        return cls.calculate_kcal(avg_met, weight, duration_minutes)

    @classmethod
    def estimate_cardio_session(cls, db: Session, user_id: int, duration_minutes: int, physical_activity_id: int) -> float:
        weight = cls.get_user_weight(db, user_id)
        
        activity = db.query(PhysicalActivity).filter(PhysicalActivity.id == physical_activity_id).first()
        if not activity:
            return 0.0
            
        return cls.calculate_kcal(activity.met, weight, duration_minutes)