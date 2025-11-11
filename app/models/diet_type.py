# app/models/diet_type.py
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.db.base import Base

class DietType(Base):
    __tablename__ = "diet_type"

    diet_type_id = Column(Integer, primary_key=True, index=True)
    diet_name = Column(String(100), unique=True, nullable=False)
    
    # Kapcsolat a FoodItem-hez
    food_links = relationship(
        "FoodDietTypeLink", 
        back_populates="diet_type", 
        cascade="all, delete-orphan"
    )