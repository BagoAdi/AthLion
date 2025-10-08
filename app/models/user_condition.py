from sqlalchemy import Column, Integer, ForeignKey, String
from app.db.base import Base
from sqlalchemy.orm import relationship

class UserCondition(Base):
    __tablename__ = "user_condition"

    user_id = Column(Integer, ForeignKey("user.userid"), nullable=False)
    condition_id = Column(Integer, ForeignKey("health_condition.condition_id"), nullable=False)
    note = Column(String(255), nullable=True)
    
    user = relationship("User", back_populates="conditions")
    condition = relationship("HealthCondition", back_populates="users")