from sqlalchemy import Column, Integer, String
from app.db.base import Base    

class Injury(Base):
    __tablename__ = 'injury'
    
    injury_id = Column(Integer, primary_key=True, index=True)
    injury_name = Column(String(50), unique=True, index=True, nullable=False)
    description = Column(String(100), nullable=True)
    severity = Column(Integer, nullable=True)  # e.g., scale of 1-10
    treatment = Column(String(20), nullable=True)  # e.g., rest, medication, surgery

