# app/api/v1/routes/users.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any

from app.api.v1.routes.auth import get_db
from app.models.user import User
from app.schemas import UserOut, UserUpdate
from app.api.v1.deps import get_current_user

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/me", response_model=UserOut)
def read_users_me(current_user: User = Depends(get_current_user)):
    """
    Visszaadja a bejelentkezett felhasználó adatait.
    A hitelesítést a 'get_current_user' függőség végzi.
    """
    return current_user

@router.put("/me", response_model=UserOut)
def update_users_me(
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Frissíti a bejelentkezett felhasználó adatait.
    """
    # Végigmegyünk a payloadon, és csak azokat a mezőket frissítjük,
    # amik be lettek állítva (nem None).
    update_data = payload.dict(exclude_unset=True)
    
    for key, value in update_data.items():
        if hasattr(current_user, key):
            setattr(current_user, key, value)
        else:
            # Védelem, ha a séma olyat is engedne, ami nincs a modellen
            raise HTTPException(status_code=400, detail=f"Invalid field: {key}")

    try:
        db.add(current_user)
        db.commit()
        db.refresh(current_user)
        return current_user
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating user: {e}")