from sqlalchemy import Column, DateTime, Integer, String, Date, Float, func
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
    password_hash = Column(String(256), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    allergies = relationship("UserAllergy", back_populates="user", cascade="all, delete-orphan")
    medications = relationship("UserMedication", back_populates="user", cascade="all, delete-orphan")
    injuries = relationship("UserInjury", back_populates="user", cascade="all, delete-orphan")
    conditions = relationship("UserCondition", back_populates="user", cascade="all, delete-orphan")
    diet_profiles = relationship("DietProfile", back_populates="user", cascade="all, delete-orphan")
    training_profiles = relationship("TrainingProfile", back_populates="user", cascade="all, delete-orphan")
    food_logs = relationship("UserFoodLog", back_populates="user", cascade="all, delete-orphan")