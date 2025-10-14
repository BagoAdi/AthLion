from sqlalchemy import Column, Integer, String, Date, Float
from sqlalchemy.orm import relationship
from app.db.base import Base

class User(Base):
    __tablename__ = "user"

    user_id = Column(Integer, primary_key=True, index=True)
    user_name = Column(String(100), nullable=False)
    date_of_birth = Column(Date, nullable=False)
    height_cm = Column(Float, nullable=False)
    sex = Column(String(10), nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    
    allergies = relationship("UserAllergy", back_populates="user", cascade="all, delete-orphan")
    medications = relationship("UserMedication", back_populates="user", cascade="all, delete-orphan")
    injuries = relationship("UserInjury", back_populates="user", cascade="all, delete-orphan")
    conditions = relationship("UserCondition", back_populates="user", cascade="all, delete-orphan")
    diet_profiles = relationship("DietProfile", back_populates="user", cascade="all, delete-orphan")
    training_profiles = relationship("TrainingProfile", back_populates="user", cascade="all, delete-orphan")