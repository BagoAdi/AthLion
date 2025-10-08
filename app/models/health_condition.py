from sqlalchemy import Column, Integer, String
from app.db.base import Base

class HealthCondition(Base):
    __tablename__ = "health_condition"

    condition_id = Column(Integer, primary_key=True, index=True)
    condition_name = Column(String(100), nullable=False)
