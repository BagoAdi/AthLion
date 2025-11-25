# app/models/workout_log.py
from sqlalchemy import Column, Integer, String, Date, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.db.base import Base

class WorkoutLog(Base):
    __tablename__ = "workout_log"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("user.user_id"), nullable=False)
    date = Column(Date, nullable=False, index=True)
    mode = Column(String(50), nullable=False)  # 'gym' vagy 'cardio'
    day_type = Column(String(50), nullable=True) # pl. 'push', 'pull', 'legs' (csak gym-nél)
    
    # Itt tároljuk a részleteket JSON-ben:
    # Gym: { "main_ids": [1, 2, 3], "extra_ids": [4, 5, 6] }
    # Cardio: { "cardio_id": 10, "duration": 30 }
    data = Column(JSON, nullable=False)

    user = relationship("User", back_populates="workout_logs")