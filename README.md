# Face Scanning System

A face detection system with React frontend and FastAPI backend.

## Client (React + Vite)

### Setup
```bash
cd client
npm install
npm run dev
```

The client will run on `http://localhost:3000`

### Features
- Camera access and live video feed
- YOLO face detection using ONNX Runtime Web
- Sends frames to server for display

## Server (FastAPI)

### Setup
```bash
cd sever
pip install -r requirements.txt
python app.py
```

The server will run on `http://localhost:8000`

### Features
- Receives images from client
- Displays received images using cv2.imshow

## Usage

1. Start the FastAPI server:
   ```bash
   cd sever
   python app.py
   ```

2. Start the React client:
   ```bash
   cd client
   npm run dev
   ```

3. Open your browser to `http://localhost:3000`
4. Allow camera access when prompted
5. The system will automatically detect faces and send frames to the server
6. Check the server terminal window to see the cv2.imshow display

## Notes

- Make sure your camera is not being used by another application
- The ONNX model (yolov12n-face.onnx) must be in the client/public folder
- The server needs X11 display for cv2.imshow to work (Linux/Mac)
