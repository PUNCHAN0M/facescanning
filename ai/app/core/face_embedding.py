import cv2
import torch
import numpy as np
from PIL import Image
import imagehash
from facenet_pytorch import InceptionResnetV1
from app.configs.core_config import CoreConfig
from app.utils.transform_factory import face_transform


class FaceEmbedding:
    def __init__(self, core_config: CoreConfig):
        self.core_config = core_config
        try:
            self.model_Facenet = (
                InceptionResnetV1(pretrained=self.core_config.face_embedder_model)
                .to(self.core_config.default_device)
                .eval()
            )
            self.transform = face_transform()
            self.embedding_cache = {}
        except Exception as e:
            raise RuntimeError(
                f"Failed to load FaceNet model: {e}. Ensure the model is available and the path is correct."
            )

    def _get_perceptual_hash(self, cropped_image):
        """Generate perceptual hash for a face image"""
        if cropped_image is None or not isinstance(cropped_image, np.ndarray):
            return None
        try:
            pil_img = Image.fromarray(cv2.cvtColor(cropped_image, cv2.COLOR_BGR2RGB))
            phash = imagehash.phash(pil_img)
            return str(phash)
        except Exception as e:
            print(f"[ERROR] Failed to generate perceptual hash: {e}")
            return None

    def image_embedding(self, cropped_image):
        """Generate embedding for a cropped face image with caching"""
        if cropped_image is None or not isinstance(cropped_image, np.ndarray):
            print("[ERROR] Invalid or empty image provided.")
            return None

        # Generate perceptual hash
        face_hash = self._get_perceptual_hash(cropped_image)

        # Check cache first
        if face_hash in self.embedding_cache:
            return self.embedding_cache[face_hash]

        try:
            # Convert OpenCV image (BGR) to PIL RGB image
            pil_img = Image.fromarray(cv2.cvtColor(cropped_image, cv2.COLOR_BGR2RGB))

            # Apply transformations
            tensor = self.transform(pil_img)
            assert isinstance(tensor, torch.Tensor)
            tensor = tensor.unsqueeze(0).to(self.core_config.default_device)

            # Generate embedding
            with torch.no_grad():
                embedding = self.model_Facenet(tensor).cpu().numpy()[0]

            # Store in cache
            self.embedding_cache[face_hash] = embedding
            return embedding

        except Exception as e:
            print(f"[ERROR] Failed to generate embedding: {e}")
            return None
