from app.database.redis import redis_client
from app.configs.redis_keys import RedisKeys
from app.configs.core_config import CoreConfig


class RedisService:

    def __init__(self, core_config: CoreConfig, redis_keys: RedisKeys):
        self.redis_keys = redis_keys
        self.core_config = core_config

    def _build_key(self, person_id: str) -> str:
        return f"{self.redis_keys.admin_prefix}:{self.core_config.admin_id}:{self.redis_keys.camera_prefix}:{self.core_config.camera_id}:{self.redis_keys.person_prefix}:{person_id}"

    def _build_marker_key(self) -> str:
        return f"{self.redis_keys.admin_prefix}:{self.core_config.admin_id}:{self.redis_keys.camera_prefix}:{self.core_config.camera_id}:{self.redis_keys.tracking_suffix}"

    async def exists(self, person_id: str) -> dict:
        marker_key = self._build_marker_key()
        key = self._build_key(person_id)

        try:
            if not redis_client.exists(marker_key):
                return {"status": self.core_config.SESSION_END}

            if redis_client.exists(key):
                return {"status": self.core_config.EXISTS}
            else:
                redis_client.set(key, "1")
                return {"status": self.core_config.SET}
        except Exception as e:
            print(f"[ERROR] in redis_service exists: {e}")
            return {"status": self.core_config.ERROR}
