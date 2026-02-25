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
from typing import Callable, Dict, Generator, List, Optional, Tuple

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
    """Manages ArcFace embedding models. Supports multiple model keys."""

    def __init__(self, model_key: Optional[str] = None):
        key = model_key or ArcFaceEmbedder.DEFAULT_MODEL
        logger.info(f"Loading ArcFace embedding model ({key})...")
        self._embedder = ArcFaceEmbedder.get_instance(model_key=key)
        self._model_key = key
        logger.info(f"ArcFace embedding model loaded ({key})")

    def get_embedder_for_model(self, model_key: str) -> ArcFaceEmbedder:
        """Get (or lazily create) an embedder for a specific model key."""
        return ArcFaceEmbedder.get_instance(model_key=model_key)

    def extract_embedding_from_image(
        self, image: np.ndarray, model_key: Optional[str] = None
    ) -> Optional[np.ndarray]:
        """Extract embedding from a BGR numpy image using specified model."""
        embedder = self.get_embedder_for_model(model_key) if model_key else self._embedder
        return embedder.get_embedding(image)

    def extract_embedding_from_bytes(self, image_bytes: bytes, model_key: Optional[str] = None) -> Optional[np.ndarray]:
        """Extract embedding from raw image bytes."""
        import cv2
        image_array = np.frombuffer(image_bytes, dtype=np.uint8)
        image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
        if image is None:
            return None
        embedder = self.get_embedder_for_model(model_key) if model_key else self._embedder
        return embedder.get_embedding(image)

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

    def rebuild_vectors_for_organize(
        self,
        organize_name: str,
        model_key: Optional[str] = None,
        on_progress: Optional[Callable[[int, int, str], None]] = None,
    ) -> int:
        """
        Re-embed all face images and rebuild the FAISS index.
        Returns total vector count.

        Args:
            organize_name: Name of the organize to rebuild.
            model_key: Optional model key for embedding extraction.
            on_progress: Optional callback(current, total, person_name) for progress updates.

        After rebuild the in-memory cache is refreshed so subsequent
        searches immediately use the new index — no server restart needed.
        """
        all_face_images = self._organize_repository.load_all_face_images_for_organize(
            organize_name
        )

        # Materialise list so we know total count for progress
        all_face_images = list(all_face_images)
        total = len(all_face_images)

        embeddings: List[Tuple[str, np.ndarray]] = []
        skipped = 0
        for idx, (person_name, image) in enumerate(all_face_images):
            # Report progress
            if on_progress:
                on_progress(idx, total, person_name)

            # ★ Detect + align face first (matches client live-scan pipeline)
            aligned_face = self._face_processing.detect_and_align_face(image)
            if aligned_face is None:
                logger.warning(
                    f"No face detected in image for '{person_name}', skipping"
                )
                skipped += 1
                continue
            embedding = self._embedding_service.extract_embedding_from_image(aligned_face, model_key=model_key)
            if embedding is not None:
                embeddings.append((person_name, embedding))

        if skipped > 0:
            logger.warning(
                f"Skipped {skipped} image(s) with no detectable face "
                f"during rebuild of '{organize_name}'"
            )

        # Report building index phase
        if on_progress:
            on_progress(total, total, "__building_index__")

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

    def rebuild_vectors_from_face_vectors(
        self,
        organize_name: str,
        on_progress: Optional[Callable[[int, int, str], None]] = None,
    ) -> int:
        """
        Rebuild FAISS index using pre-computed face vectors from face-vector/ directory.
        No model inference needed — vectors were computed by the client.
        Returns total vector count.
        """
        all_face_vectors = self._organize_repository.load_all_face_vectors_for_organize(
            organize_name
        )
        total = len(all_face_vectors)

        embeddings: List[Tuple[str, np.ndarray]] = []
        for idx, (person_name, vector) in enumerate(all_face_vectors):
            if on_progress:
                on_progress(idx, total, person_name)
            # Ensure vector is 512-d float32
            vec = vector.flatten().astype(np.float32)
            if vec.shape[0] == 512:
                embeddings.append((person_name, vec))
            else:
                logger.warning(
                    f"Skipping vector for '{person_name}': expected 512-d, got {vec.shape[0]}"
                )

        if on_progress:
            on_progress(total, total, "__building_index__")

        vector_repository = self.get_vector_repository(organize_name)
        if vector_repository is None:
            vector_path = self._organize_repository._get_vector_path(organize_name)
            vector_path.mkdir(parents=True, exist_ok=True)
            vector_repository = VectorRepository(vector_path)
            self._cache[organize_name] = vector_repository

        vector_repository.reset_and_rebuild(embeddings)
        vector_repository.reload()

        total_vectors = vector_repository.total_vectors()
        logger.info(
            f"Rebuilt vectors from face-vectors for '{organize_name}': "
            f"{total_vectors} vectors in memory"
        )
        return total_vectors


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

    def rebuild_vectors(self, organize_name: str, model_key: Optional[str] = None) -> dict:
        if not self._organize_repository.organize_exists(organize_name):
            raise FileNotFoundError(f"Organize '{organize_name}' not found")
        total = self._vector_service.rebuild_vectors_for_organize(organize_name, model_key=model_key)
        return {
            "message": f"Successfully rebuilt vectors for '{organize_name}'",
            "total_vectors": total,
            "model": model_key or ArcFaceEmbedder.DEFAULT_MODEL,
        }

    def rebuild_from_face_vectors(self, organize_name: str) -> dict:
        """Rebuild FAISS index from pre-computed face-vector/ directory."""
        if not self._organize_repository.organize_exists(organize_name):
            raise FileNotFoundError(f"Organize '{organize_name}' not found")
        total = self._vector_service.rebuild_vectors_from_face_vectors(organize_name)
        return {
            "message": f"Successfully rebuilt vectors from face-vectors for '{organize_name}'",
            "total_vectors": total,
            "source": "face-vector",
        }

    def rebuild_vectors_stream(
        self, organize_name: str, model_key: Optional[str] = None
    ) -> Generator[dict, None, None]:
        """
        Rebuild vectors with progress reporting via generator.
        Yields dicts: {"type": "progress", "current", "total", "person"}
        Final yield:  {"type": "done", "total_vectors", "model", "message"}
        """
        if not self._organize_repository.organize_exists(organize_name):
            raise FileNotFoundError(f"Organize '{organize_name}' not found")

        progress_events: List[dict] = []

        def on_progress(current: int, total: int, person: str):
            progress_events.append({
                "type": "progress",
                "current": current,
                "total": total,
                "person": person,
            })

        # Run rebuild in a thread-safe manner with progress callback
        # We use a different approach: generator-based with callback
        all_face_images = list(
            self._vector_service._organize_repository.load_all_face_images_for_organize(
                organize_name
            )
        )
        total_images = len(all_face_images)
        resolved_model = model_key or ArcFaceEmbedder.DEFAULT_MODEL

        # Yield initial event
        yield {
            "type": "start",
            "total": total_images,
            "model": resolved_model,
        }

        embeddings: List[Tuple[str, np.ndarray]] = []
        skipped = 0

        for idx, (person_name, image) in enumerate(all_face_images):
            # Yield progress
            yield {
                "type": "progress",
                "current": idx + 1,
                "total": total_images,
                "person": person_name,
            }

            aligned_face = self._vector_service._face_processing.detect_and_align_face(image)
            if aligned_face is None:
                skipped += 1
                continue
            embedding = self._vector_service._embedding_service.extract_embedding_from_image(
                aligned_face, model_key=model_key
            )
            if embedding is not None:
                embeddings.append((person_name, embedding))

        # Build index phase
        yield {"type": "progress", "current": total_images, "total": total_images, "person": "กำลังสร้าง index..."}

        vector_repository = self._vector_service.get_vector_repository(organize_name)
        if vector_repository is None:
            vector_path = self._vector_service._organize_repository._get_vector_path(organize_name)
            vector_path.mkdir(parents=True, exist_ok=True)
            vector_repository = VectorRepository(vector_path)
            self._vector_service._cache[organize_name] = vector_repository

        vector_repository.reset_and_rebuild(embeddings)
        vector_repository.reload()

        total_vectors = vector_repository.total_vectors()
        yield {
            "type": "done",
            "total_vectors": total_vectors,
            "skipped": skipped,
            "model": resolved_model,
            "message": f"Successfully rebuilt vectors for '{organize_name}'",
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

    def upload_member_image_with_vector(
        self,
        organize_name: str,
        person_name: str,
        filename: str,
        image_data: bytes,
        face_vector: np.ndarray,
    ) -> dict:
        """Upload a face image and its pre-computed vector from the client."""
        if not self._organize_repository.organize_exists(organize_name):
            raise FileNotFoundError(f"Organize '{organize_name}' not found")
        if not self._organize_repository.person_exists(organize_name, person_name):
            raise FileNotFoundError(f"Member '{person_name}' not found")

        # Save image
        image_path = self._organize_repository.save_image(
            organize_name, person_name, filename, image_data
        )

        # Save vector as .npy (strip image extension, add .npy)
        vector_filename = Path(filename).stem + ".npy"
        vector_path = self._organize_repository.save_face_vector(
            organize_name, person_name, vector_filename, face_vector
        )

        return {
            "image_path": str(image_path),
            "vector_path": str(vector_path),
        }

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

    def extract_vector_from_image(
        self, image_bytes: bytes, model_key: Optional[str] = None
    ) -> Optional[np.ndarray]:
        """
        Extract a 512-d L2-normalised face embedding from raw image bytes.

        Pipeline: image bytes → decode → detect+align face → ArcFace embedding
        Returns the embedding vector as a float32 ndarray, or None if no face
        is detected / the embedding cannot be computed.

        This is the server-side counterpart of the client's
        ImageToVectorService.extractVector().  Use the result to store
        pre-computed vectors in the face-vector directory via
        OrganizeService.upload_member_image_with_vector().
        """
        import cv2
        image_array = np.frombuffer(image_bytes, dtype=np.uint8)
        image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
        if image is None:
            logger.warning("[extract_vector_from_image] Cannot decode image bytes")
            return None

        aligned_face = self._face_processing.detect_and_align_face(image)
        if aligned_face is None:
            logger.warning("[extract_vector_from_image] No face detected in image")
            return None

        embedding = self._embedding_service.extract_embedding_from_image(
            aligned_face, model_key=model_key
        )
        if embedding is None:
            logger.warning("[extract_vector_from_image] Embedding extraction failed")
        return embedding

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
