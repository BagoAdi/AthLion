from sqlalchemy import Column, Integer, String, Date, Float
from app.db.base import Base

class User(Base):
    __tablename__ = "user"

    userid = Column(Integer, primary_key=True, index=True)
    user_name = Column(String(100), nullable=False)
    date_of_birth = Column(Date, nullable=False)
    height_cm = Column(Float, nullable=False)
    sex = Column(String(10), nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)