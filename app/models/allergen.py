from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.db.base import Base
  

class Allergen(Base):
    __tablename__ = "allergen"

    allergen_id = Column(Integer, primary_key=True, index=True)
    allergen_name = Column(String(100), nullable=False)
    
    user_links = relationship("UserAllergy", back_populates="allergen", cascade="all, delete-orphan")

    food_items = relationship(
        "FoodItem",
        secondary="food_allergen_link", # String hivatkozás
        back_populates="allergens"
    )