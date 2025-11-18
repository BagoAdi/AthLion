from app.db.session import SessionLocal
from app.models.injury import Injury
from app.models.health_condition import HealthCondition

db = SessionLocal()

injuries = ["Térdsérülés", "Vállsérülés", "Gerincsérv", "Bokasérülés", "Csuklófájdalom"]
conditions = ["Cukorbetegség (2-es típus)", "Magas vérnyomás", "Asztma", "Pajzsmirigy alulműködés"]

print("Adatok feltöltése...")

for i in injuries:
    if not db.query(Injury).filter_by(injury_name=i).first():
        db.add(Injury(injury_name=i))

for c in conditions:
    if not db.query(HealthCondition).filter_by(condition_name=c).first():
        db.add(HealthCondition(condition_name=c))

db.commit()
db.close()
print("Kész!")