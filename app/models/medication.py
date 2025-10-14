from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.db.base import Base

class Medication(Base):
    __tablename__ = "medication"

    medication_id = Column(Integer, primary_key=True, index=True)
    medication_name = Column(String(100), nullable=False)
    
    user_links = relationship("UserMedication", back_populates="medication", cascade="all, delete-orphan")