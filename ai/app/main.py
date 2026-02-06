from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from fastapi.routing import APIRoute
import os

from app.api import api_router
from app.configs.app_config import app_config

os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"


def custom_generate_unique_id(route: APIRoute) -> str:
    """
    ฟังก์ชันสำหรับสร้าง unique ID ให้กับ route เพื่อใช้ใน OpenAPI/Swagger UI
    """
    if route.tags:
        return f"{route.tags[0]}-{route.name}"
    return route.name


app = FastAPI(
    title=app_config.PROJECT_NAME,
    openapi_url=f"{app_config.API_STR}/openapi.json",
    generate_unique_id_function=custom_generate_unique_id,
)

if app_config.all_cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=app_config.all_cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(api_router, prefix=app_config.API_STR)


@app.get("/")
async def root():
    return {"message": "Welcome to the AI for Face ID Office!"}
