# app/models/food_item.py
from sqlalchemy import Column, Integer, String, Float, Table, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base import Base

# --- Kapcsolótáblák Many-to-Many kapcsolatokhoz ---

# 1. Food <-> Allergen
food_allergen_link = Table(
    'food_allergen_link',
    Base.metadata,
    Column('food_id', Integer, ForeignKey('food_item.food_id'), primary_key=True),
    Column('allergen_id', Integer, ForeignKey('allergen.allergen_id'), primary_key=True)
)

# 2. Food <-> DietType (Ezt osztályként definiáljuk)
class FoodDietTypeLink(Base):
    __tablename__ = 'food_diet_type_link'
    food_id = Column(Integer, ForeignKey('food_item.food_id'), primary_key=True)
    diet_type_id = Column(Integer, ForeignKey('diet_type.diet_type_id'), primary_key=True)

    # String hivatkozások a körkörös import elkerülésére
    food_item = relationship("FoodItem", back_populates="diet_links")
    diet_type = relationship("DietType", back_populates="food_links")

# --- Fő Étel Modell ---

class FoodItem(Base):
    __tablename__ = "food_item"

    food_id = Column(Integer, primary_key=True, index=True)
    food_name = Column(String(255), nullable=False, index=True)
    food_category = Column(String(50), nullable=True, index=True)
    
    # Makrók / 100g
    kcal_100g = Column(Float, nullable=True)
    protein_100g = Column(Float, nullable=True)
    carbs_100g = Column(Float, nullable=True)
    fat_100g = Column(Float, nullable=True)

    # Kapcsolatok
    diet_links = relationship(
        "FoodDietTypeLink", 
        back_populates="food_item", 
        cascade="all, delete-orphan"
    )
    
    allergens = relationship(
        "Allergen",
        secondary=food_allergen_link, # Ez a fenti 'Table' objektum
        back_populates="food_items"
    )

    # ÚJ: Kapcsolat a UserFoodLog-hoz
    user_logs = relationship(
        "UserFoodLog", 
        back_populates="food_item", 
        cascade="all, delete-orphan"
    )

    # Helper property (opcionális, de hasznos)
    @property
    def diet_types(self):
        return [link.diet_type for link in self.diet_links]