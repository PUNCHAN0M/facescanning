import React, { useRef, useEffect, useState } from 'react';
import * as ort from 'onnxruntime-web';
import './App.css';

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [session, setSession] = useState(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState('Loading model...');

  // Organization management
  const [organizes, setOrganizes] = useState([]);
  const [selectedOrganize, setSelectedOrganize] = useState('');
  const [members, setMembers] = useState([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isRebuilding, setIsRebuilding] = useState(false);

  // Detection result
  const [personDetection, setPersonDetection] = useState('N/A');
  const [confidenceDetection, setConfidenceDetection] = useState('N/A');

  // Upload control - prevent queue buildup
  const isUploadingRef = useRef(false);

  // rAF control
  const rafIdRef = useRef(null);
  const lastDetectTimeRef = useRef(0);
  const DETECT_INTERVAL = 500; // ms (~2 FPS) - ลดลงสำหรับ production

  /* =========================
     INIT
  ========================= */
  useEffect(() => {
    loadModel();
    setupCamera();
    fetchOrganizes();

    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const loadModel = async () => {
    try {
      const s = await ort.InferenceSession.create('/yolov12n-face.onnx');
      setSession(s);
      setStatus('Model loaded. Ready.');
    } catch (e) {
      setStatus('Failed to load model');
      console.error(e);
    }
  };

  const setupCamera = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 }
    });
    videoRef.current.srcObject = stream;
  };

  /* =========================
     FETCH DATA
  ========================= */
  const fetchOrganizes = async () => {
    try {
      const res = await fetch('http://localhost:8000/organizes');
      const data = await res.json();
      setOrganizes(data.organizes || []);
    } catch (e) {
      console.error('Failed to fetch organizes:', e);
    }
  };

  const fetchOrganizeDetails = async (organizeName) => {
    if (!organizeName) return;
    
    setIsLoadingMembers(true);
    try {
      const res = await fetch(`http://localhost:8000/organize/${organizeName}/details`);
      const data = await res.json();
      setMembers(data.members || []);
    } catch (e) {
      console.error('Failed to fetch organize details:', e);
      setMembers([]);
    }
    setIsLoadingMembers(false);
  };

  const handleRebuildVectors = async () => {
    if (!selectedOrganize) {
      alert('กรุณาเลือก organize ก่อน');
      return;
    }

    if (!confirm(`ต้องการบีบอัด vector ของ ${selectedOrganize} หรือไม่?`)) {
      return;
    }

    setIsRebuilding(true);
    try {
      const res = await fetch(`http://localhost:8000/organize/${selectedOrganize}/rebuild`, {
        method: 'POST'
      });
      const data = await res.json();
      alert(data.message);
      // Refresh data
      await fetchOrganizeDetails(selectedOrganize);
    } catch (e) {
      console.error('Failed to rebuild vectors:', e);
      alert('เกิดข้อผิดพลาดในการบีบอัด vector');
    }
    setIsRebuilding(false);
  };

  useEffect(() => {
    if (selectedOrganize) {
      fetchOrganizeDetails(selectedOrganize);
    } else {
      setMembers([]);
    }
  }, [selectedOrganize]);

  /* =========================
     PREPROCESS
  ========================= */
  const preprocessImage = (video) => {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    c.width = 640;
    c.height = 640;

    ctx.drawImage(video, 0, 0, 640, 640);
    const { data } = ctx.getImageData(0, 0, 640, 640);

    const r = [], g = [], b = [];
    for (let i = 0; i < data.length; i += 4) {
      r.push(data[i] / 255);
      g.push(data[i + 1] / 255);
      b.push(data[i + 2] / 255);
    }

    return new ort.Tensor('float32', [...r, ...g, ...b], [1, 3, 640, 640]);
  };

  /* =========================
     DETECT
  ========================= */
  const detectFaces = async () => {
    if (!session || !videoRef.current || isDetecting) return;

    setIsDetecting(true);
    try {
      const tensor = preprocessImage(videoRef.current);
      const result = await session.run({ images: tensor });
      const output = result[Object.keys(result)[0]];
      const boxes = drawDetections(output);

      if (boxes.length > 0) {
        sendCroppedFaces(boxes);
      }
    } catch (e) {
      console.error('detect error', e);
    }
    setIsDetecting(false);
  };

  /* =========================
     DRAW
  ========================= */
  const drawDetections = (output) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return [];

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const data = output.data;
    const [, numBoxes, values] = output.dims;

    let largestFace = null;
    let maxArea = 0;

    for (let i = 0; i < numBoxes; i++) {
      const idx = i * values;
      const conf = data[idx + 4];
      if (conf < 0.5) continue;

      const scaleX = video.videoWidth / 640;
      const scaleY = video.videoHeight / 640;

      const x1 = data[idx] * scaleX;
      const y1 = data[idx + 1] * scaleY;
      const x2 = data[idx + 2] * scaleX;
      const y2 = data[idx + 3] * scaleY;

      const height = y2 - y1;
      const width = x2 - x1;
      const area = width * height;

      // เงื่อนไข: ความสูง > 200px และพื้นที่ใหญ่ที่สุด
      if (height > 150 && area > maxArea) {
        maxArea = area;
        largestFace = { x1, y1, x2, y2, conf };
      }
    }

    // วาดและคืนค่าใบหน้าที่ใหญ่ที่สุด (ถ้ามี)
    if (largestFace) {
      const { x1, y1, x2, y2, conf } = largestFace;

      ctx.strokeStyle = '#00FF00';
      ctx.lineWidth = 2;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      ctx.fillStyle = '#00FF00';
      ctx.fillText(`${(conf * 100).toFixed(1)}%`, x1, y1 - 5);

      return [largestFace]; // ส่งเป็น array แต่มีแค่ 1 รายการ
    }

    return []; // ไม่มีใบหน้าที่ตรงเงื่อนไข
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  /* =========================
     SEND TO SERVER
  ========================= */
  const sendCroppedFaces = async (boxes) => {
    if (boxes.length === 0) return;

    // Skip if already uploading to prevent queue buildup
    if (isUploadingRef.current) {
      console.log('Skipping upload - previous request still processing');
      return;
    }

    const v = videoRef.current;
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');

    // ขยาย bbox ออกไปอีกด้านละ 50px
    const { x1, y1, x2, y2 } = boxes[0];
    const padding = 50;
    
    const expandedX1 = Math.max(0, x1 - padding);
    const expandedY1 = Math.max(0, y1 - padding);
    const expandedX2 = Math.min(v.videoWidth, x2 + padding);
    const expandedY2 = Math.min(v.videoHeight, y2 + padding);
    
    const w = expandedX2 - expandedX1;
    const h = expandedY2 - expandedY1;

    // Crop ภาพตาม bbox ที่ขยายแล้ว
    c.width = w;
    c.height = h;
    ctx.drawImage(v, expandedX1, expandedY1, w, h, 0, 0, w, h);

    c.toBlob(async (blob) => {
      const fd = new FormData();
      fd.append('file', blob, 'expanded_face.jpg');
      
      // Add organize_name if selected
      if (selectedOrganize) {
        fd.append('organize_name', selectedOrganize);
      }
      
      isUploadingRef.current = true; // Mark as uploading
      
      try {
        const response = await fetch('http://localhost:8000/upload', {
          method: 'POST',
          body: fd
        });
        const result = await response.json();
        
        // Update detection result
        if (result.status === 'success') {
          setPersonDetection(result.person);
          setConfidenceDetection((result.similarity * 100).toFixed(2) + '%');
        } else if (result.status === 'unknown') {
          setPersonDetection('Unknown');
          setConfidenceDetection(result.similarity ? (result.similarity * 100).toFixed(2) + '%' : 'N/A');
        } else if (result.status === 'no_face') {
          setPersonDetection('No face detected');
          setConfidenceDetection('N/A');
        } else if (result.status === 'error') {
          console.warn('Server error:', result.message);
        }
      } catch (e) {
        console.error('Upload error:', e);
        setPersonDetection('Error');
        setConfidenceDetection('N/A');
      } finally {
        isUploadingRef.current = false; // Release lock
      }
    }, 'image/jpeg', 0.8); // 0.8 = 80% quality สำหรับ compression
  };

  /* =========================
     rAF LOOP
  ========================= */
  const detectLoop = async (time) => {
    if (!isRunning) return;

    if (time - lastDetectTimeRef.current >= DETECT_INTERVAL) {
      lastDetectTimeRef.current = time;
      await detectFaces();
    }

    rafIdRef.current = requestAnimationFrame(detectLoop);
  };

  useEffect(() => {
  if (isRunning) {
    rafIdRef.current = requestAnimationFrame(detectLoop);
  } else {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    clearCanvas();
  }
}, [isRunning]);

  /* =========================
     UI
  ========================= */
  return (
    <div className="App">
      <h1>YOLO Face Detection</h1>
      <p>{status}</p>

      <div className="video-container">
        <video ref={videoRef} autoPlay playsInline muted />
        <canvas ref={canvasRef} />
      </div>

      <button onClick={() => setIsRunning(v => !v)} disabled={!session}>
        {isRunning ? 'Stop Detection' : 'Start Detection'}
      </button>
      
      {/* Detection Result Display */}
      <div className="detection-result">
        <h3>Detection Result</h3>
        <p><strong>Current Detection:</strong> {personDetection}</p>
        <p><strong>Confidence:</strong> {confidenceDetection}</p>
      </div>
      {/* Organize Management */}
      <div className="organize-section">
        <h2>Organize Management</h2>
        
        <div className="organize-selector">
          <label>เลือก Organize:</label>
          <select 
            value={selectedOrganize} 
            onChange={(e) => setSelectedOrganize(e.target.value)}
          >
            <option value="">-- เลือก organize --</option>
            {organizes.map((org) => (
              <option key={org} value={org}>{org}</option>
            ))}
          </select>
          <span style={{ marginLeft: '10px' }}>
            ({organizes.length} organize{organizes.length !== 1 ? 's' : ''})
          </span>
        </div>

        {selectedOrganize && (
          <>
            <h3>Members in {selectedOrganize}</h3>
            {isLoadingMembers ? (
              <p>Loading...</p>
            ) : members.length > 0 ? (
              <table className="members-table">
                <thead>
                  <tr>
                    <th>Person Name</th>
                    <th>จำนวนภาพ</th>
                    <th>จำนวน Vector</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.person_name}>
                      <td>{member.person_name}</td>
                      <td>{member.image_count}</td>
                      <td>{member.vector_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>ไม่พบสมาชิกใน organize นี้</p>
            )}

            <button 
              onClick={handleRebuildVectors} 
              disabled={isRebuilding}
              className="rebuild-button"
            >
              {isRebuilding ? 'กำลังบีบอัด...' : 'บีบอัด Vector'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
