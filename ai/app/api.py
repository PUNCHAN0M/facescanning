from fastapi import APIRouter


from app.routes import (
    vector_route,
    websocket_route,
)


api_router = APIRouter()

api_router.include_router(vector_route.router)
api_router.include_router(websocket_route.router)
