import os
import uuid
import faiss
import torch
import numpy as np
import pillow_heif
from PIL import Image
from tqdm import tqdm
from ultralytics import YOLO
from facenet_pytorch import InceptionResnetV1


from langchain_community.vectorstores import FAISS
from langchain.docstore.document import Document
from langchain_community.docstore.in_memory import InMemoryDocstore


from app.utils.transform_factory import face_transform
from app.core.dummy_embedding import DummyEmbeddings
from app.configs.core_config import CoreConfig

pillow_heif.register_heif_opener()


class Vector:

    def __init__(self, core_config: CoreConfig, dummy_embeddings: DummyEmbeddings, device=None):
        self.core_config = core_config
        self.dummy_embeddings = dummy_embeddings
        self.device = device or self.core_config.default_device
        self.embedding_dim = self.core_config.embedding_dim
        self.model = (
            InceptionResnetV1(pretrained=self.core_config.face_embedder_model)
            .eval()
            .to(self.device)
        )
        self.model_YOLO = YOLO(self.core_config.yolo_model_path)
        self.face_images_path = self.core_config.face_images_path
        self.batch_size = self.core_config.batch_size
        self.transform = face_transform()

    async def _extract_face_vectors(self, face_images_folder: str):
        """
        Extract vectors from all person_id folders in the face_images_folder.
        """
        all_vectors = []
        all_docs = []

        for person_id_folder in tqdm(
            os.listdir(face_images_folder), desc=f"Processing {face_images_folder}"
        ):
            person_folder = os.path.join(face_images_folder, person_id_folder)
            if not os.path.isdir(person_folder):
                continue

            vectors, docs = await self._extract_face_vectors_single(person_folder)
            all_vectors.extend(vectors)
            all_docs.extend(docs)

        return all_vectors, all_docs

    async def _extract_face_vectors_single(self, person_folder: str):
        """
        Extract vectors from all images inside a single person_folder.
        """
        vectors = []
        docs = []
        person_id = os.path.basename(person_folder)

        for img_file in os.listdir(person_folder):
            img_path = os.path.join(person_folder, img_file)

            try:
                img = Image.open(img_path).convert("RGB")
            except Exception as e:
                print(f"[ERROR] Error loading image: {img_path} | {e}")
                continue

            # YOLO face detection
            results = self.model_YOLO.predict(source=img, conf=0.8, verbose=False)
            detections = results[0]

            if not detections.boxes or len(detections.boxes) == 0:
                print(f"[ERROR] No face found in: {img_path}")
                continue

            # Crop face
            x1, y1, x2, y2 = map(int, detections.boxes[0].xyxy[0])
            cropped = img.crop((x1, y1, x2, y2))

            # Convert to tensor
            face_tensor = self.transform(cropped).unsqueeze(0).to(self.device)

            # Extract embedding
            with torch.no_grad():
                embedding = self.model(face_tensor).squeeze().cpu().numpy()
                embedding = embedding / np.linalg.norm(embedding)

                vectors.append(embedding)
                docs.append(
                    Document(
                        page_content="face_vector",
                        metadata={"name": person_id, "image": img_file},
                    )
                )

        return vectors, docs

    """
    ========== CRUD ===========
    """

    async def build_empty_vectors(self) -> dict:
        """
        index    : สร้าง vector ขนาด 512
        docstore : สร้าง ที่ว่าง ๆ ที่เก็บ metadata เช่น ชื่อบุคคลและชื่อไฟล์
        index_to_docstore_id : dictionary mapping จาก index ใน FAISS ไปยัง ID ใน docstore

        db
        index: FAISS index สำหรับจัดเก็บเวกเตอร์
        docstore: เก็บ metadata เช่น ชื่อคนและชื่อรูป
        index_to_docstore_id: mapping ระหว่าง index กับ ID ใน docstore
        """
        index = faiss.IndexIDMap(faiss.IndexFlatL2(self.embedding_dim))  # ใช้ IndexIDMap
        docstore = InMemoryDocstore({})
        index_to_docstore_id = {}

        db = FAISS(
            embedding_function=self.dummy_embeddings,
            index=index,
            docstore=docstore,
            index_to_docstore_id=index_to_docstore_id,
        )
        db.save_local(self.core_config.vector_path)
        return {
            "success": True,
            "message": f"Empty vectors for {self.core_config.admin_id} created successfully.",
        }

    async def delete_vectors(self) -> dict:
        """
        ลบข้อมูลเวกเตอร์ที่เคยถูกสร้างไว้ เช่น FAISS index และ metadata ต่าง ๆ
        """
        try:
            os.remove(self.core_config.vector_path)
            return {
                "success": True,
                "message": f"Vectors for {self.core_config.admin_id} deleted successfully.",
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Error deleting vector file: {str(e)}",
            }

    async def build_vectors(self) -> dict:
        """
        batch_size : แบ่งเป็น batch เพื่อลดการใช้ RAM
        index : สร้าง IndexFlatL2 -ขนาด 512
        index.add : เอา vector ที่ extract มาไปใส่ ใน index
        docstore : loop เอา vector ที่อยู่ใน index มาเก็บใน docstore

        doc_ids : เก็บ uuid ตามจำนวน vector ที่ได้จาก image_person
        docstore_dict : เป็น unique id ของแต่ละภาพ
        index_to_docstore_id : สสร้าง dictionary ที่ mapping ระหว่าง ลำดับ index ใน FAISS กับ ID ของเอกสารใน docstore
        """
        vectors, docs = await self._extract_face_vectors(self.face_images_path)
        if not vectors:
            return {
                "success": False,
                "message": f"No face vectors of {self.core_config.admin_id} extracted.",
            }

        index = faiss.IndexIDMap(faiss.IndexFlatL2(self.embedding_dim))
        ids = np.array(range(len(vectors)), dtype=np.int64)
        for i in range(0, len(vectors), self.batch_size):
            batch_vecs = np.array(vectors[i : i + self.batch_size]).astype(np.float32)
            batch_ids = ids[i : i + self.batch_size]
            index.add_with_ids(batch_vecs, xids=batch_ids)  # type: ignore

        docstore_dict = {}
        index_to_docstore_id = {}
        for i, doc in enumerate(docs):
            doc_id = str(uuid.uuid4())
            docstore_dict[doc_id] = doc
            index_to_docstore_id[i] = doc_id

        db = FAISS(
            embedding_function=self.dummy_embeddings,
            index=index,
            docstore=InMemoryDocstore(docstore_dict),
            index_to_docstore_id=index_to_docstore_id,
        )
        db.save_local(self.core_config.vector_path)
        return {
            "success": True,
            "message": f"Vectors for {self.core_config.admin_id} built successfully with {len(vectors)} vectors.",
        }

    async def get_people_vectors(self) -> dict:
        """
        แสดงชื่อบุคคลทั้งหมดในฐานข้อมูล พร้อมจำนวนภาพและ metadata ของแต่ละภาพ
        """
        db = FAISS.load_local(
            self.core_config.vector_path,
            embeddings=self.dummy_embeddings,
            allow_dangerous_deserialization=True,
        )

        people_data = {}

        for idx, doc_id in db.index_to_docstore_id.items():
            doc = db.docstore.search(doc_id)
            if (
                isinstance(doc, Document)
                and hasattr(doc, "metadata")
                and isinstance(doc.metadata, dict)
            ):
                name = doc.metadata.get("name")
            else:
                continue

            if name not in people_data:
                people_data[name] = []

            result_info = {"index": idx, "doc_id": doc_id, "metadata": doc.metadata}
            people_data[name].append(result_info)

        return people_data

    async def get_person_vectors(self, person_id: str) -> dict:
        """
        database มี person_name(ชื่อนั้นกี่ภาพและอะไรบ้าง)
        """
        db = FAISS.load_local(
            self.core_config.vector_path,
            embeddings=self.dummy_embeddings,
            allow_dangerous_deserialization=True,
        )
        results = []
        for idx, doc_id in db.index_to_docstore_id.items():
            doc = db.docstore.search(doc_id)
            if (
                isinstance(doc, Document)
                and hasattr(doc, "metadata")
                and isinstance(doc.metadata, dict)
                and doc.metadata.get("name") == person_id
            ):
                result_info = {"index": idx, "doc_id": doc_id, "metadata": doc.metadata}
                results.append(result_info)
        return {"person_id": person_id, "total_vectors": len(results), "vectors": results}

    async def get_total_vectors(self) -> int:
        """
        นับจำนวนเวกเตอร์ใบหน้าทั้งหมดใน FAISS database
        """
        db = FAISS.load_local(
            self.core_config.vector_path,
            embeddings=self.dummy_embeddings,
            allow_dangerous_deserialization=True,
        )
        total_count = db.index.ntotal
        return total_count

    async def update_person_vectors(self, person_id: str) -> dict:
        """
        db
        load model vector : เดิมมาใช้งานเป็น base

        existing_keys : เช็คว่า Metadata={'name': 'Pun', 'image': 'IMG_6371.HEIC'}
        ซ้ำกับชื่อและภาพที่อยู่ใน model มั้ย

        """
        person_folder = os.path.join(self.face_images_path + "/" + person_id)

        db = FAISS.load_local(
            self.core_config.vector_path,
            embeddings=self.dummy_embeddings,
            allow_dangerous_deserialization=True,
        )
        docstore = db.docstore
        assert isinstance(docstore, InMemoryDocstore), "Expected InMemoryDocstore"
        existing_keys = {
            f"{doc.metadata['name']}_{doc.metadata['image']}" for doc in docstore._dict.values()
        }

        new_vectors, new_docs = await self._extract_face_vectors_single(person_folder)
        if not new_vectors:
            return {
                "success": False,
                "message": f"No new faces to add for {person_id}.",
            }

        filtered_vectors = []
        filtered_docs = []
        for vec, doc in zip(new_vectors, new_docs):
            key = f"{doc.metadata['name']}_{doc.metadata['image']}"
            if key not in existing_keys:
                filtered_vectors.append(vec)
                filtered_docs.append(doc)
                existing_keys.add(key)

        if not filtered_vectors:
            return {
                "success": False,
                "message": f"No new vectors to add for {person_id}.",
            }

        current_count = db.index.ntotal
        ids = np.array(range(current_count, current_count + len(filtered_vectors)), dtype=np.int64)
        db.index.add_with_ids(np.array(filtered_vectors).astype(np.float32), ids)

        for i, (vec, doc) in enumerate(zip(filtered_vectors, filtered_docs)):
            doc_id = str(uuid.uuid4())
            docstore._dict[doc_id] = doc
            db.index_to_docstore_id[current_count + i] = doc_id

        db.save_local(self.core_config.vector_path)
        return {
            "success": True,
            "message": f"Updated vectors for {person_id} with {len(filtered_vectors)} new vectors.",
        }

    async def delete_person_vectors(self, person_id: str) -> dict:
        """
        เช็คจากชื่อ ว่าใน metadata มีชื่อนั้นมั้ย ถ้ามี ลบ
        """
        # !FEATURE ยิง API ลบ person_folder
        db = FAISS.load_local(
            self.core_config.vector_path,
            embeddings=self.dummy_embeddings,
            allow_dangerous_deserialization=True,
        )

        indices_to_delete = []
        for idx, doc_id in db.index_to_docstore_id.items():
            doc = db.docstore.search(doc_id)
            if (
                isinstance(doc, Document)
                and hasattr(doc, "metadata")
                and doc.metadata.get("name") == person_id
            ):
                faiss_id = idx
                indices_to_delete.append(faiss_id)

        if not indices_to_delete:
            return {"success": False, "message": f"No vectors found for {person_id}."}

        db.index.remove_ids(np.array(indices_to_delete, dtype=np.int64))

        remaining_index_map = {}
        remaining_docstore = {}
        for idx, doc_id in db.index_to_docstore_id.items():
            if idx not in indices_to_delete:
                remaining_index_map[idx] = doc_id
                remaining_docstore[doc_id] = db.docstore.search(doc_id)

        db.docstore = InMemoryDocstore(remaining_docstore)
        db.index_to_docstore_id = remaining_index_map

        db.save_local(self.core_config.vector_path)
        return {"success": True, "message": f"Deleted vectors for {person_id}."}
