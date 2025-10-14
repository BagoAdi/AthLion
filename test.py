# teszt.py
import sqlalchemy as sa
engine = sa.create_engine("mysql+pymysql://athlion:athlion@127.0.0.1:3306/athlion", pool_pre_ping=True)
with engine.connect() as c:
    print(c.exec_driver_sql("SELECT 1").scalar())