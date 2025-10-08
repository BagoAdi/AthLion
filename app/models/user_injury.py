from sqlalchemy import Column, Integer, PrimaryKeyConstraint, String, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base import Base

class UserInjury(Base):
    __tablename__ = 'user_injury'
    
    user_id = Column(Integer, ForeignKey('user.user_id'), nullable=False)
    injury_id = Column(Integer, ForeignKey('injury.injury_id'), nullable=False)
    status = Column(String(20), nullable=True)  # e.g., ongoing, recovered
    note = Column(String(200), nullable=True)  # Additional notes about the injury

    __table_args__ = (
        PrimaryKeyConstraint('user_id', 'injury_id', name='user_injury_pk'),
    )

    user = relationship("User", back_populates="injuries")
    injury = relationship("Injury", back_populates="users")
