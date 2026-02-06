from fastapi import APIRouter, WebSocket, HTTPException, status

from app.auth import authenticate_websocket
from app.configs.core_config import CoreConfig
from app.configs.app_config import app_config
from app.configs.redis_keys import redis_keys
from app.services.redis_service import RedisService
from app.services.server_service import ServerService
from app.core.dummy_embedding import dummy_embeddings
from app.core.face_detection import FaceDetection
from app.core.face_embedding import FaceEmbedding
from app.core.face_recognition import FaceRecognition
from app.core.face_tracking import FaceTracking
from app.services.webscoket_service import WebsocketService


router = APIRouter(tags=["WEBSOCKET"])


@router.websocket("/{camera_id}/{session_id}/{session_duration}")
async def websocket_endpoint(
    websocket: WebSocket,
    camera_id: str,
    session_id: str,
    session_duration: int,
):
    """
    จัดการการเชื่อมต่อ WebSocket สำหรับการติดตามใบหน้า โดยมีการยืนยันตัวตน
    และประมวลผลเฟรมวิดีโอ
    """
    await websocket.accept()

    try:
        admin_id, access_token = await authenticate_websocket(websocket, camera_id, session_id)

        if admin_id is None or access_token is None:
            print(
                f"[ERROR] Authentication failed and connection might not be closed properly for {camera_id}/{session_id}"
            )
            await websocket.send_json(
                {"type": "auth_fail", "message": "Authentication failed or token missing"}
            )
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        core_config = CoreConfig(admin_id, camera_id, session_id)
        redis_services = RedisService(core_config, redis_keys)
        server_service = ServerService(app_config, core_config, access_token)
        face_detection = FaceDetection(core_config)
        face_embedding = FaceEmbedding(core_config)
        face_recognition = FaceRecognition(core_config, dummy_embeddings)

        face_tracking = FaceTracking(
            core_config,
            redis_services,
            server_service,
            face_detection,
            face_embedding,
            face_recognition,
        )
        websocket_service = WebsocketService(core_config, face_tracking, session_duration)
        await websocket_service.websocket_connection(websocket)

    except HTTPException:
        pass
    except Exception as e:
        print(
            f"[ERROR] Service initialization or main websocket loop failed for {camera_id}/{session_id}: {e}"
        )
        try:
            await websocket.send_json(
                {"type": "error", "message": f"Server error during session setup or operation: {e}"}
            )
            await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
        except RuntimeError:
            pass
