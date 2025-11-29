# app/api/v1/routes/exercises.py
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.excercise import Exercise   # NÁLAD ÍGY HÍVJÁK A FÁJLT
from app.api.v1.schemas.exercise import ExerciseOut

router = APIRouter(
    prefix="/exercises",
    tags=["exercises"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# magyar név, ha van, különben angol
def _display_name(ex: Exercise) -> str:
    return ex.name_hu or ex.name_en

def _is_leg_exercise(ex: Exercise) -> bool:
    """
    LEG DAY szűrés – láb fő izomcsoportok alapján.
    A primary_muscles nálad sima string (pl. 'quadriceps, hamstrings').
    """
    if not ex.primary_muscles:
        return False

    text = ex.primary_muscles.lower()
    leg_keywords = [
        "quadriceps",
        "hamstrings",
        "glutes",
        "calves",
        "adductors",
        "abductors",
    ]
    return any(kw in text for kw in leg_keywords)


@router.get("/", response_model=List[ExerciseOut])
def list_exercises(
    theme: str = Query("all", description="push | pull | legs | all"),
    level: str = Query("all", description="beginner | intermediate | expert | all"),
    limit: int = Query(1000, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    """
    Gyakorlat lista a builderhez.

    - theme = push → Exercise.force == 'push'
    - theme = pull → Exercise.force == 'pull'
    - theme = legs → láb gyakorlatok primary_muscles alapján
    - level = beginner / intermediate / expert → Exercise.level szűrés
    """

    q = db.query(Exercise)

    # nehézség
    if level != "all":
        q = q.filter(Exercise.level == level)

    # push / pull / legs
    if theme == "push":
        q = q.filter(Exercise.force == "push")
    elif theme == "pull":
        q = q.filter(Exercise.force == "pull")
    elif theme == "legs":
        exercises = q.all()
        filtered = [ex for ex in exercises if _is_leg_exercise(ex)]
        return [
            ExerciseOut(
                id=ex.id,
                name=_display_name(ex),
                level=ex.level,
                force=ex.force,
                primary_muscles=ex.primary_muscles,
                secondary_muscles=ex.secondary_muscles,
                equipment=ex.equipment,
                category=ex.category,
            )
            for ex in filtered[:limit]
        ]

    exercises = q.limit(limit).all()

    return [
        ExerciseOut(
            id=ex.id,
            name=_display_name(ex),
            level=ex.level,
            force=ex.force,
            primary_muscles=ex.primary_muscles,
            secondary_muscles=ex.secondary_muscles,
            equipment=ex.equipment,
            category=ex.category,
        )
        for ex in exercises
    ]


@router.get("/{exercise_id}", response_model=ExerciseOut)
def get_exercise(
    exercise_id: int,
    db: Session = Depends(get_db),
):
    ex = db.query(Exercise).filter(Exercise.id == exercise_id).first()
    if not ex:
        raise HTTPException(status_code=404, detail="Exercise not found")

    return ExerciseOut(
        id=ex.id,
        name=_display_name(ex),
        level=ex.level,
        force=ex.force,
        primary_muscles=ex.primary_muscles,
        secondary_muscles=ex.secondary_muscles,
        equipment=ex.equipment,
        category=ex.category,
    )
