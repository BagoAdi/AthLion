from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import app.models  # <-- EZ KELL: minden modell betölt, mapper regisztráció kész

from app.api.v1.routes import auth as auth_routes

app = FastAPI()

# ha egyszer külön originről szolgálnád a frontot, ez jól jön
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # fejlesztésre oké, prod-ban szűkítsd
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1) API mount
app.include_router(auth_routes.router, prefix="/api/v1")

# 2) Frontend (statikus) mount
# A projekt gyökeréből nézve a 'frontend' mappát szolgáljuk ki.
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")

# Opcionális healthcheck
@app.get("/healthz")
def health():
    return {"ok": True}