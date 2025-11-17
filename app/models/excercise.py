from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB  # Postgresnél ez oké

from app.db.base import Base
from app.models.physical_activity import PhysicalActivity


class Exercise(Base):
    __tablename__ = "exercises"

    id = Column(Integer, primary_key=True, index=True)

    # JSON-ben lévő id (pl. "3_4_Sit-Up")
    external_id = Column(String, unique=True, index=True, nullable=False)

    # angol / magyar név
    name_en = Column(String, nullable=False)
    name_hu = Column(String, nullable=True)  # később fordítjuk

    # plusz mezők a JSON alapján
    force = Column(String, nullable=True)       # "pull"
    level = Column(String, nullable=True)       # "beginner"
    mechanic = Column(String, nullable=True)    # "compound"
    equipment = Column(String, nullable=True)   # "body only"
    category = Column(String, nullable=True)    # "strength"

    primary_muscles = Column(String, nullable=True)   # "abdominals"
    secondary_muscles = Column(String, nullable=True) # pl. "obliques"

    # Ezeket JSONB-ben tároljuk, hogy listaként vissza tudd adni
    instructions = Column(JSONB, nullable=True)  # list[str]
    images = Column(JSONB, nullable=True)        # list[str]

    # Kapcsolat a Compendium sorhoz (MET)
    default_physical_activity_id = Column(
        Integer,
        ForeignKey("physical_activities.id"),
        nullable=True,
    )
    default_physical_activity = relationship(PhysicalActivity)
