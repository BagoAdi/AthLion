from sqlalchemy import Column, Float, Integer, String, ForeignKey, column
from app.db.base import Base

from sqlalchemy.orm import relationship

class DietProfile(Base):
    __tablename__ = "diet_profile"

    diet_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("user.user_id"), nullable=False)
    start_id = Column(Integer, ForeignKey("start_state.start_id"), nullable=False)
    diet_type = Column(String(50), nullable=False)
    is_active = Column(Integer, default=1) # 1 for active, 0 for inactive

    calories = Column(Float, nullable=True)
    protein = Column(Float, nullable=True)
    carbs = Column(Float, nullable=True)
    fat = Column(Float, nullable=True)

    user = relationship("User", back_populates="diet_profiles")
    # A modell neve StartState, nem "Start"
    start = relationship("StartState", back_populates="diet_profiles")