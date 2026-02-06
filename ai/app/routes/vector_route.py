from fastapi import APIRouter

from app.core.dummy_embedding import dummy_embeddings
from app.services.vector_service import VectorService

router = APIRouter(prefix="/vectors", tags=["VECTORS"])

# TODO: รับ admin_id จาก get_current_admin_id (access_token)


@router.post("/{admin_id}/build/empty")
async def build_empty_vectors(admin_id: str):
    vector_service = VectorService(admin_id, dummy_embeddings)
    return await vector_service.build_empty_vectors()


@router.delete("/{admin_id}")
async def delete_vectors(admin_id: str):
    vector_service = VectorService(admin_id, dummy_embeddings)
    return await vector_service.delete_vectors()


@router.put("/{admin_id}/person/{person_id}")
async def update_person_vectors(admin_id: str, person_id: str):
    vector_service = VectorService(admin_id, dummy_embeddings)
    return await vector_service.update_person_vectors(person_id)


@router.delete("/{admin_id}/person/{person_id}")
async def delete_person_vectors(admin_id: str, person_id: str):
    vector_service = VectorService(admin_id, dummy_embeddings)
    return await vector_service.delete_person_vectors(person_id)


"""
========== ADMIN ONLY ===========
"""


@router.post("/{admin_id}/build")
async def build_vectors(admin_id: str):
    vector_service = VectorService(admin_id, dummy_embeddings)
    return await vector_service.build_vectors()


@router.get("/{admin_id}/people")
async def get_people_vectors(admin_id: str):
    vector_service = VectorService(admin_id, dummy_embeddings)
    return await vector_service.get_people_vectors()


@router.get("/{admin_id}/person/{person_id}")
async def get_person_vectors(admin_id: str, person_id: str):
    vector_service = VectorService(admin_id, dummy_embeddings)
    return await vector_service.get_person_vectors(person_id)


@router.get("/{admin_id}/total")
async def get_total_vectors(admin_id: str):
    vector_service = VectorService(admin_id, dummy_embeddings)
    return await vector_service.get_total_vectors()
