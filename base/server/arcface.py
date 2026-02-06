# arcface.py (เวอร์ชันแก้ไขล่าสุด)

import insightface
from insightface.app import FaceAnalysis
import numpy as np
import cv2

class ArcFaceEmbedder:
    def __init__(self, model_name="buffalo_l", ctx_id=0):
        print("Loading ArcFace model...")
        self.app = FaceAnalysis(
            name=model_name,
            providers=["CUDAExecutionProvider", "CPUExecutionProvider"]
        )
        self.app.prepare(ctx_id=ctx_id, det_size=(640, 640))
        self.input_size = (112, 112)

    def get_embedding(self, image, skip_detection=False, return_face=False):
        if skip_detection:
            try:
                # 1. Resize เป็น 112x112
                img = cv2.resize(image, self.input_size, interpolation=cv2.INTER_LINEAR)
                
                # 2. BGR → RGB (InsightFace ใช้ RGB!)
                img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
                
                # 3. Convert to float and normalize to [0, 1]
                img_float = img_rgb.astype(np.float32) / 255.0
                
                # 4. Subtract mean and divide by std (ตามที่ InsightFace ใช้)
                # จาก source code: mean=[0.5, 0.5, 0.5], std=[0.5, 0.5, 0.5]
                img_norm = (img_float - 0.5) / 0.5  # → [-1, 1]
                
                # 5. HWC → CHW
                img_chw = np.transpose(img_norm, (2, 0, 1))
                img_input = np.expand_dims(img_chw, axis=0)  # (1, 3, 112, 112)

                # 6. Forward
                embedding = self.app.models["recognition"].forward(img_input)
                embedding = embedding[0]  # (512,)
                
                # 7. L2 normalize (สำคัญมาก!)
                embedding = embedding / np.linalg.norm(embedding)
                
                return embedding.astype(np.float32)
                
            except Exception as e:
                print(f"[WARN] Failed to embed cropped face: {e}")
                return None
        else:
            faces = self.app.get(image)
            if len(faces) == 0:
                return None
            
            embedding = faces[0].embedding.astype(np.float32)
            
            if return_face:
                # Get face bounding box and crop
                bbox = faces[0].bbox.astype(int)
                x1, y1, x2, y2 = bbox
                cropped_face = image[y1:y2, x1:x2]
                return embedding, cropped_face
            
            # faces[0].embedding ถูก normalize แล้วโดย InsightFace
            return embedding