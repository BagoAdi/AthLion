from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.db.base import Base

class HealthCondition(Base):
    __tablename__ = "health_condition"

    condition_id = Column(Integer, primary_key=True, index=True)
    condition_name = Column(String(100), nullable=False)

    user_links = relationship("UserCondition", back_populates="condition", cascade="all, delete-orphan")