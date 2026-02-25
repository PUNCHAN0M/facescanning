"""
Controller Layer - FastAPI route handlers.

Routers:
- organize_router : organize CRUD + vector rebuild
- member_router   : member CRUD + image management
- recognition_router : embedding search + image recognition
"""

import json
from pathlib import Path
from typing import List

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

from repository import OrganizeRepository
from service import (
    EmbeddingService,
    FaceRecognitionService,
    OrganizeService,
    VectorDatabaseService,
)

# ───────── Dependency Wiring ─────────

_organize_repository = OrganizeRepository()
_embedding_service = EmbeddingService()
_vector_database_service = VectorDatabaseService(_organize_repository, _embedding_service)
_organize_service = OrganizeService(_organize_repository, _vector_database_service)
_face_recognition_service = FaceRecognitionService(_embedding_service, _vector_database_service)

# ═══════════════════════════════════════════════════════
#  Request / Response Models
# ═══════════════════════════════════════════════════════

class VectorSearchRequest(BaseModel):
    embedding: List[float]
    k: int = 1


# ═══════════════════════════════════════════════════════
#  Organize Router
# ═══════════════════════════════════════════════════════

organize_router = APIRouter(prefix="/organize", tags=["organize"])


@organize_router.get("s")
async def list_all_organizes():
    """List all organizes."""
    return {"organizes": _organize_service.list_all_organizes()}


@organize_router.post("/create")
async def create_organize(organize_name: str = Query(...)):
    """Create a new organize."""
    try:
        _organize_service.create_organize(organize_name)
        return {"message": f"Successfully created organize '{organize_name}'"}
    except FileExistsError as error:
        raise HTTPException(status_code=409, detail=str(error))


@organize_router.get("/{organize_name}/details")
async def get_organize_details(organize_name: str):
    """Get organize details with member info."""
    try:
        return _organize_service.get_organize_details(organize_name)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error))


@organize_router.put("/{organize_name}/rename")
async def rename_organize(organize_name: str, new_name: str = Query(...)):
    """Rename an organize."""
    try:
        _organize_service.rename_organize(organize_name, new_name)
        return {"message": f"Successfully renamed to '{new_name}'"}
    except (FileNotFoundError, FileExistsError) as error:
        raise HTTPException(status_code=400, detail=str(error))


@organize_router.delete("/{organize_name}")
async def delete_organize(organize_name: str):
    """Delete an organize and all its data."""
    _organize_service.delete_organize(organize_name)
    return {"message": f"Successfully deleted organize '{organize_name}'"}


@organize_router.post("/{organize_name}/rebuild")
async def rebuild_organize_vectors(
    organize_name: str,
    model: str = Query(None, description="Embedding model key (w600k_r50, w600k_mbf, r100)"),
    stream: bool = Query(False, description="Stream progress via SSE"),
    source: str = Query(None, description="'face-vector' to rebuild from pre-computed vectors"),
):
    """Rebuild vector database for an organize using specified model or pre-computed face-vectors."""
    if source == "face-vector":
        try:
            result = _organize_service.rebuild_from_face_vectors(organize_name)
            return result
        except FileNotFoundError as error:
            raise HTTPException(status_code=404, detail=str(error))
    if stream:
        return _rebuild_stream_response(organize_name, model)
    try:
        result = _organize_service.rebuild_vectors(organize_name, model_key=model)
        return result
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error))


def _rebuild_stream_response(organize_name: str, model_key: str | None):
    """Return a StreamingResponse that sends SSE progress events."""

    def event_generator():
        try:
            for event in _organize_service.rebuild_vectors_stream(
                organize_name, model_key=model_key
            ):
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
        except FileNotFoundError as error:
            yield f"data: {json.dumps({'type': 'error', 'message': str(error)})}\n\n"
        except Exception as error:
            yield f"data: {json.dumps({'type': 'error', 'message': str(error)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ═══════════════════════════════════════════════════════
#  Member Router
# ═══════════════════════════════════════════════════════

member_router = APIRouter(
    prefix="/organize/{organize_name}/member", tags=["member"]
)


@member_router.post("")
async def create_member(organize_name: str, person_name: str = Query(...)):
    """Add a new member to an organize."""
    try:
        _organize_service.create_member(organize_name, person_name)
        return {"message": f"Successfully created member '{person_name}'"}
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error))
    except FileExistsError as error:
        raise HTTPException(status_code=409, detail=str(error))


@member_router.put("/{person_name}/rename")
async def rename_member(
    organize_name: str, person_name: str, new_name: str = Query(...)
):
    """Rename a member."""
    try:
        _organize_service.rename_member(organize_name, person_name, new_name)
        return {
            "message": f"Successfully renamed to '{new_name}'. "
            "Rebuild vectors to update metadata."
        }
    except (FileNotFoundError, FileExistsError) as error:
        raise HTTPException(status_code=400, detail=str(error))


@member_router.delete("/{person_name}")
async def delete_member(organize_name: str, person_name: str):
    """Delete a member and all their data."""
    _organize_service.delete_member(organize_name, person_name)
    return {"message": f"Successfully deleted member '{person_name}'"}


@member_router.get("/{person_name}/images")
async def list_member_images(organize_name: str, person_name: str):
    """List all images for a member."""
    images = _organize_service.list_member_images(organize_name, person_name)
    return {"images": images}


@member_router.get("/{person_name}/image/{filename}")
async def get_member_image(organize_name: str, person_name: str, filename: str):
    """Download a member's image."""
    image_path = _organize_service.get_image_path(
        organize_name, person_name, filename
    )
    if image_path is None:
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(str(image_path))


@member_router.post("/{person_name}/upload")
async def upload_member_image(
    organize_name: str, person_name: str, file: UploadFile
):
    """Upload an image for a member."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="Empty image file")
    try:
        data = await file.read()
        _organize_service.upload_member_image(
            organize_name, person_name, file.filename, data
        )
        return {"message": "Successfully uploaded image"}
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error))


@member_router.post("/{person_name}/upload-with-vector")
async def upload_member_image_with_vector(
    organize_name: str,
    person_name: str,
    file: UploadFile = File(..., description="Face image file"),
    vector: str = Form(..., description="JSON array of 512 float values (face embedding)"),
):
    """Upload a face image together with its pre-computed embedding vector."""
    import numpy as np

    if not file.filename:
        raise HTTPException(status_code=400, detail="Empty image file")

    # Parse vector from JSON string
    try:
        vector_list = json.loads(vector)
        if not isinstance(vector_list, list) or len(vector_list) != 512:
            raise HTTPException(
                status_code=400,
                detail=f"Vector must be a JSON array of 512 floats, got {len(vector_list) if isinstance(vector_list, list) else type(vector_list).__name__}",
            )
        face_vector = np.array(vector_list, dtype=np.float32)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON in vector field")

    try:
        image_data = await file.read()
        result = _organize_service.upload_member_image_with_vector(
            organize_name, person_name, file.filename, image_data, face_vector
        )
        return {"message": "Successfully uploaded image with vector", **result}
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error))


@member_router.delete("/{person_name}/image/{filename}")
async def delete_member_image(
    organize_name: str, person_name: str, filename: str
):
    """Delete a member's image."""
    try:
        _organize_service.delete_member_image(
            organize_name, person_name, filename
        )
        return {"message": f"Successfully deleted image '{filename}'"}
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error))


# ═══════════════════════════════════════════════════════
#  Recognition Router
# ═══════════════════════════════════════════════════════

recognition_router = APIRouter(tags=["recognition"])


@recognition_router.post("/organize/{organize_name}/search_vector")
async def search_by_vector(organize_name: str, request: VectorSearchRequest):
    """Search FAISS by a client-provided embedding vector (512-d)."""
    import numpy as np

    embedding = np.array(request.embedding, dtype=np.float32)

    if embedding.ndim != 1:
        raise HTTPException(status_code=400, detail="Embedding must be a 1D array")
    if embedding.shape[0] != 512:
        raise HTTPException(
            status_code=400,
            detail=f"Embedding must be 512-d, got {embedding.shape[0]}",
        )

    return _face_recognition_service.search_by_embedding_vector(
        organize_name, embedding, request.k
    )


@recognition_router.post("/organize/{organize_name}/upload")
async def upload_image_for_recognition(organize_name: str, file: UploadFile):
    """Upload an image for face recognition."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="Empty image file")
    image_bytes = await file.read()
    return _face_recognition_service.recognize_face_from_image(
        organize_name, image_bytes
    )


@recognition_router.get("/organize/{organize_name}/persons")
async def list_persons(organize_name: str):
    """List all persons in a vector database."""
    vector_repository = _vector_database_service.get_vector_repository(
        organize_name
    )
    if vector_repository is None:
        raise HTTPException(
            status_code=404, detail=f"Organize '{organize_name}' not found"
        )
    return {"persons": list(vector_repository.count_vectors_per_person().keys())}
