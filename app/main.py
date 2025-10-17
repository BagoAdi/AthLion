from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def root():
    return {"message": "Ez itt az alapértelmezett útvonal"}


