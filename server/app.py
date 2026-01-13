# app.py
import time
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np
import uvicorn
from arcface import ArcFaceEmbedder
from vector_data import VectorDatabaseManager
from structure_data import FaceDataManager
from pathlib import Path
import os

app = FastAPI()

# === Configuration ===
ORGANIZE_NAME = "idol"  # เปลี่ยนตาม organize ที่คุณใช้
SIMILARITY_THRESHOLD = 0.5  # Cosine similarity threshold (0-1, ยิ่งสูงยิ่งคล้าย)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# === Load models once at startup ===
print("Loading ArcFace model...")
embedder = ArcFaceEmbedder(ctx_id=0)

# Cache vector databases for all organizes
print("Pre-loading vector databases...")
vector_db_cache = {}
data_manager = FaceDataManager()
for org in data_manager.list_organizes():
    try:
        vector_db_cache[org] = VectorDatabaseManager(org)
        print(f"  ✓ Loaded: {org}")
    except Exception as e:
        print(f"  ✗ Failed to load {org}: {e}")

print(f"✅ Ready to accept requests ({len(vector_db_cache)} organize(s) loaded)")


@app.post("/upload")
async def upload_image(file: UploadFile = File(...), organize_name: str = ORGANIZE_NAME):
    try:
        start_time = time.time()

        # Read image
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            raise HTTPException(status_code=400, detail="Invalid image file")

        # Get embedding (let ArcFace detect face automatically)
        embedding = embedder.get_embedding(img)
        if embedding is None:
            return {
                "status": "no_face",
                "message": "cannot extract face embedding"
            }

        # Load vector DB for selected organize (use cache)
        if organize_name not in vector_db_cache:
            # Try to load if not in cache (new organize added)
            try:
                vector_db_cache[organize_name] = VectorDatabaseManager(organize_name)
            except FileNotFoundError:
                return {
                    "status": "error",
                    "message": f"Vector database not found for organize '{organize_name}'"
                }
        
        vector_db = vector_db_cache[organize_name]

        # Search in vector DB
        results = vector_db.search(embedding, k=1)  # ดูแค่ top-1
        
        if not results:
            return {
                "status": "unknown",
                "message": "No match found in database"
            }

        person_name, similarity = results[0]

        end_time = time.time()
        processing_time = end_time - start_time
        print(f"[INFO] Embedding extracted in {processing_time:.3f} seconds")

        # ตัดสินใจว่า "match" หรือไม่ (Cosine Similarity: ยิ่งสูงยิ่งคล้าย)
        if similarity > SIMILARITY_THRESHOLD:
            return {
                "status": "success",
                "person": person_name,
                "similarity": round(similarity, 4),
                "message": f"Match found: {person_name}"
            }
        else:
            return {
                "status": "unknown",
                "person": None,
                "similarity": round(similarity, 4),
                "message": f"Closest match: {person_name} (similarity: {round(similarity, 4)}), but below threshold ({SIMILARITY_THRESHOLD})"
            }
    except Exception as e:
        print(f"[ERROR] {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/")
async def root():
    return {"message": "Face Recognition API is running"}


@app.get("/persons")
async def list_persons(organize_name: str = ORGANIZE_NAME):
    """ดูรายชื่อคนทั้งหมดใน database"""
    try:
        vector_db = VectorDatabaseManager(organize_name)
        persons = vector_db.get_person()
        return {"persons": persons, "total": len(persons)}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Organize '{organize_name}' not found")


@app.get("/organizes")
async def list_organizes():
    """ดูรายชื่อ organize ทั้งหมด"""
    try:
        data_manager = FaceDataManager()
        organizes = data_manager.list_organizes()
        return {"organizes": organizes, "total": len(organizes)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/organize/{organize_name}/details")
async def get_organize_details(organize_name: str):
    """ดูรายละเอียด person ใน organize พร้อมจำนวนภาพและ vector"""
    try:
        # ตรวจสอบว่า organize มีอยู่จริง
        data_manager = FaceDataManager()
        if organize_name not in data_manager.list_organizes():
            raise HTTPException(status_code=404, detail=f"Organize '{organize_name}' not found")
        
        # โหลด vector database
        vector_manager = VectorDatabaseManager(organize_name)
        
        # ดึงรายชื่อ person และ vector count
        vector_counts = vector_manager.count_vectors_per_person()
        
        # ดึงจำนวนภาพจาก faces directory
        persons = data_manager.list_persons(organize_name)
        
        details = []
        for person in persons:
            image_count = data_manager.count_faces(organize_name, person)
            vector_count = vector_counts.get(person, 0)
            details.append({
                "person_name": person,
                "image_count": image_count,
                "vector_count": vector_count
            })
        
        return {
            "organize": organize_name,
            "members": details,
            "total_members": len(details)
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/organize/{organize_name}/rebuild")
async def rebuild_organize_vectors(organize_name: str):
    """บีบอัด (re-embed) vector ของ organize"""
    try:
        # ตรวจสอบว่า organize มีอยู่จริง
        data_manager = FaceDataManager()
        if organize_name not in data_manager.list_organizes():
            raise HTTPException(status_code=404, detail=f"Organize '{organize_name}' not found")
        
        # โหลด vector database
        vector_manager = VectorDatabaseManager(organize_name)
        
        # Re-embed ทั้งหมด
        vector_manager.embedding_organize(embedder, reset=True)
        
        # ดึงข้อมูลใหม่หลัง rebuild
        vector_counts = vector_manager.count_vectors_per_person()
        total_vectors = sum(vector_counts.values())
        
        return {
            "status": "success",
            "organize": organize_name,
            "message": f"Successfully rebuilt vector database for '{organize_name}'",
            "total_vectors": total_vectors,
            "vector_counts": vector_counts
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)