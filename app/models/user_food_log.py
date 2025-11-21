from sqlalchemy import Column, Integer, ForeignKey, String, Date, Float
from sqlalchemy.orm import relationship
from app.db.base import Base

class UserFoodLog(Base):
    __tablename__ = "user_food_log"

    log_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("user.user_id"), nullable=False)
    food_id = Column(Integer, ForeignKey("food_item.food_id"), nullable=False)
    
    date = Column(Date, nullable=False)
    meal_type = Column(String(50), nullable=False) # pl.: 'breakfast', 'lunch', 'dinner', 'snacks'
    quantity_grams = Column(Float, nullable=False)

    # Kapcsolatok
    user = relationship("User", back_populates="food_logs")
    food_item = relationship("FoodItem", back_populates="user_logs")