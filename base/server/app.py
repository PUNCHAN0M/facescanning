# app.py
import time
from fastapi import FastAPI, File, UploadFile, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np
import uvicorn
from arcface import ArcFaceEmbedder
from vector_data import VectorDatabaseManager
from structure_data import FaceDataManager
from detection_tracker import DetectionTracker
from pathlib import Path
import os
from typing import Optional

app = FastAPI()

# Session trackers (key: session_id, value: DetectionTracker)
session_trackers = {}

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
async def upload_image(
    file: UploadFile = File(...), 
    organize_name: str = ORGANIZE_NAME,
    session_id: Optional[str] = Query(None)
):
    try:
        # สร้าง session_id ถ้ายังไม่มี
        if session_id is None:
            import uuid
            session_id = str(uuid.uuid4())
        
        # สร้าง tracker สำหรับ session นี้ถ้ายังไม่มี
        if session_id not in session_trackers:
            session_trackers[session_id] = DetectionTracker(window_size=10, confirm_threshold=5)
        
        tracker = session_trackers[session_id]

        # Read image
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            raise HTTPException(status_code=400, detail="Invalid image file")

        # Get embedding (let ArcFace detect face automatically)
        embedding = embedder.get_embedding(img)
        if embedding is None:
            # ไม่เจอใบหน้า - บันทึก None ใน tracker
            tracker.add_detection(None)
            return {
                "status": "no_face",
                "message": "cannot extract face embedding",
                "session_id": session_id,
                "confirmed_person": None
            }

        # Load vector DB for selected organize (use cache)
        if organize_name not in vector_db_cache:
            # Try to load if not in cache (new organize added)
            try:
                vector_db_cache[organize_name] = VectorDatabaseManager(organize_name)
            except FileNotFoundError:
                return {
                    "status": "error",
                    "message": f"Vector database not found for organize '{organize_name}'",
                    "session_id": session_id
                }
        
        vector_db = vector_db_cache[organize_name]

        # Search in vector DB
        results = vector_db.search(embedding, k=1)  # ดูแค่ top-1
        
        if not results:
            tracker.add_detection(None)
            return {
                "status": "unknown",
                "message": "No match found in database",
                "session_id": session_id,
                "confirmed_person": None
            }

        person_name, similarity = results[0]

        # ตัดสินใจว่า "match" หรือไม่ (Cosine Similarity: ยิ่งสูงยิ่งคล้าย)
        detected_person = None
        if similarity > SIMILARITY_THRESHOLD:
            detected_person = person_name
        
        # เพิ่ม detection ลง tracker
        tracker.add_detection(detected_person)
        
        # ตรวจสอบว่ามีคนที่ confirm แล้วหรือยัง
        confirmed_person = tracker.get_confirmed_person()
        
        return {
            "status": "success" if detected_person else "unknown",
            "person": detected_person,  # คนที่ detect ได้ใน frame นี้
            "confirmed_person": confirmed_person,  # คนที่ confirm แล้ว (>= 5/10 frames)
            "similarity": round(similarity, 4),
            "session_id": session_id,
            "message": f"Detected: {detected_person}, Confirmed: {confirmed_person}"
        }
    except Exception as e:
        print(f"[ERROR] {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/session/{session_id}/reset")
async def reset_session(session_id: str):
    """ล้าง detection history ของ session"""
    if session_id in session_trackers:
        session_trackers[session_id].reset()
        return {
            "status": "success",
            "message": f"Session '{session_id}' reset successfully"
        }
    else:
        return {
            "status": "not_found",
            "message": f"Session '{session_id}' not found"
        }


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


@app.post("/organize/create")
async def create_organize(organize_name: str):
    """สร้าง organize ใหม่"""
    try:
        data_manager = FaceDataManager()
        
        # Check if already exists
        if organize_name in data_manager.list_organizes():
            raise HTTPException(status_code=400, detail=f"Organize '{organize_name}' already exists")
        
        # Create directory structure
        organize_dir = Path("data") / organize_name
        faces_dir = organize_dir / "faces"
        vector_dir = organize_dir / "vector"
        
        faces_dir.mkdir(parents=True, exist_ok=True)
        vector_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize empty vector DB
        import faiss
        import numpy as np
        index = faiss.IndexFlatIP(512)
        faiss.write_index(index, str(vector_dir / "index.faiss"))
        np.save(vector_dir / "meta.npy", np.array([], dtype=object))
        
        # Load into cache
        vector_db_cache[organize_name] = VectorDatabaseManager(organize_name)
        
        return {
            "status": "success",
            "organize": organize_name,
            "message": f"Successfully created organize '{organize_name}'"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/organize/{organize_name}/member")
async def create_member(organize_name: str, person_name: str):
    """เพิ่มสมาชิกใหม่ใน organize"""
    try:
        data_manager = FaceDataManager()
        
        # Check organize exists
        if organize_name not in data_manager.list_organizes():
            raise HTTPException(status_code=404, detail=f"Organize '{organize_name}' not found")
        
        # Check member already exists
        if person_name in data_manager.list_persons(organize_name):
            raise HTTPException(status_code=400, detail=f"Member '{person_name}' already exists")
        
        # Create person directory
        data_manager.create_person(organize_name, person_name)
        
        return {
            "status": "success",
            "organize": organize_name,
            "person": person_name,
            "message": f"Successfully created member '{person_name}'"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/organize/{organize_name}/member/{person_name}/images")
async def list_member_images(organize_name: str, person_name: str):
    """ดูรายการภาพของสมาชิก"""
    try:
        data_manager = FaceDataManager()
        person_dir = Path("data") / organize_name / "faces" / person_name
        
        if not person_dir.exists():
            raise HTTPException(status_code=404, detail=f"Member '{person_name}' not found")
        
        image_extensions = {".png", ".jpg", ".jpeg", ".bmp", ".tiff", ".avif"}
        images = [
            f.name for f in person_dir.iterdir()
            if f.is_file() and f.suffix.lower() in image_extensions
        ]
        
        return {
            "organize": organize_name,
            "person": person_name,
            "images": images,
            "total": len(images)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/organize/{organize_name}/member/{person_name}/image/{filename}")
async def get_member_image(organize_name: str, person_name: str, filename: str):
    """ดาวน์โหลดภาพของสมาชิก"""
    from fastapi.responses import FileResponse
    
    try:
        image_path = Path("data") / organize_name / "faces" / person_name / filename
        
        if not image_path.exists():
            raise HTTPException(status_code=404, detail="Image not found")
        
        return FileResponse(image_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/organize/{organize_name}/member/{person_name}/upload")
async def upload_member_image(
    organize_name: str,
    person_name: str,
    file: UploadFile = File(...)
):
    """อัปโหลดภาพสมาชิก"""
    try:
        person_dir = Path("data") / organize_name / "faces" / person_name
        
        if not person_dir.exists():
            raise HTTPException(status_code=404, detail=f"Member '{person_name}' not found")
        
        # Save file
        import uuid
        file_ext = Path(file.filename).suffix
        new_filename = f"{uuid.uuid4()}{file_ext}"
        file_path = person_dir / new_filename
        
        contents = await file.read()
        with open(file_path, "wb") as f:
            f.write(contents)
        
        return {
            "status": "success",
            "organize": organize_name,
            "person": person_name,
            "filename": new_filename,
            "message": f"Successfully uploaded image"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/organize/{organize_name}/member/{person_name}/image/{filename}")
async def delete_member_image(organize_name: str, person_name: str, filename: str):
    """ลบภาพของสมาชิก"""
    try:
        image_path = Path("data") / organize_name / "faces" / person_name / filename
        
        if not image_path.exists():
            raise HTTPException(status_code=404, detail="Image not found")
        
        image_path.unlink()
        
        return {
            "status": "success",
            "message": f"Successfully deleted image '{filename}'"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/organize/{old_name}/rename")
async def rename_organize(old_name: str, new_name: str):
    """เปลี่ยนชื่อ organize"""
    try:
        data_manager = FaceDataManager()
        
        # Rename directory
        data_manager.rename_organize(old_name, new_name)
        
        # Update cache
        if old_name in vector_db_cache:
            del vector_db_cache[old_name]
        
        # Load new organize into cache
        try:
            vector_db_cache[new_name] = VectorDatabaseManager(new_name)
        except:
            pass
        
        return {
            "status": "success",
            "message": f"Successfully renamed organize from '{old_name}' to '{new_name}'"
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/organize/{organize_name}")
async def delete_organize(organize_name: str):
    """ลบ organize"""
    try:
        data_manager = FaceDataManager()
        
        # Check if exists
        if organize_name not in data_manager.list_organizes():
            raise HTTPException(status_code=404, detail=f"Organize '{organize_name}' not found")
        
        # Remove from cache
        if organize_name in vector_db_cache:
            del vector_db_cache[organize_name]
        
        # Delete directory
        data_manager.remove_organize(organize_name)
        
        return {
            "status": "success",
            "message": f"Successfully deleted organize '{organize_name}'"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/organize/{organize_name}/member/{old_name}/rename")
async def rename_member(organize_name: str, old_name: str, new_name: str):
    """เปลี่ยนชื่อสมาชิก"""
    try:
        data_manager = FaceDataManager()
        
        # Check organize exists
        if organize_name not in data_manager.list_organizes():
            raise HTTPException(status_code=404, detail=f"Organize '{organize_name}' not found")
        
        # Rename person directory
        data_manager.rename_person(organize_name, old_name, new_name)
        
        return {
            "status": "success",
            "message": f"Successfully renamed member from '{old_name}' to '{new_name}'. Don't forget to rebuild vectors."
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/organize/{organize_name}/member/{person_name}")
async def delete_member(organize_name: str, person_name: str):
    """ลบสมาชิก"""
    try:
        data_manager = FaceDataManager()
        
        # Check organize exists
        if organize_name not in data_manager.list_organizes():
            raise HTTPException(status_code=404, detail=f"Organize '{organize_name}' not found")
        
        # Check member exists
        if person_name not in data_manager.list_persons(organize_name):
            raise HTTPException(status_code=404, detail=f"Member '{person_name}' not found")
        
        # Delete person directory
        data_manager.remove_person(organize_name, person_name)
        
        return {
            "status": "success",
            "message": f"Successfully deleted member '{person_name}'. Don't forget to rebuild vectors."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)