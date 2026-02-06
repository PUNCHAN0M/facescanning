import os
from app.core.vector import Vector
from app.configs.core_config import CoreConfig
from app.core.dummy_embedding import DummyEmbeddings


class VectorService:

    def __init__(self, admin_id: str, dummy_embeddings: DummyEmbeddings):
        self.core_config = CoreConfig(admin_id)
        self.dummy_embeddings = dummy_embeddings
        self.vector = Vector(self.core_config, self.dummy_embeddings)

    async def build_empty_vectors(self) -> dict:
        try:
            result = await self.vector.build_empty_vectors()
            return result
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def delete_vectors(self) -> dict:
        if not os.path.exists(self.core_config.vector_path):
            return {
                "success": False,
                "error": "Vector file does not exist.",
            }
        try:
            result = await self.vector.delete_vectors()
            return result
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def update_person_vectors(self, person_id: str) -> dict:
        if not os.path.exists(self.core_config.face_images_path + "/" + person_id):
            return {"success": False, "error": "Update path does not exist."}
        try:
            result = self.vector.update_person_vectors(person_id.strip())
            return await result
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def delete_person_vectors(self, person_id: str) -> dict:
        if not os.path.exists(self.core_config.face_images_path + "/" + person_id):
            return {"success": False, "error": "Delete path does not exist."}
        try:
            result = await self.vector.delete_person_vectors(person_id.strip())
            return result
        except Exception as e:
            return {"success": False, "error": str(e)}

    """
    ========== ADMIN ONLY ===========
    """

    async def build_vectors(self) -> dict:
        if not os.path.exists(self.core_config.vector_path):
            return {"success": False, "error": "Vector path does not exist."}
        try:
            result = await self.vector.build_vectors()
            return result
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def get_people_vectors(self) -> dict:
        if not os.path.exists(self.core_config.face_images_path):
            return {"success": False, "error": "Data path does not exist."}
        try:
            result = await self.vector.get_people_vectors()
            return result
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def get_person_vectors(self, person_id: str) -> dict:
        if not os.path.exists(self.core_config.face_images_path + "/" + person_id):
            return {"success": False, "error": "Get path does not exist."}
        try:
            result = await self.vector.get_person_vectors(person_id.strip())
            return result
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def get_total_vectors(self) -> dict:
        if not os.path.exists(self.core_config.face_images_path):
            return {"success": False, "error": "Data path does not exist."}
        try:
            result = await self.vector.get_total_vectors()
            return {"success": True, "total": result}
        except Exception as e:
            return {"success": False, "error": str(e)}
