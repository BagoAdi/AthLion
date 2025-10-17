from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.base import Base

DATABASE_URL='postgresql://neondb_owner:npg_KDS5iNEw7kWI@ep-young-sun-a9ktpvs5-pooler.gwc.azure.neon.tech/neondb?sslmode=require&channel_binding=require'

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
