import os
import torch
import pathlib


class CoreConfig:

    def __init__(self, admin_id: str, camera_id: str = "*", session_id: str = "*"):
        self.admin_id = admin_id
        self.camera_id = camera_id
        self.session_id = session_id

        # * DIRECTORIES
        self.base_dir = os.getcwd()
        current_file = pathlib.Path(__file__).resolve()
        self.project_dir = current_file.parents[3]

        # * YOLO
        self.yolo_model_name = "yolov11n-face.pt"
        self.yolo_model_path = os.path.join(self.base_dir, "app/models", self.yolo_model_name)
        self.yolo_threshold = 0.8  # ! 0.7 - 0.9 ยิ่งมากยิ่งมั่นใจ

        # * FACENET
        self.face_embedder_model = "vggface2"
        self.default_device = "cuda" if torch.cuda.is_available() else "cpu"
        self.embedding_dim = 512
        self.facenet_threshold = 0.65  # ! 0.6 - 0.8 ยิ่งน้อยยิ่งเหมือน

        # * VECTOR
        self.vector_path = os.path.join(self.base_dir, f"app/vector/{admin_id}")
        self.faiss_path = os.path.join(self.vector_path, "index.faiss")
        self.pkl_path = os.path.join(self.vector_path, "index.pkl")
        self.batch_size = 5

        # * FACE IMAGES
        self.face_images_path = os.path.join(self.project_dir, f"storage/{admin_id}/face-images")

        # * BLOB MATCHING
        self.sure_know = 5
        self.sure_unknown = 5
        self.blob_life_time = 5
        self.blob_distance_threshold = 250

        # * RECOGNITION
        self.recognition_k_neighbors = 5
        self.UNKNOWN = "UNKNOWN"

        # * FACE TRACKING RESULT
        self.ERROR = "ERROR"
        self.NOT_FOUND = "NOT_FOUND"
        self.SESSION_END = "SESSION_END"
        self.ALREADY_LOGGED = "ALREADY_LOGGED"
        self.FOUND_PERSON = "FOUND_PERSON"
        self.FOUND_UNKNOWN = "FOUND_UNKNOWN"
        self.FOUND_PERSON_AND_UNKNOWN = "FOUND_PERSON_AND_UNKNOWN"

        # * REDIS STATUS
        self.EXISTS = "EXISTS"
        self.SET = "SET"
