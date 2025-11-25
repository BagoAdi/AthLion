from sqlalchemy import Column, Integer, Float, Date, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime, date
from app.db.base import Base

class UserWeightLog(Base):
    __tablename__ = "user_weight_log"

    log_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("user.user_id"), nullable=False)
    date = Column(Date, default=date.today, nullable=False)
    weight_kg = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    
    user = relationship("User", backref="weight_logs")