from sqlalchemy import Column, Integer, String
from app.db.base import Base    

class Allergen(Base):
    __tablename__ = "allergen"

    allergen_id = Column(Integer, primary_key=True, index=True)
    allergen_name = Column(String(100), nullable=False)