# app/db/session.py
import os, sys, asyncio
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine

if sys.platform.startswith("win"):
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# 🔧 .env biztos betöltése a projekt gyökeréből függetlenül attól, honnan indítod
BASE_DIR = Path(__file__).resolve().parents[2]  # .../app/db/ -> projekt gyökér
env_path = BASE_DIR / ".env"
load_dotenv(env_path)

raw = os.getenv("DATABASE_URL")
if not raw:
    raise RuntimeError(f"DATABASE_URL nincs betöltve. .env helye: {env_path}")

# SYNC URL a FastAPI sync endpointokhoz
sync_url = raw.replace("postgres://", "postgresql://", 1)
engine = create_engine(sync_url, pool_pre_ping=True, future=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# opcionális async próba futtatáskor
async def async_probe():
    async_url = sync_url.replace("postgresql://", "postgresql+psycopg://", 1)
    aengine = create_async_engine(async_url, echo=False)
    async with aengine.connect() as conn:
        res = await conn.execute(text("select 'hello world'"))
        print(res.fetchall())
    await aengine.dispose()

if __name__ == "__main__":
    asyncio.run(async_probe())

    from sqlalchemy import text
    with engine.connect() as conn:
        print(conn.execute(text("select version();")).scalar_one())
        print("Neon kapcsolat OK ✅")