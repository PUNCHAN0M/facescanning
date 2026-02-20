"""
Service Layer - Business logic for face recognition system.

Services:
- EmbeddingService: ArcFace model lifecycle and embedding extraction
- VectorDatabaseService: FAISS cache management, search, rebuild (auto-reload)
- OrganizeService: Organize/member CRUD orchestration
- FaceRecognitionService: Embedding search + confidence scoring
"""

import logging
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np

from arcfacecustom import ArcFaceEmbedder
from detection_tracker import DetectionTracker
from face_processing import FaceProcessingService
from repository import OrganizeRepository, VectorRepository

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════
#  EmbeddingService
# ═══════════════════════════════════════════════════════

class EmbeddingService:
    """Manages the ArcFace embedding model."""

    def __init__(self):
        logger.info("Loading ArcFace embedding model...")
        self._embedder = ArcFaceEmbedder()
        logger.info("ArcFace embedding model loaded")

    def extract_embedding_from_image(self, image: np.ndarray) -> Optional[np.ndarray]:
        """Extract embedding from a BGR numpy image."""
        return self._embedder.get_embedding(image)

    def extract_embedding_from_bytes(self, image_bytes: bytes) -> Optional[np.ndarray]:
        """Extract embedding from raw image bytes."""
        import cv2
        image_array = np.frombuffer(image_bytes, dtype=np.uint8)
        image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
        if image is None:
            return None
        return self._embedder.get_embedding(image)

    @property
    def embedder(self) -> ArcFaceEmbedder:
        return self._embedder


# ═══════════════════════════════════════════════════════
#  VectorDatabaseService
# ═══════════════════════════════════════════════════════

class VectorDatabaseService:
    """
    Manages FAISS vector database cache and search operations.

    Keeps a dict of VectorRepository instances keyed by organize_name.
    After rebuild, the cache is refreshed automatically so searches
    use the updated index without a server restart.
    """

    def __init__(
        self,
        organize_repository: OrganizeRepository,
        embedding_service: EmbeddingService,
        face_processing_service: Optional[FaceProcessingService] = None,
    ):
        self._organize_repository = organize_repository
        self._embedding_service = embedding_service
        self._face_processing = face_processing_service or FaceProcessingService.get_instance()
        self._cache: Dict[str, VectorRepository] = {}
        self._preload_all_databases()

    def _preload_all_databases(self) -> None:
        organizes = self._organize_repository.list_all_organizes()
        logger.info(f"Pre-loading vector databases... {len(organizes)} organize(s)")
        for name in organizes:
            self.get_vector_repository(name)

    def get_vector_repository(self, organize_name: str) -> Optional[VectorRepository]:
        """Get (or lazily load) the VectorRepository for an organize."""
        if organize_name in self._cache:
            return self._cache[organize_name]

        vector_path = self._organize_repository._get_vector_path(organize_name)
        if not vector_path.exists():
            return None

        repo = VectorRepository(vector_path)
        self._cache[organize_name] = repo
        return repo

    def remove_from_cache(self, organize_name: str) -> None:
        self._cache.pop(organize_name, None)

    def search_by_embedding(
        self, organize_name: str, embedding: np.ndarray, top_k: int = 1
    ) -> List[Tuple[str, float]]:
        """Search for nearest match. Returns list of (person, similarity)."""
        vector_repository = self.get_vector_repository(organize_name)
        if vector_repository is None:
            return []
        return vector_repository.search_nearest(embedding, top_k)

    def rebuild_vectors_for_organize(self, organize_name: str) -> int:
        """
        Re-embed all face images and rebuild the FAISS index.
        Returns total vector count.

        After rebuild the in-memory cache is refreshed so subsequent
        searches immediately use the new index — no server restart needed.
        """
        all_face_images = self._organize_repository.load_all_face_images_for_organize(
            organize_name
        )

        embeddings: List[Tuple[str, np.ndarray]] = []
        skipped = 0
        for person_name, image in all_face_images:
            # ★ Detect + align face first (matches client live-scan pipeline)
            aligned_face = self._face_processing.detect_and_align_face(image)
            if aligned_face is None:
                logger.warning(
                    f"No face detected in image for '{person_name}', skipping"
                )
                skipped += 1
                continue
            embedding = self._embedding_service.extract_embedding_from_image(aligned_face)
            if embedding is not None:
                embeddings.append((person_name, embedding))

        if skipped > 0:
            logger.warning(
                f"Skipped {skipped} image(s) with no detectable face "
                f"during rebuild of '{organize_name}'"
            )

        vector_repository = self.get_vector_repository(organize_name)
        if vector_repository is None:
            # Create the vector directory and repository
            vector_path = self._organize_repository._get_vector_path(organize_name)
            vector_path.mkdir(parents=True, exist_ok=True)
            vector_repository = VectorRepository(vector_path)
            self._cache[organize_name] = vector_repository

        vector_repository.reset_and_rebuild(embeddings)

        # ★ Reload the cache entry so in-memory index matches disk
        vector_repository.reload()

        total_vectors = vector_repository.total_vectors()
        logger.info(
            f"Rebuilt vectors for '{organize_name}': "
            f"{total_vectors} vectors in memory"
        )
        return total_vectors

    def create_empty_database(self, organize_name: str) -> None:
        vector_path = self._organize_repository._get_vector_path(organize_name)
        vector_path.mkdir(parents=True, exist_ok=True)
        repo = VectorRepository(vector_path)
        repo.create_empty_index()
        self._cache[organize_name] = repo


# ═══════════════════════════════════════════════════════
#  OrganizeService
# ═══════════════════════════════════════════════════════

class OrganizeService:
    """Business logic for organize and member management."""

    def __init__(
        self,
        organize_repository: OrganizeRepository,
        vector_database_service: VectorDatabaseService,
    ):
        self._organize_repository = organize_repository
        self._vector_service = vector_database_service

    # ───────── Organize ─────────

    def list_all_organizes(self) -> List[str]:
        return self._organize_repository.list_all_organizes()

    def get_organize_details(self, organize_name: str) -> dict:
        if not self._organize_repository.organize_exists(organize_name):
            raise FileNotFoundError(f"Organize '{organize_name}' not found")

        persons = self._organize_repository.list_persons_in_organize(organize_name)
        vector_repo = self._vector_service.get_vector_repository(organize_name)
        vector_counts = vector_repo.count_vectors_per_person() if vector_repo else {}

        members = []
        for person_name in persons:
            members.append({
                "person_name": person_name,
                "image_count": self._organize_repository.count_person_images(
                    organize_name, person_name
                ),
                "vector_count": vector_counts.get(person_name, 0),
            })

        return {
            "organize": organize_name,
            "members": members,
            "stats": {"total_members": len(members)},
        }

    def create_organize(self, organize_name: str) -> None:
        if self._organize_repository.organize_exists(organize_name):
            raise FileExistsError(f"Organize '{organize_name}' already exists")
        self._organize_repository.create_organize(organize_name)

    def rename_organize(self, old_name: str, new_name: str) -> None:
        self._organize_repository.rename_organize(old_name, new_name)
        self._vector_service.remove_from_cache(old_name)

    def delete_organize(self, organize_name: str) -> None:
        self._organize_repository.delete_organize(organize_name)
        self._vector_service.remove_from_cache(organize_name)

    def rebuild_vectors(self, organize_name: str) -> dict:
        if not self._organize_repository.organize_exists(organize_name):
            raise FileNotFoundError(f"Organize '{organize_name}' not found")
        total = self._vector_service.rebuild_vectors_for_organize(organize_name)
        return {
            "message": f"Successfully rebuilt vectors for '{organize_name}'",
            "total_vectors": total,
        }

    # ───────── Member ─────────

    def create_member(self, organize_name: str, person_name: str) -> None:
        if not self._organize_repository.organize_exists(organize_name):
            raise FileNotFoundError(f"Organize '{organize_name}' not found")
        if self._organize_repository.person_exists(organize_name, person_name):
            raise FileExistsError(f"Member '{person_name}' already exists")
        self._organize_repository.create_person(organize_name, person_name)

    def rename_member(
        self, organize_name: str, old_name: str, new_name: str
    ) -> None:
        self._organize_repository.rename_person(organize_name, old_name, new_name)

    def delete_member(self, organize_name: str, person_name: str) -> None:
        self._organize_repository.delete_person(organize_name, person_name)

    def list_member_images(
        self, organize_name: str, person_name: str
    ) -> List[str]:
        return self._organize_repository.list_person_images(
            organize_name, person_name
        )

    def get_image_path(
        self, organize_name: str, person_name: str, filename: str
    ) -> Optional[Path]:
        return self._organize_repository.get_image_path(
            organize_name, person_name, filename
        )

    def upload_member_image(
        self, organize_name: str, person_name: str, filename: str, data: bytes
    ) -> Path:
        if not self._organize_repository.organize_exists(organize_name):
            raise FileNotFoundError(f"Organize '{organize_name}' not found")
        if not self._organize_repository.person_exists(organize_name, person_name):
            raise FileNotFoundError(f"Member '{person_name}' not found")
        return self._organize_repository.save_image(
            organize_name, person_name, filename, data
        )

    def delete_member_image(
        self, organize_name: str, person_name: str, filename: str
    ) -> None:
        if not self._organize_repository.image_exists(
            organize_name, person_name, filename
        ):
            raise FileNotFoundError(f"Image '{filename}' not found")
        self._organize_repository.delete_image(
            organize_name, person_name, filename
        )


# ═══════════════════════════════════════════════════════
#  FaceRecognitionService
# ═══════════════════════════════════════════════════════

class FaceRecognitionService:
    """
    Orchestrates face recognition: embedding extraction + vector search.

    Confidence is returned as a percentage 0-100:
        confidence = max(0, cosine_similarity) * 100
    """

    def __init__(
        self,
        embedding_service: EmbeddingService,
        vector_database_service: VectorDatabaseService,
        face_processing_service: Optional[FaceProcessingService] = None,
    ):
        self._embedding_service = embedding_service
        self._vector_database_service = vector_database_service
        self._face_processing = face_processing_service or FaceProcessingService.get_instance()

    @staticmethod
    def _similarity_to_confidence_percent(similarity: float) -> float:
        """
        Convert cosine similarity [-1, 1] to confidence percentage [0, 100].

        For L2-normalized embeddings searched with IndexFlatIP,
        the dot-product equals cosine similarity.
        """
        return round(max(0.0, similarity) * 100, 2)

    def search_by_embedding_vector(
        self, organize_name: str, embedding: np.ndarray, top_k: int = 1
    ) -> dict:
        """
        Search FAISS by client-provided embedding.

        Returns dict with person, similarity (raw), confidence (%).
        """
        results = self._vector_database_service.search_by_embedding(
            organize_name, embedding, top_k
        )

        if not results:
            return {"status": "no_match", "person": None, "similarity": None, "confidence": None}

        person, similarity = results[0]
        confidence = self._similarity_to_confidence_percent(similarity)

        return {
            "status": "success",
            "person": person,
            "similarity": round(float(similarity), 6),
            "confidence": confidence,
        }

    def recognize_face_from_image(
        self, organize_name: str, image_bytes: bytes
    ) -> dict:
        """Full pipeline: image bytes → detect+align → embedding → search."""
        import cv2
        image_array = np.frombuffer(image_bytes, dtype=np.uint8)
        image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
        if image is None:
            return {
                "status": "no_face",
                "person": None,
                "similarity": None,
                "confidence": None,
                "message": "Cannot decode image",
            }
        # Detect and align face (matches client pipeline)
        aligned_face = self._face_processing.detect_and_align_face(image)
        if aligned_face is None:
            return {
                "status": "no_face",
                "person": None,
                "similarity": None,
                "confidence": None,
                "message": "No face detected in image",
            }
        embedding = self._embedding_service.extract_embedding_from_image(aligned_face)
        if embedding is None:
            return {
                "status": "no_face",
                "person": None,
                "similarity": None,
                "confidence": None,
                "message": "Cannot extract face embedding",
            }
        return self.search_by_embedding_vector(organize_name, embedding)
