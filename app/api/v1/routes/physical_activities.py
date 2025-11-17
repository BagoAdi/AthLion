# app/api/v1/routes/physical_activities.py
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.physical_activity import PhysicalActivity
from app.api.v1.schemas.physical_activity import PhysicalActivityOut

router = APIRouter(
    prefix="/api/v1/physical_activities",
    tags=["physical_activities"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _exclude_non_sporty(q):
    """
    Itt szűrjük ki az olyan sorokat, mint 'lawn and garden', 'household', stb.
    Ha a compendium máshogy fogalmaz, ide nyugodtan felvehetsz még kulcsszavakat.
    """
    patterns = ["lawn", "garden", "gardening", "household", "snow shoveling"]
    for p in patterns:
        like = f"%{p}%"
        q = q.filter(
            ~PhysicalActivity.major_heading.ilike(like),
            ~PhysicalActivity.specific_activities.ilike(like),
        )
    return q


@router.get("/", response_model=List[PhysicalActivityOut])
def list_physical_activities(
    search: Optional[str] = Query(
        None, description="Opcionális szűrés név alapján (pl. 'run', 'bike')"
    ),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    q = db.query(PhysicalActivity)
    q = _exclude_non_sporty(q)

    if search:
        like = f"%{search}%"
        q = q.filter(PhysicalActivity.specific_activities.ilike(like))

    rows = q.order_by(PhysicalActivity.met.desc()).limit(limit).all()

    return [
        PhysicalActivityOut(
            id=row.id,
            name=row.specific_activities,
            met=row.met,
            major_heading=row.major_heading,
        )
        for row in rows
    ]
