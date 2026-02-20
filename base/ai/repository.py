"""
Repository Layer - Data access for file system and FAISS vector database.

Handles:
- File system operations (organize directories, member images)
- FAISS vector database (index storage, search, rebuild)
"""

import logging
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np

logger = logging.getLogger(__name__)

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
EMBEDDING_DIMENSION = 512


class OrganizeRepository:
    """File system operations for organizes and members."""

    def __init__(self, base_data_directory: str = "./data"):
        self.base_directory = Path(base_data_directory)
        self.base_directory.mkdir(parents=True, exist_ok=True)

    # ───────── Path Helpers ─────────

    def _get_organize_path(self, organize_name: str) -> Path:
        return self.base_directory / organize_name

    def _get_faces_path(self, organize_name: str) -> Path:
        return self._get_organize_path(organize_name) / "faces"

    def _get_vector_path(self, organize_name: str) -> Path:
        return self._get_organize_path(organize_name) / "vector"

    def _get_person_path(self, organize_name: str, person_name: str) -> Path:
        return self._get_faces_path(organize_name) / person_name

    # ───────── Organize CRUD ─────────

    def list_all_organizes(self) -> List[str]:
        if not self.base_directory.exists():
            return []
        return sorted(
            entry.name
            for entry in self.base_directory.iterdir()
            if entry.is_dir()
        )

    def organize_exists(self, organize_name: str) -> bool:
        return self._get_organize_path(organize_name).is_dir()

    def create_organize(self, organize_name: str) -> None:
        faces_path = self._get_faces_path(organize_name)
        vector_path = self._get_vector_path(organize_name)
        faces_path.mkdir(parents=True, exist_ok=True)
        vector_path.mkdir(parents=True, exist_ok=True)

    def rename_organize(self, old_name: str, new_name: str) -> None:
        old_path = self._get_organize_path(old_name)
        new_path = self._get_organize_path(new_name)
        if not old_path.exists():
            raise FileNotFoundError(f"Organize '{old_name}' not found")
        if new_path.exists():
            raise FileExistsError(f"Organize '{new_name}' already exists")
        old_path.rename(new_path)

    def delete_organize(self, organize_name: str) -> None:
        import shutil
        organize_path = self._get_organize_path(organize_name)
        if organize_path.exists():
            shutil.rmtree(organize_path)

    # ───────── Person CRUD ─────────

    def list_persons_in_organize(self, organize_name: str) -> List[str]:
        faces_path = self._get_faces_path(organize_name)
        if not faces_path.exists():
            return []
        return sorted(
            entry.name
            for entry in faces_path.iterdir()
            if entry.is_dir()
        )

    def person_exists(self, organize_name: str, person_name: str) -> bool:
        return self._get_person_path(organize_name, person_name).is_dir()

    def create_person(self, organize_name: str, person_name: str) -> None:
        person_path = self._get_person_path(organize_name, person_name)
        person_path.mkdir(parents=True, exist_ok=True)

    def rename_person(self, organize_name: str, old_name: str, new_name: str) -> None:
        old_path = self._get_person_path(organize_name, old_name)
        new_path = self._get_person_path(organize_name, new_name)
        if not old_path.exists():
            raise FileNotFoundError(f"Person '{old_name}' not found")
        if new_path.exists():
            raise FileExistsError(f"Person '{new_name}' already exists")
        old_path.rename(new_path)

    def delete_person(self, organize_name: str, person_name: str) -> None:
        import shutil
        person_path = self._get_person_path(organize_name, person_name)
        if person_path.exists():
            shutil.rmtree(person_path)

    # ───────── Image Operations ─────────

    def list_person_images(self, organize_name: str, person_name: str) -> List[str]:
        person_path = self._get_person_path(organize_name, person_name)
        if not person_path.exists():
            return []
        return sorted(
            file.name
            for file in person_path.iterdir()
            if file.is_file() and file.suffix.lower() in IMAGE_EXTENSIONS
        )

    def count_person_images(self, organize_name: str, person_name: str) -> int:
        return len(self.list_person_images(organize_name, person_name))

    def get_image_path(self, organize_name: str, person_name: str, filename: str) -> Optional[Path]:
        image_path = self._get_person_path(organize_name, person_name) / filename
        return image_path if image_path.exists() else None

    def save_image(self, organize_name: str, person_name: str, filename: str, data: bytes) -> Path:
        person_path = self._get_person_path(organize_name, person_name)
        person_path.mkdir(parents=True, exist_ok=True)
        file_path = person_path / filename
        file_path.write_bytes(data)
        return file_path

    def delete_image(self, organize_name: str, person_name: str, filename: str) -> None:
        image_path = self._get_person_path(organize_name, person_name) / filename
        if image_path.exists():
            image_path.unlink()

    def image_exists(self, organize_name: str, person_name: str, filename: str) -> bool:
        return (self._get_person_path(organize_name, person_name) / filename).exists()

    def load_all_face_images_for_organize(
        self, organize_name: str
    ) -> List[Tuple[str, np.ndarray]]:
        """Load all face images. Returns list of (person_name, bgr_image_array)."""
        results = []
        faces_path = self._get_faces_path(organize_name)
        if not faces_path.exists():
            return results

        for person_directory in sorted(faces_path.iterdir()):
            if not person_directory.is_dir():
                continue
            person_name = person_directory.name
            for image_file in sorted(person_directory.iterdir()):
                if image_file.suffix.lower() not in IMAGE_EXTENSIONS:
                    continue
                image = cv2.imread(str(image_file))
                if image is not None:
                    results.append((person_name, image))
                else:
                    logger.warning(f"Cannot read image: {image_file}")
        return results


class VectorRepository:
    """FAISS vector database operations for a single organize."""

    def __init__(self, vector_directory: Path):
        import faiss

        self.vector_directory = vector_directory
        self.index_path = vector_directory / "index.faiss"
        self.metadata_path = vector_directory / "meta.npy"
        self._load_or_create()

    def _load_or_create(self) -> None:
        import faiss

        if self.index_path.exists() and self.metadata_path.exists():
            self.index = faiss.read_index(str(self.index_path))
            self.metadata = np.load(str(self.metadata_path), allow_pickle=True).tolist()
            logger.info(
                f"Loaded FAISS index with {self.index.ntotal} vectors "
                f"from {self.vector_directory}"
            )
        else:
            self.index = faiss.IndexFlatIP(EMBEDDING_DIMENSION)
            self.metadata = []
            logger.info(f"Created empty FAISS index at {self.vector_directory}")

    def _save(self) -> None:
        import faiss

        self.vector_directory.mkdir(parents=True, exist_ok=True)
        faiss.write_index(self.index, str(self.index_path))
        np.save(str(self.metadata_path), np.array(self.metadata, dtype=object))

    def search_nearest(
        self, query_vector: np.ndarray, top_k: int = 1
    ) -> List[Tuple[str, float]]:
        """Search nearest vectors. Returns list of (person_name, similarity_score)."""
        if self.index.ntotal == 0:
            return []

        query = query_vector.reshape(1, -1).astype(np.float32)
        similarities, indices = self.index.search(query, min(top_k, self.index.ntotal))

        results = []
        for i in range(len(indices[0])):
            index = indices[0][i]
            if 0 <= index < len(self.metadata):
                similarity = float(similarities[0][i])
                results.append((self.metadata[index], similarity))
        return results

    def reset_and_rebuild(
        self, embeddings: List[Tuple[str, np.ndarray]]
    ) -> None:
        """Reset index and add all embeddings. Each item is (person_name, embedding)."""
        import faiss

        self.index = faiss.IndexFlatIP(EMBEDDING_DIMENSION)
        self.metadata = []

        for person_name, embedding in embeddings:
            vector = embedding.reshape(1, -1).astype(np.float32)
            self.index.add(vector)
            self.metadata.append(person_name)

        self._save()
        logger.info(
            f"Rebuilt index with {self.index.ntotal} vectors, "
            f"saved to {self.vector_directory}"
        )

    def create_empty_index(self) -> None:
        import faiss

        self.index = faiss.IndexFlatIP(EMBEDDING_DIMENSION)
        self.metadata = []
        self._save()

    def count_vectors_per_person(self) -> Dict[str, int]:
        counts: Dict[str, int] = {}
        for name in self.metadata:
            counts[name] = counts.get(name, 0) + 1
        return counts

    def total_vectors(self) -> int:
        return self.index.ntotal

    def reload(self) -> None:
        """Reload index from disk (used after external rebuild)."""
        self._load_or_create()
