from sqlalchemy import Column, Integer, String
from app.db.base import Base

class Medication(Base):
    __tablename__ = "medication"

    medication_id = Column(Integer, primary_key=True, index=True)
    medication_name = Column(String(100), nullable=False)