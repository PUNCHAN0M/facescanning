from typing import Dict
import asyncio
import json
import cv2
import numpy
import base64

from fastapi import WebSocket, WebSocketDisconnect

from app.configs.core_config import CoreConfig
from app.core.face_tracking import FaceTracking


class WebsocketService:
    _active_connections: Dict[str, WebSocket] = {}
    _latest_frame: Dict[str, bytes] = {}

    def __init__(self, core_config: CoreConfig, face_tracking: FaceTracking, session_duration: int):
        self.core_config = core_config
        self.session_duration = session_duration
        self.face_tracking = face_tracking

    def _get_connection_key(self) -> str:
        return f"{self.core_config.admin_id}-{self.core_config.camera_id}-{self.core_config.session_id}"

    async def websocket_connection(self, websocket: WebSocket):
        connection_key = self._get_connection_key()
        WebsocketService._active_connections[connection_key] = websocket

        self.face_tracking.load_faiss_index()
        print(
            f"[CONNECTED] WebSocket \n admin_id: {self.core_config.admin_id} \n camera_id: {self.core_config.camera_id} \n session_id: {self.core_config.session_id} \n ==="
        )

        try:
            await asyncio.wait_for(
                self._process_websocket_frames(websocket, connection_key),
                timeout=self.session_duration,
            )
        except asyncio.TimeoutError:
            print(
                f"[TIMEOUT] WebSocket session for {connection_key} ended after {self.session_duration} seconds."
            )
        except Exception as e:
            print(
                f"[ERROR] WebSocket \n admin_id: {self.core_config.admin_id} \n camera_id: {self.core_config.camera_id} \n session_id: {self.core_config.session_id} \n error: {e} \n ==="
            )
        finally:
            if connection_key in WebsocketService._active_connections:
                del WebsocketService._active_connections[connection_key]
            if connection_key in WebsocketService._latest_frame:
                del WebsocketService._latest_frame[connection_key]
            print(
                f"[DISCONNECTED] WebSocket \n admin_id: {self.core_config.admin_id} \n camera_id: {self.core_config.camera_id} \n session_id: {self.core_config.session_id} \n ==="
            )

    async def _process_websocket_frames(self, websocket: WebSocket, connection_key: str):
        while True:
            try:
                data = await websocket.receive_bytes()
                WebsocketService._latest_frame[connection_key] = data
            except WebSocketDisconnect:
                # ! print(f"[INFO] Client disconnected for {connection_key}")
                break
            except asyncio.TimeoutError:
                pass
            except Exception as e:
                print(f"[INNER_ERROR] receiving data for {connection_key}: {e}")
                break

            if connection_key in WebsocketService._latest_frame:
                data_to_process = WebsocketService._latest_frame[connection_key]
                try:
                    await self._process_and_send_frame(websocket, data_to_process, connection_key)
                except Exception as frame_e:
                    print(f"[INNER_ERROR] processing frame for {connection_key}: {frame_e}")

                    try:
                        await websocket.send_json(
                            {"type": "error", "message": f"Error processing frame: {frame_e}"}
                        )
                    except RuntimeError:
                        pass
                    break

            await asyncio.sleep(0.05)

    async def _process_and_send_frame(self, websocket: WebSocket, data: bytes, connection_key: str):
        try:
            nparr = numpy.frombuffer(data, numpy.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if frame is None:
                print(f"[WARNING] Could not decode frame for {connection_key}")
                return

            frame = cv2.resize(frame, (640, 480))
            annotation, result = await self.face_tracking.tracking_face(frame)

            display_frame = annotation if annotation is not None else frame

            _, buffer = cv2.imencode(".jpg", display_frame)
            img_str = base64.b64encode(buffer.tobytes()).decode("utf-8")

            await websocket.send_text(json.dumps({"image": img_str, "result": result}))

        except Exception as inner_e:
            raise inner_e
