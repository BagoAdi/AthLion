from sqlalchemy import Column, Integer, ForeignKey, String
from app.db.base import Base
from sqlalchemy.orm import relationship 

class UserMedication(Base):
    __tablename__ = "user_medication"

    user_id = Column(Integer, ForeignKey("user.user_id"), primary_key=True, nullable=False)
    medication_id = Column(Integer, ForeignKey("medication.medication_id"), primary_key=True, nullable=False)
    dosage = Column(String(50), nullable=True)
    schedule_note = Column(String(100), nullable=True)

    user = relationship("User", back_populates="medications")   
    medication = relationship("Medication", back_populates="users")
