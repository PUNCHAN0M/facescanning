# structure_data.py
from pathlib import Path
import shutil
import argparse
import sys
import numpy as np
from typing import List

try:
    import faiss
except ImportError:
    faiss = None

ROOT_DIR = Path("data")
EMBEDDING_DIM = 512  # ArcFace default


class FaceDataManager:
    """
    # สร้าง
    python structure_data.py create pupa ton

    # ลบ
    python structure_data.py remove pupa ton

    # ดูว่ามี organize อะไรบ้าง
    python structure_data.py list-organizes

    # ดูว่าใน 'pupa' มีใครบ้าง
    python structure_data.py list-persons pupa

    # ดูว่า 'ton' ใน 'pupa' มีกี่รูป
    python structure_data.py count-faces pupa ton
    """

    def __init__(self, root_dir: Path = ROOT_DIR):
        self.root_dir = root_dir
        self.root_dir.mkdir(exist_ok=True)

    def _get_organize_dir(self, organize: str) -> Path:
        return self.root_dir / organize

    def _get_faces_dir(self, organize: str) -> Path:
        return self._get_organize_dir(organize) / "faces"

    def _get_person_face_dir(self, organize: str, person: str) -> Path:
        return self._get_faces_dir(organize) / person

    def _get_vector_dir(self, organize: str) -> Path:
        return self._get_organize_dir(organize) / "vector"  # ตรงกับ STRUCTURE.md

    def _init_faiss_and_meta(self, vector_dir: Path):
        """สร้าง FAISS index ว่าง + meta.npy ถ้ายังไม่มี"""
        index_path = vector_dir / "index.faiss"
        meta_path = vector_dir / "meta.npy"  # ✅ ใช้ .npy

        if index_path.exists() and meta_path.exists():
            return

        if faiss is None:
            print("[WARN] FAISS not installed.")
            # สร้าง meta.npy ว่าง
            np.save(meta_path, np.array([], dtype=object))
            return

        # ✅ ใช้ IndexFlatL2 (ไม่ใช่ IndexIDMap + FlatIP)
        index = faiss.IndexFlatL2(EMBEDDING_DIM)
        faiss.write_index(index, str(index_path))

        # ✅ สร้าง meta.npy ว่าง (dtype=object รองรับ string)
        np.save(meta_path, np.array([], dtype=object))

        print(f"[OK] Initialized FAISS (IndexFlatL2) and meta.npy in: {vector_dir}")
    # --- Create / Remove ---
    def create_person(self, organize: str, person: str):
        faces_dir = self._get_faces_dir(organize)
        vector_dir = self._get_vector_dir(organize)
        person_dir = self._get_person_face_dir(organize, person)

        # สร้างโฟลเดอร์พื้นฐาน
        faces_dir.mkdir(parents=True, exist_ok=True)
        vector_dir.mkdir(parents=True, exist_ok=True)
        person_dir.mkdir(parents=True, exist_ok=True)

        # สร้าง FAISS + meta.json ถ้ายังไม่มี
        self._init_faiss_and_meta(vector_dir)

        print(f"[OK] Created person dir: {person_dir}")
        print(f"[OK] Vector dir: {vector_dir}")

    def remove_person(self, organize: str, person: str):
        person_dir = self._get_person_face_dir(organize, person)
        if person_dir.exists():
            shutil.rmtree(person_dir)
            print(f"[OK] Removed: {person_dir}")
        else:
            print(f"[WARN] Person dir not found: {person_dir}")

        print("[INFO] To remove embeddings, delete entries from meta.json and rebuild FAISS.")

    def rename_organize(self, old_name: str, new_name: str):
        """เปลี่ยนชื่อ organize"""
        old_dir = self._get_organize_dir(old_name)
        new_dir = self._get_organize_dir(new_name)
        
        if not old_dir.exists():
            raise ValueError(f"Organize '{old_name}' not found")
        
        if new_dir.exists():
            raise ValueError(f"Organize '{new_name}' already exists")
        
        old_dir.rename(new_dir)
        print(f"[OK] Renamed organize: {old_name} -> {new_name}")

    def rename_person(self, organize: str, old_name: str, new_name: str):
        """เปลี่ยนชื่อ person"""
        old_person_dir = self._get_person_face_dir(organize, old_name)
        new_person_dir = self._get_person_face_dir(organize, new_name)
        
        if not old_person_dir.exists():
            raise ValueError(f"Person '{old_name}' not found in organize '{organize}'")
        
        if new_person_dir.exists():
            raise ValueError(f"Person '{new_name}' already exists in organize '{organize}'")
        
        old_person_dir.rename(new_person_dir)
        print(f"[OK] Renamed person in '{organize}': {old_name} -> {new_name}")
        print("[INFO] Don't forget to rebuild vectors to update metadata")

    def remove_organize(self, organize: str):
        """ลบ organize ทั้งหมด"""
        organize_dir = self._get_organize_dir(organize)
        if organize_dir.exists():
            shutil.rmtree(organize_dir)
            print(f"[OK] Removed organize: {organize_dir}")
        else:
            print(f"[WARN] Organize not found: {organize_dir}")

    # --- Read / List / Count ---
    def list_organizes(self) -> List[str]:
        if not self.root_dir.exists():
            return []
        return [d.name for d in self.root_dir.iterdir() if d.is_dir()]

    def list_persons(self, organize: str) -> List[str]:
        faces_dir = self._get_faces_dir(organize)
        if not faces_dir.exists():
            return []
        return [d.name for d in faces_dir.iterdir() if d.is_dir()]

    def count_faces(self, organize: str, person: str) -> int:
        person_dir = self._get_person_face_dir(organize, person)
        if not person_dir.exists():
            return 0
        image_extensions = {".png", ".jpg", ".jpeg", ".bmp", ".tiff"}
        return sum(
            1 for f in person_dir.iterdir()
            if f.is_file() and f.suffix.lower() in image_extensions
        )

    # --- CLI Helpers ---
    def cli_create(self, organize: str, person: str):
        self.create_person(organize, person)

    def cli_remove(self, organize: str, person: str):
        self.remove_person(organize, person)

    def cli_list_organizes(self):
        organizes = self.list_organizes()
        print(f"Found {len(organizes)} organize(s):")
        for org in sorted(organizes):
            print(f"  - {org}")

    def cli_list_persons(self, organize: str):
        persons = self.list_persons(organize)
        print(f"In '{organize}', found {len(persons)} person(s):")
        for p in sorted(persons):
            print(f"  - {p}")

    def cli_count_faces(self, organize: str, person: str):
        count = self.count_faces(organize, person)
        print(f"Person '{person}' in '{organize}' has {count} face image(s).")


def main():
    parser = argparse.ArgumentParser(description="Face Data Structure Manager")
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    p_create = subparsers.add_parser("create", help="Create a new person in an organize")
    p_create.add_argument("organize", type=str)
    p_create.add_argument("person", type=str)

    p_remove = subparsers.add_parser("remove", help="Remove a person (images only)")
    p_remove.add_argument("organize", type=str)
    p_remove.add_argument("person", type=str)

    p_list_org = subparsers.add_parser("list-organizes", help="List all organize folders")

    p_list_pers = subparsers.add_parser("list-persons", help="List persons in an organize")
    p_list_pers.add_argument("organize", type=str)

    p_count = subparsers.add_parser("count-faces", help="Count face images of a person")
    p_count.add_argument("organize", type=str)
    p_count.add_argument("person", type=str)

    args = parser.parse_args()

    manager = FaceDataManager()

    if args.command == "create":
        manager.cli_create(args.organize, args.person)
    elif args.command == "remove":
        manager.cli_remove(args.organize, args.person)
    elif args.command == "list-organizes":
        manager.cli_list_organizes()
    elif args.command == "list-persons":
        manager.cli_list_persons(args.organize)
    elif args.command == "count-faces":
        manager.cli_count_faces(args.organize, args.person)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()