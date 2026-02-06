import os
import cv2
import time

# from app.core.face_tracking import FaceTracking

os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"


def main():
    # Initialize face tracking service
    # tracking = FaceTracking()
    # tracking.load_faiss_index()

    # Setup camera
    # === WINDOWS ===
    cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)

    # === MACOS ===
    # cap = cv2.VideoCapture(0, cv2.CAP_AVFOUNDATION)

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 960)
    target_fps = 1000
    frame_time = 1.0 / target_fps  # เวลาต่อเฟรม

    try:
        while cap.isOpened():
            start_time = time.time()
            ret, frame = cap.read()
            if not ret:
                break

            # result = tracking.tracking_face(frame)
            # cv2.imshow("Face Tracking", result)

            # จำกัด FPS โดยประมาณ
            elapsed = time.time() - start_time
            remaining_time = max(0, frame_time - elapsed)
            time.sleep(remaining_time)

            if cv2.waitKey(1) & 0xFF == ord("q"):
                break

    finally:
        cap.release()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
