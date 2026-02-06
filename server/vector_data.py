# vector_data.py
from pathlib import Path
import cv2
import numpy as np
import faiss
from typing import List, Optional, Dict, Tuple, Union
from collections import Counter

# Support both embedders
try:
    from arcfacecustom import ArcFaceCustomEmbedder
except ImportError:
    ArcFaceCustomEmbedder = None

try:
    from arcface import ArcFaceEmbedder
except ImportError:
    ArcFaceEmbedder = None

ROOT_DATA = Path("data")
EMBEDDING_DIM = 512


class VectorDatabaseManager:
    """
    CLI Examples
    ------------
    # สร้าง embedding ทั้ง organize
    python vector_data.py pupa --embed

    # ดูรายชื่อ person
    python vector_data.py pupa --list

    # นับจำนวน person
    python vector_data.py pupa --count

    # นับจำนวน vector ต่อ person
    python vector_data.py pupa --count-vectors
    """

    def __init__(self, organize_name: str):
        self.organize_name = organize_name
        self.vector_dir = ROOT_DATA / organize_name / "vector"
        self.faces_dir = ROOT_DATA / organize_name / "faces"

        if not self.vector_dir.exists():
            raise FileNotFoundError(f"Vector directory not found: {self.vector_dir}")
        if not self.faces_dir.exists():
            raise FileNotFoundError(f"Faces directory not found: {self.faces_dir}")

        self.index_path = self.vector_dir / "index.faiss"
        self.meta_path = self.vector_dir / "meta.npy"

        # เช็คและสร้างไฟล์ถ้ายังไม่มี
        if not self.index_path.exists() or not self.meta_path.exists():
            print(f"[INFO] Creating new vector database for '{organize_name}'")
            self.index = faiss.IndexFlatIP(EMBEDDING_DIM)
            self.meta = []
            self._save()
        else:
            self.index = faiss.read_index(str(self.index_path))
            meta_array = np.load(self.meta_path, allow_pickle=True)
            self.meta = meta_array.tolist() if meta_array.size > 0 else []

    def _save(self):
        faiss.write_index(self.index, str(self.index_path))
        np.save(self.meta_path, np.array(self.meta, dtype=object))

    # ================= Query =================

    def count_person(self) -> int:
        return len(set(self.meta))

    def get_person(self, amount: Optional[int] = None) -> List[str]:
        persons = sorted(set(self.meta))
        return persons[:amount] if amount else persons

    def count_vectors_per_person(self) -> Dict[str, int]:
        return dict(Counter(self.meta))

    def count_vectors_of_person(self, person_name: str) -> int:
        return self.meta.count(person_name)

    # ================= Search =================

    def search(self, query_vector: np.ndarray, k: int = 5) -> List[Tuple[str, float]]:
        """
        ค้นหาบุคคลที่ใกล้เคียงที่สุดจาก query vector
        
        Args:
            query_vector: numpy array ขนาด (512,) หรือ (1, 512)
            k: จำนวนผลลัพธ์ที่ต้องการ
        
        Returns:
            List ของ tuple (person_name, similarity_score) เรียงจากมากไปน้อย
        """
        if query_vector.ndim == 1:
            query_vector = query_vector.reshape(1, -1)
        query_vector = query_vector.astype(np.float32)
        
        # Normalize สำหรับ cosine similarity
        norm = np.linalg.norm(query_vector)
        if norm > 0:
            query_vector = query_vector / norm

        # Search (Inner Product = Cosine Similarity เมื่อ normalized)
        similarities, indices = self.index.search(query_vector, k)
        results = []
        for i in range(len(indices[0])):
            idx = indices[0][i]
            if idx == -1:  # FAISS อาจ return -1 ถ้าไม่มีข้อมูล
                continue
            person = self.meta[idx]
            similarity = float(similarities[0][i])  # ยิ่งสูงยิ่งใกล้เคียง
            results.append((person, similarity))
        return results

    # ================= Modify =================

    def reset_vectordb(self):
        """ลบ vector และ meta ทั้งหมด"""
        self.index = faiss.IndexFlatIP(EMBEDDING_DIM)
        self.meta = []
        self._save()

    def embedding_organize(self, embedder: Union['ArcFaceEmbedder', 'ArcFaceCustomEmbedder'], reset: bool = True):
        """
        Embed ทุกรูปภาพใน organize ด้วย embedder ที่ระบุ
        รองรับทั้ง ArcFaceEmbedder และ ArcFaceCustomEmbedder
        """
        if reset:
            self.reset_vectordb()

        image_exts = {".png", ".jpg", ".jpeg", ".bmp", ".tiff", ".avif", ".webp"}

        for person_dir in self.faces_dir.iterdir():
            if not person_dir.is_dir():
                continue

            person_name = person_dir.name
            print(f"[INFO] Processing {person_name}")

            for img_path in person_dir.iterdir():
                if img_path.suffix.lower() not in image_exts:
                    continue

                img = cv2.imread(str(img_path))
                if img is None:
                    print(f"[WARN] Cannot read {img_path}")
                    continue

                # รองรับทั้งสอง embedder
                embedding = embedder.get_embedding(img, skip_detection=True)
                if embedding is None:
                    print(f"[WARN] Cannot extract embedding: {img_path}")
                    continue
                
                # Normalize embedding สำหรับ cosine similarity
                norm = np.linalg.norm(embedding)
                if norm > 0:
                    embedding = embedding / norm

                self.index.add(embedding.reshape(1, -1))
                self.meta.append(person_name)

        self._save()
        print("[OK] Re-embedding completed")
    
    def matchUser():
        pass

# ================= CLI =================

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser("FAISS Vector DB Manager")
    parser.add_argument("organize", help="Organize name")
    parser.add_argument("--embed", action="store_true", help="Re-embed entire organize")
    parser.add_argument("--list", action="store_true", help="List all persons")
    parser.add_argument("--count", action="store_true", help="Count total unique persons")
    parser.add_argument("--count-vectors", action="store_true", help="Count vectors per person")
    parser.add_argument("--use-custom", action="store_true", help="Use ArcFaceCustomEmbedder (same as client)")

    args = parser.parse_args()

    try:
        manager = VectorDatabaseManager(args.organize)
    except FileNotFoundError as e:
        print(f"[ERROR] {e}")
        exit(1)

    if args.embed:
        if args.use_custom or ArcFaceCustomEmbedder is not None:
            print("[INFO] Using ArcFaceCustomEmbedder (same preprocessing as client)")
            from arcfacecustom import ArcFaceCustomEmbedder
            embedder = ArcFaceCustomEmbedder()
        else:
            print("[INFO] Using ArcFaceEmbedder (InsightFace)")
            embedder = ArcFaceEmbedder(ctx_id=0)
        manager.embedding_organize(embedder)
    elif args.list:
        for p in manager.get_person():
            print("-", p)
    elif args.count:
        print("Total persons:", manager.count_person())
    elif args.count_vectors:
        counts = manager.count_vectors_per_person()
        print(f"Vector count in '{args.organize}':")
        for person, cnt in sorted(counts.items()):
            print(f"  - {person}: {cnt} vectors")
    else:
        parser.print_help()