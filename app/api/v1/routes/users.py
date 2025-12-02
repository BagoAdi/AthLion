# app/api/v1/routes/users.py
from datetime import date, timedelta
import traceback
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload  # <--- FONTOS: joinedload importálása
from typing import Dict, Any

from app.api.v1.routes.auth import get_db
from app.models.user import User
from app.schemas import UserOut, UserUpdate
from app.api.v1.deps import get_current_user

router = APIRouter(prefix="/users", tags=["users"])

def calculate_level_info(total_xp: int):
    """
    Kiszámolja a szintet és a rangot az XP alapján.
    Minden szint 500 XP.
    """
    level = 1 + (total_xp // 500)
    xp_in_level = total_xp % 500
    next_level_xp = 500
    
    # Rangok (AthLion témában)
    if level < 5: title = "Kezdő Oroszlán 🦁"
    elif level < 10: title = "Haladó Vadász 🐾"
    elif level < 20: title = "Dzsungel Királya 👑"
    else: title = "ATHLION Legenda 🔥"
    
    return {
        "level": level,
        "title": title,
        "current_xp": total_xp,
        "xp_in_level": xp_in_level,
        "required_xp": next_level_xp,
        "progress_percent": (xp_in_level / next_level_xp) * 100
    }

@router.put("/me", response_model=UserOut)
def update_users_me(
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Frissíti a bejelentkezett felhasználó adatait.
    GOLYÓÁLLÓ VERZIÓ: Közvetlenül az adatbázisból kéri le a rekordot a módosításhoz.
    """
    # 1. Keresés: Nem bízunk a 'current_user'-ben, lekérjük frissen a DB-ből
    user_in_db = db.query(User).filter(User.user_id == current_user.user_id).first()

    if not user_in_db:
        raise HTTPException(status_code=404, detail="Felhasználó nem található")

    # 2. Adatok átírása
    update_data = payload.dict(exclude_unset=True)
    
    # Debug: Lássuk a terminálban, hogy megérkezett-e az adat!
    if 'dashboard_config' in update_data:
        print(f"DEBUG: Mentés indul! Config elemek száma: {len(update_data['dashboard_config'])}")

    for key, value in update_data.items():
        if hasattr(user_in_db, key):
            setattr(user_in_db, key, value)

    # 3. Kényszerített mentés
    try:
        db.add(user_in_db) # Explicit jelezzük, hogy ez módosult
        db.commit()
        db.refresh(user_in_db)
        return user_in_db
    except Exception as e:
        db.rollback()
        print(f"Mentési hiba: {e}")
        raise HTTPException(status_code=500, detail="Adatbázis mentési hiba")
    
@router.get("/streak")
def get_user_login_streak(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Kiszámolja és frissíti a Login Streak-et (Lángnyelv).
    Duolingo logika: 
    - Ha tegnap voltál utoljára -> Növeljük +1
    - Ha ma már voltál -> Marad a régi
    - Ha régebben voltál -> Reset 1-re
    """
    today = date.today()
    last_date = current_user.last_login_date
    current_streak = current_user.login_streak or 0

    # Ha még sosem lépett be (első alkalom)
    if not last_date:
        current_user.last_login_date = today
        current_user.login_streak = 1
        db.commit()
        return {"streak": 1, "saved_today": True}

    # Ha MA már volt belépés: Nincs teendő, csak visszaadjuk
    if last_date == today:
        return {"streak": current_streak, "saved_today": True}

    # Ha TEGNAP volt az utolsó belépés: Növeljük a szériát!
    if last_date == today - timedelta(days=1):
        current_user.login_streak += 1
        current_user.last_login_date = today
        db.commit()
        return {"streak": current_user.login_streak, "saved_today": True}

    # Ha RÉGEBBEN volt (megszakadt a lánc): Reset 1-re
    # (Mert a mai nap az első az új szériában)
    current_user.login_streak = 1
    current_user.last_login_date = today
    db.commit()
    
    return {"streak": 1, "saved_today": True}

@router.get("/xp_status")
def get_xp_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Visszaadja a felhasználó szintjét és XP-jét."""
    # Ha nincs még XP, legyen 0
    xp = current_user.current_xp or 0
    return calculate_level_info(xp)