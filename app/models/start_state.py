from sqlalchemy import Column, Integer, String, Float
from sqlalchemy.orm import relationship
from app.db.base import Base

class StartState(Base):
    __tablename__ = "start_state"

    start_id = Column(Integer, primary_key=True, index=True)
    start_weight_kg = Column(Float, nullable=False)
    target_weight_kg = Column(Float, nullable=False)
    goal_type = Column(String(50), nullable=False)  # e.g., "weight_loss", "muscle_gain"
    motivation_goal = Column(String(255), nullable=True)
    created_at = Column(String(50), nullable=False)  # ISO format date string
    
    diet_profiles = relationship("DietProfile", back_populates="start", cascade="all, delete-orphan")
    training_profiles = relationship("TrainingProfile", back_populates="start", cascade="all, delete-orphan")