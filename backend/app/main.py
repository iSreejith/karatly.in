from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import face, chat

app = FastAPI(title="Karatly API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(face.router)
app.include_router(chat.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
