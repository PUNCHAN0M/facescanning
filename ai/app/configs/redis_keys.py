class RedisKeys:
    def __init__(self):
        self.admin_prefix = "admin"
        self.camera_prefix = "camera"
        self.person_prefix = "person"
        self.tracking_suffix = "tracking"


redis_keys = RedisKeys()
