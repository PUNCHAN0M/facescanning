from concurrent.futures import ThreadPoolExecutor
from typing import Dict
import numpy
import time

from app.configs.core_config import CoreConfig
from app.services.redis_service import RedisService
from app.services.server_service import ServerService
from app.core.face_detection import FaceDetection
from app.core.face_embedding import FaceEmbedding
from app.core.face_recognition import FaceRecognition
from app.core.face_blob import FaceBlob


class FaceTracking:

    def __init__(
        self,
        core_config: CoreConfig,
        redis_service: RedisService,
        server_service: ServerService,
        face_detection: FaceDetection,
        face_embedding: FaceEmbedding,
        face_recognition: FaceRecognition,
    ):
        self.core_config = core_config
        self.redis_service = redis_service
        self.server_service = server_service
        self.detection = face_detection
        self.embedding = face_embedding
        self.recognition = face_recognition

        self.id_counter = 0
        self.blobs = []

    def load_faiss_index(self):
        """Load FAISS index for face recognition"""
        try:
            self.recognition.load_faiss_index()
        except Exception as e:
            print(f"[ERROR] Failed to load FAISS index: {e}")
            raise RuntimeError(
                "Failed to load FAISS index. Ensure the index file exists and is valid."
            ) from e

    def _is_near(self, pos1, pos2):
        """Check if two positions are within the blob distance threshold"""
        try:
            dx, dy = pos1[0] - pos2[0], pos1[1] - pos2[1]
            return dx * dx + dy * dy < self.core_config.blob_distance_threshold**2
        except Exception as e:
            print(f"[ERROR] Error in _is_near: {e}")
            return False

    async def _match_or_create_blob(self, position, face_img, matched_person, matched_ids):
        """Update existing blob if near, else create new blob"""
        try:
            for blob in self.blobs:
                if self._is_near(blob.predict_position(), position):
                    blob.update(
                        position=position,
                        image=face_img,
                        matched_person_name=matched_person or blob.matched_person_name,
                    )
                    matched_ids.add(blob.id)
                    return

            # หากไม่มี blob ใกล้เคียง สร้างใหม่
            blob_id = f"face_{self.id_counter}"
            self.id_counter += 1
            new_blob = FaceBlob(
                id=blob_id,
                position=position,
                image=face_img,
                core_config=self.core_config,
            )
            new_blob.matched_person_name = matched_person
            self.blobs.append(new_blob)
            matched_ids.add(new_blob.id)

        except Exception as e:
            print(f"[ERROR] Failed in _match_or_create_blob: {e}")
            # return {"id": None, "name": None}

    async def _decrease_life_and_cleanup(self, matched_ids=set()):
        """
        Decrease life of unmatched blobs and remove those expired

        Returns:
            Tuple[numpy.ndarray, List[Dict[str, str]]]:
            - numpy.ndarray: เฟรมภาพที่มีการวาดขอบเขตและข้อมูลของใบหน้าที่ตรวจจับได้ (annotation).
                             หากไม่พบใบหน้าหรือเกิดข้อผิดพลาด จะส่งคืนเฟรมต้นฉบับ.
            - List[Dict[str, str]]: รายการของ dictionary สรุปข้อมูลของบุคคลที่
                                     "หายไป" จากการติดตาม (blobs ที่หมดอายุ).
                                     แต่ละ dictionary มีคีย์:
                                     - "person_id" (str): ชื่อของบุคคลหรือ ID ของ Blob.
                                     - "detection_image" (str): รูปภาพของใบหน้าที่ถูกตรวจจับ
                                                                 ในรูปแบบ Base64-encoded JPEG.
        """

        to_remove = []
        try:
            for blob in self.blobs:
                if blob.id not in matched_ids:
                    blob.life -= 1
                    if blob.life <= 0:
                        to_remove.append(blob)
        except Exception as e:
            print(f"[ERROR] Error in _decrease_life_and_cleanup: {e}")
        try:
            results = []
            for blob in to_remove:
                name, detection_image = await blob.get_match_summary()
                if detection_image is None or name is None:
                    continue  # ข้ามไปถ้าไม่มีภาพ ไม่มีชื่อ

                results.append(
                    {
                        "person_id": name,
                        "detection_image": detection_image,
                    }
                )
                self.blobs.remove(blob)
            return results
        except Exception as e:
            print(f"[ERROR] Error removing expired blobs: {e}")

    async def _process_tracking_result(self, tracking_results: list) -> Dict[str, str]:
        """
        ประมวลผลผลลัพธ์ดิบที่ได้จากการติดตามใบหน้า (FaceTracking)
        เพื่อให้ได้สถานะการตรวจจับที่ชัดเจน.
        Logic:
            กรณี1 คือรู้จักทุกคน บันทึกข้อมูลทุกคนให้ทำการ FOUND_PERSON
            กรณีที่2 คือไม่รู้จักทุกคน ให้ส่งผลลัพธ์ออกมาเป็น FOUND_UNKNOWN
            กรณีที่3 คือถ้าทุกคนเป็น ALREADY_LOGGED ให้ ALREADY_LOGGED

            กรณีที่4 คือมีคนที่รู้จัก และมีคนที่ไม่รู้จัก และไม่มี ALREADY_LOGGED  ให้ FOUND_PERSON_AND_UNKNOWN
            กรณีที่5 คือมีคนที่รู้จัก และมีคนที่ไม่รู้จัก และมี ALREADY_LOGGED ให้ FOUND_PERSON_AND_UNKNOWN

            กรณีที่6 คือมีคนที่รู้จัก และไม่มีคนที่ไม่รู้จัก และมี ALREADY_LOGGED ให้ FOUND_PERSON
            กรณีที่7 คือมีคนที่รู้จัก และไม่มีคนที่ไม่รู้จัก และไม่มี ALREADY_LOGGED ให้ FOUND_PERSON

            กรณีที่8 คือไม่มีคนที่รู้จัก และมีคนที่ไม่รู้จัก และมี ALREADY_LOGGED ให้ FOUND_UNKNOWN
            กรณีที่9 คือไม่มีคนที่รู้จัก และมีคนที่ไม่รู้จัก และไม่มี ALREADY_LOGGED ให้ FOUND_UNKNOWN

            กรณีที่10 คือถ้าไม่มีใครสักคนเป็น array ว่างๆ ให้ NOT_FOUND

        Args:
            tracking_results (List): ผลลัพธ์ดิบจาก _decrease_life_and_cleanup().
                                        คาดว่าเป็น List[Dict[str, str]] แต่ก็ต้องเผื่อกรณีอื่น.

        Returns:
            Dict[str, str]: {"status": ..., "message": ...}
        """
        # ✅ กรณี 10
        if isinstance(tracking_results, list) and not tracking_results:
            return {
                "status": self.core_config.NOT_FOUND,
                "message": "ไม่พบใบหน้าในเฟรม",
            }

        # if not isinstance(tracking_results, list):
        #     return {
        #         "status": self.core_config.ERROR,
        #         "message": "ประเภทข้อมูล tracking results ไม่ถูกต้อง (ต้องเป็น list)",
        #     }

        person_ids = []
        unknown_ids = []
        already_logged_ids = []

        for item in tracking_results:
            # if (
            #     not isinstance(item, dict)
            #     or "person_id" not in item
            #     or "detection_image" not in item
            # ):
            #     return {
            #         "status": self.core_config.ERROR,
            #         "message": "ข้อมูล tracking บางรายการไม่ถูกต้อง (ต้องมี person_id และ detection_image)",
            #     }

            person_id = item["person_id"]
            detection_image = item["detection_image"]

            # * คนที่ไม่รู้จัก
            if person_id == self.core_config.UNKNOWN:
                unknown_ids.append(person_id)
                await self.server_service.create_detection_log(
                    self.core_config.UNKNOWN, detection_image
                )
                continue
            redis_result = await self.redis_service.exists(person_id)
            redis_status = redis_result.get("status")

            # * คนที่รู้จัก
            if redis_status == self.core_config.SET:
                if not await self.server_service.create_detection_log(person_id, detection_image):
                    return {
                        "status": self.core_config.ERROR,
                        "message": "เกิดปัญหาขณะเพิ่มข้อมูล detection log",
                    }
                else:
                    person_ids.append(person_id)

            # * คนที่บันทึกไปแล้ว
            elif redis_status == self.core_config.EXISTS:
                already_logged_ids.append(person_id)

            # * เซสชั่นกำลังปิดอยู่
            elif redis_status == self.core_config.SESSION_END:
                return {
                    "status": self.core_config.SESSION_END,
                    "message": "เซสชั่นปิดอยู่ไม่สามารถบันทึกข้อมูลได้",
                }
            else:
                return {
                    "status": self.core_config.ERROR,
                    "message": "ไม่สามารถตรวจสอบสถานะ Redis ได้",
                }

        # * Logic
        if person_ids and not unknown_ids:
            # ✅ กรณี 1, 6, 7
            return {
                "status": self.core_config.FOUND_PERSON,
                "message": f"พบบุคคลใหม่ {len(person_ids)} คน: {', '.join(person_ids)}",
            }

        if not person_ids and not already_logged_ids and unknown_ids:
            # ✅ กรณี 2, 8, 9
            return {
                "status": self.core_config.FOUND_UNKNOWN,
                "message": "พบใบหน้าแต่ไม่สามารถระบุตัวตนได้",
            }

        if not person_ids and unknown_ids and already_logged_ids:
            # ✅ กรณี 5
            return {
                "status": self.core_config.FOUND_PERSON_AND_UNKNOWN,
                "message": f"มีคนรู้จักแล้ว (ข้าม): {', '.join(already_logged_ids)} / พบใบหน้าที่ไม่รู้จัก {len(unknown_ids)} คน",
            }

        if person_ids and unknown_ids:
            # ✅ กรณี 4
            return {
                "status": self.core_config.FOUND_PERSON_AND_UNKNOWN,
                "message": f"พบบุคคลใหม่ {len(person_ids)} คน: {', '.join(person_ids)} / พบใบหน้าที่ไม่รู้จัก {len(unknown_ids)} คน",
            }

        if not person_ids and not unknown_ids and already_logged_ids:
            # ✅ กรณี 3
            return {
                "status": self.core_config.ALREADY_LOGGED,
                "message": f"บุคคลทั้งหมดเคยบันทึกไว้แล้ว: {', '.join(already_logged_ids)}",
            }

        print("[ERROR] Unable to process result (format does not match known criteria)")
        return {
            "status": self.core_config.ERROR,
            "message": "ไม่สามารถประมวลผลผลลัพธ์ได้ (รูปแบบไม่ตรงเงื่อนไขที่รู้จัก)",
        }

    async def tracking_face(self, frame: numpy.ndarray) -> tuple[numpy.ndarray, Dict[str, str]]:
        """
        Main method to track faces in a frame

        Args:
            frame (numpy.ndarray): เฟรมภาพ (OpenCV image) ที่ต้องการติดตามใบหน้า.

        Returns:
            Dict[str, str]: {"status": ..., "message": ...}
        """
        start_total = time.perf_counter()
        try:
            detections = self.detection.detect_faces(frame)

            # Check if detections is empty or invalid
            if not detections or not hasattr(detections, "boxes") or not detections.boxes:
                tracking_results = await self._decrease_life_and_cleanup()
                result = await self._process_tracking_result(tracking_results or [])
                return frame, result

            annotation = detections.plot()
            if annotation is None:
                return frame, {
                    "status": self.core_config.NOT_FOUND,
                    "message": "ไม่พบใบหน้าในเฟรม",
                }

            positions, face_images = await self.detection.extract_faces_and_positions(
                frame, detections
            )
            matched_ids = set()

            # Parallel embedding generation
            with ThreadPoolExecutor(max_workers=4) as executor:
                embeddings = list(executor.map(self.embedding.image_embedding, face_images))

            # Process each face with precomputed embedding
            tracking_results = []
            for position, face_img, embedding in zip(positions, face_images, embeddings):
                if embedding is None:
                    continue  # Skip invalid embeddings

                matched_person = await self.recognition.find_best_match(embedding)
                result = await self._match_or_create_blob(
                    position, face_img, matched_person, matched_ids
                )
                tracking_results.append(result)

            tracking_results = await self._decrease_life_and_cleanup(matched_ids)
            result = await self._process_tracking_result(tracking_results or [])

            end_total = time.perf_counter()
            print(f"Total tracking_face execution time: {end_total - start_total:.4f} seconds\n")
            return annotation, result

        except Exception as e:
            print(f"[ERROR] in tracking_face: {e}")
            await self._decrease_life_and_cleanup()
            return frame, {
                "status": self.core_config.ERROR,
                "message": "tracking face: {e}",
            }
