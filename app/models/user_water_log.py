from sqlalchemy import Column, Integer, ForeignKey, Date
from sqlalchemy.orm import relationship
from app.db.base import Base

class UserWaterLog(Base):
    __tablename__ = "user_water_log"

    log_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("user.user_id"), nullable=False)
    date = Column(Date, nullable=False)
    amount_ml = Column(Integer, nullable=False)  # Pl.: 250, 500

    # Kapcsolat a User táblával
    user = relationship("User", back_populates="water_logs")