from sqlalchemy import Column, Integer, ForeignKey, String
from sqlalchemy.orm import relationship
from app.db.base import Base

class UserCondition(Base):
    __tablename__ = "user_condition"

    user_id = Column(Integer, ForeignKey("user.user_id"), primary_key=True, nullable=False)
    condition_id = Column(Integer, ForeignKey("health_condition.condition_id"), primary_key=True, nullable=False)
    note = Column(String(255), nullable=True)

    user = relationship("User", back_populates="conditions")
    condition = relationship("HealthCondition", back_populates="users")