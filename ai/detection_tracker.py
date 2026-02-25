# detection_tracker.py
from collections import deque, Counter
from typing import Optional


class DetectionTracker:
    """
    ติดตาม detection history และ confirm เมื่อมีชื่อซ้ำกัน >= 5 frame จาก 10 frame ล่าสุด
    
    Auto-reset:
    - ถ้า confirm แล้ว (count >= threshold) จะ reset history อัตโนมัติ
    - ถ้าครบ window_size แล้วแต่ยังไม่ confirm จะ reset เพื่อเริ่มนับใหม่
    """
    def __init__(self, window_size: int = 10, confirm_threshold: int = 5):
        self.window_size = window_size
        self.confirm_threshold = confirm_threshold
        self.history = deque(maxlen=window_size)  # เก็บแค่ 10 frame ล่าสุด
    
    def add_detection(self, person_name: Optional[str]):
        """
        เพิ่มผลลัพธ์ detection (ชื่อคนที่ detect ได้ หรือ None ถ้าไม่มีใคร)
        """
        self.history.append(person_name)
    
    def get_confirmed_person(self) -> Optional[str]:
        """
        ตรวจสอบว่ามีคนใดที่ปรากฏ >= confirm_threshold ครั้งใน window หรือไม่
        Return: ชื่อคนที่ confirm ได้ หรือ None
        
        Auto-reset:
        - ถ้า confirm แล้ว (count >= threshold) จะ reset history อัตโนมัติ
        - ถ้าครบ window_size แล้วแต่ยังไม่ confirm จะ reset เพื่อเริ่มนับใหม่
        """
        if len(self.history) == 0:
            return None
        
        # นับจำนวนครั้งของแต่ละคน (ไม่นับ None)
        counts = Counter([name for name in self.history if name is not None])
        
        # หาคนที่มีจำนวนมากที่สุด
        if not counts:
            # ถ้าไม่มีคนเลย (ทั้งหมดเป็น None) และครบ window แล้ว ให้ reset
            if len(self.history) >= self.window_size:
                self.reset()
            return None
        
        most_common_person, count = counts.most_common(1)[0]
        
        # confirm ถ้า >= threshold
        if count >= self.confirm_threshold:
            # ✅ Confirm แล้ว - reset เพื่อเริ่มนับใหม่
            self.reset()
            return most_common_person
        
        # ถ้าครบ window แล้วแต่ยังไม่ถึง threshold ให้ reset และเริ่มใหม่
        if len(self.history) >= self.window_size:
            self.reset()
        
        return None
    
    def reset(self):
        """ล้าง history"""
        self.history.clear()
