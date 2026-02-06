import httpx
from typing import Optional
from pydantic import BaseModel
import cv2
import numpy


from app.configs.core_config import CoreConfig
from app.configs.app_config import AppConfig


class DetectionLogResponse(BaseModel):
    id: str
    detectedAt: str
    isUnknown: bool
    detectionImagePath: str
    cameraId: str
    sessionId: str
    personId: Optional[str] = None


class ServerService:

    def __init__(self, app_config: AppConfig, core_config: CoreConfig, access_token: str):
        self.app_config = app_config
        self.core_config = core_config
        self.access_token = access_token

    async def create_detection_log(
        self,
        person_id: str,
        detection_image: numpy.ndarray,
    ):

        is_success, buffer = cv2.imencode(".png", detection_image)
        if not is_success:
            print("Error: Could not encode image to JPEG.")
            return False

        image_bytes = buffer.tobytes()
        files = {
            "detectionImage": (
                "detection_log.png",
                image_bytes,
                "image/png",
            )
        }

        data = {
            "cameraId": self.core_config.camera_id,
            "sessionId": self.core_config.session_id,
            "personId": person_id,
        }

        api_url = f"{self.app_config.SERVER_URL}/detection-logs"

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    api_url,
                    headers={"Authorization": f"Bearer {self.access_token}"},
                    files=files,
                    data=data,
                    timeout=30.0,
                )
                response.raise_for_status()

                return True
            except httpx.HTTPStatusError as e:
                print(
                    f"[ERROR] create_detection_log response {e.response.status_code} while requesting {e.request.url!r}."
                )
                print(f"Response text: {e.response.text}")
                return False
            except httpx.RequestError as e:
                print(f"[ERROR] create_detection_log occurred while requesting {e.request.url!r}.")
                return False
            except Exception as e:
                print(f"[ERROR] create_detection_log unexpected error occurred: {e}")
                return False
