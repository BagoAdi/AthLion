from sqlalchemy import Column, Integer, ForeignKey, String
from app.db.session import Base 
from app.models.user import User
from app.models.allergen import Allergen
from sqlalchemy.orm import relationship

class UserAllergy(Base):
    __tablename__ = "user_allergy"

    user_id = Column(Integer, ForeignKey("user.userid"), primary_key=True, nullable=False)
    allergen_id = Column(Integer, ForeignKey("allergen.allergen_id"), primary_key=True, nullable=False)
    severity = Column(Integer, nullable=False)  # e.g., scale from 1 to 10
    note = Column(String(100), nullable=True)

    user = relationship("User", back_populates="allergies")
    allergen = relationship("Allergen", back_populates="users")
    
