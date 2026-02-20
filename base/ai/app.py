"""
Face Recognition API - Application Entry Point

Architecture:
    Client --> Controller (HTTP handling)
    Controller --> Service (Business logic)
    Service --> Repository (Data access)
    Repository --> Database (FAISS / File system)
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from controller import organize_router, member_router, recognition_router

app = FastAPI(title="Face Recognition API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(organize_router)
app.include_router(member_router)
app.include_router(recognition_router)


@app.get("/")
async def health_check():
    return {"message": "Face Recognition API is running"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
