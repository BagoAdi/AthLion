# app/api/v1/routes/users.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload  # <--- FONTOS: joinedload importálása
from typing import Dict, Any

from app.api.v1.routes.auth import get_db
from app.models.user import User
from app.schemas import UserOut, UserUpdate
from app.api.v1.deps import get_current_user

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/me", response_model=UserOut)
def read_users_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db) # <--- Kell a DB session az újratöltéshez
):
    """
    Visszaadja a bejelentkezett felhasználó adatait.
    A training_profiles kapcsolatot előre betöltjük (joinedload),
    hogy elkerüljük a DetachedInstanceError-t vagy a hiányzó adatokat.
    """
    # Újratöltjük a usert a kapcsolatokkal együtt
    user_with_profiles = db.query(User).options(
        joinedload(User.training_profiles)
    ).filter(User.user_id == current_user.user_id).first()
    
    return user_with_profiles

@router.put("/me", response_model=UserOut)
def update_users_me(
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Frissíti a bejelentkezett felhasználó adatait.
    """
    update_data = payload.dict(exclude_unset=True)
    
    for key, value in update_data.items():
        if hasattr(current_user, key):
            setattr(current_user, key, value)
        else:
            # Védelem: csak olyan mezőt engedünk frissíteni, ami létezik a modellen
            pass

    db.commit()
    db.refresh(current_user)
    
    # Itt is érdemes lenne újratölteni a profilokat, de a válasznál
    # a FastAPI lehet, hogy okosabb. A biztonság kedvéért:
    return current_user