from sqlalchemy import Column, Integer, String, Float
from app.db.base import Base

class PhysicalActivity(Base):
    __tablename__ = "physical_activities"

    id = Column(Integer, primary_key=True, index=True)
    compendium_code = Column(String, index=True, nullable=True)
    major_heading = Column(String, nullable=True)
    specific_activities = Column(String, nullable=False)
    met = Column(Float, nullable=False)
