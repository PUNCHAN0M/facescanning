import redis
from app.configs.app_config import app_config

try:
    redis_client = redis.Redis(
        host=app_config.REDIS_HOST,
        port=app_config.REDIS_PORT,
        password=app_config.REDIS_PASSWORD,
        db=0,
        decode_responses=True,
    )

    if redis_client.ping():
        print("🚀 Connected to Redis")
except redis.ConnectionError as e:
    print(f"❌ Redis connection error: {e}")
