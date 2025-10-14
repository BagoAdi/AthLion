from sqlalchemy import Column, Integer, ForeignKey, String
from app.db.base import Base

from sqlalchemy.orm import relationship

class TrainingProfile(Base):
    __tablename__ = "training_profile"  

    training_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("user.user_id"), nullable=False)
    start_id = Column(Integer, ForeignKey("start_state.start_id"), nullable=False)
    load_level = Column(String(50), nullable=False)
    program_time = Column(String(50), nullable=False)
    preference = Column(String(100), nullable=True)
    is_active = Column(Integer, default=1) # 1 for active, 0 for inactive
    
    user = relationship("User", back_populates="training_profiles")
    start = relationship("StartState", back_populates="training_profiles")