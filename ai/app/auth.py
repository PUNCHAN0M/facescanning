import jwt
import asyncio

from fastapi import WebSocket, HTTPException, status
from typing import Optional, Tuple

from app.configs.app_config import app_config


async def decode_access_token(token: str) -> str:
    """
    Decodes the JWT access token and returns the admin_id (subject).

    Raises:
        HTTPException: If the token is invalid or expired.
    """
    try:
        payload = jwt.decode(token, app_config.SECRET_KEY, algorithms=[app_config.ALGORITHM])
        admin_id: str = payload.get("sub")
        if admin_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials: admin_id not found in token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return admin_id
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials: Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def authenticate_websocket(
    websocket: WebSocket, camera_id: str, session_id: str
) -> Tuple[Optional[str], Optional[str]]:
    """
    จัดการการยืนยันตัวตนสำหรับ WebSocket connection
    ส่งคืน (admin_id, access_token) ถ้าสำเร็จ มิฉะนั้นจะ raise HTTPException หรือปิดการเชื่อมต่อ WebSocket
    """
    try:
        auth_message = await asyncio.wait_for(websocket.receive_json(), timeout=5)

        if auth_message.get("type") == "authenticate" and "token" in auth_message:
            received_token = auth_message["token"]
            try:
                admin_id = await decode_access_token(received_token)
                access_token = received_token
                await websocket.send_json(
                    {"type": "auth_success", "message": "Authentication successful"}
                )
                print(f"[AUTH SUCCESS] Admin {admin_id}")
                return admin_id, access_token
            except HTTPException as e:
                await websocket.send_json({"type": "auth_fail", "message": e.detail})
                print(f"[AUTH FAILED] {e.detail} for {camera_id}/{session_id}")
                raise
        else:
            await websocket.send_json(
                {
                    "type": "auth_fail",
                    "message": "Authentication message expected or invalid format",
                }
            )
            print(f"[AUTH FAILED] Invalid auth message for {camera_id}/{session_id}")
            raise HTTPException(
                status_code=status.WS_1008_POLICY_VIOLATION, detail="Invalid authentication message"
            )

    except asyncio.TimeoutError:
        print(f"[TIMEOUT] No authentication message received for {camera_id}/{session_id}")
        await websocket.send_json({"type": "auth_fail", "message": "Authentication timeout"})
        raise HTTPException(
            status_code=status.WS_1000_NORMAL_CLOSURE, detail="Authentication timeout"
        )
    except Exception as e:
        print(f"[ERROR] Authentication setup error for {camera_id}/{session_id}: {e}")
        await websocket.send_json(
            {"type": "auth_fail", "message": f"Server error during authentication: {e}"}
        )
        raise HTTPException(
            status_code=status.WS_1011_INTERNAL_ERROR,
            detail=f"Server error during authentication: {e}",
        )
