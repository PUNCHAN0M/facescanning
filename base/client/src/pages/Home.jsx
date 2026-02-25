import React, { useRef, useEffect, useState } from 'react';
import * as ort from 'onnxruntime-web';
import '../App.css';

function Home() {
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
  const [confirmedPerson, setConfirmedPerson] = useState('N/A');
  const [sessionId, setSessionId] = useState(null);

  // Modal and forms
  const [showModal, setShowModal] = useState(false);
  const [currentMember, setCurrentMember] = useState(null);
  const [memberImages, setMemberImages] = useState([]);
  const [newOrganizeName, setNewOrganizeName] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const videoModalRef = useRef(null);
  const [isCameraOn, setIsCameraOn] = useState(false);

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
    
    // สร้าง session_id ครั้งเดียวตอนเริ่มต้น
    if (!sessionId) {
      setSessionId(crypto.randomUUID());
    }

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
     ORGANIZE & MEMBER MANAGEMENT
  ========================= */
  const handleAddOrganize = async () => {
    if (!newOrganizeName.trim()) {
      alert('กรุณากรอกชื่อ organize');
      return;
    }

    try {
      const res = await fetch(`http://localhost:8000/organize/create?organize_name=${encodeURIComponent(newOrganizeName)}`, {
        method: 'POST'
      });
      const data = await res.json();
      
      if (res.ok) {
        alert(data.message);
        setNewOrganizeName('');
        await fetchOrganizes();
      } else {
        alert(data.detail || 'เกิดข้อผิดพลาด');
      }
    } catch (e) {
      console.error('Failed to create organize:', e);
      alert('เกิดข้อผิดพลาดในการสร้าง organize');
    }
  };

  const handleAddMember = async () => {
    if (!selectedOrganize) {
      alert('กรุณาเลือก organize ก่อน');
      return;
    }
    
    if (!newMemberName.trim()) {
      alert('กรุณากรอกชื่อสมาชิก');
      return;
    }

    try {
      const res = await fetch(`http://localhost:8000/organize/${selectedOrganize}/member?person_name=${encodeURIComponent(newMemberName)}`, {
        method: 'POST'
      });
      const data = await res.json();
      
      if (res.ok) {
        alert(data.message);
        setNewMemberName('');
        await fetchOrganizeDetails(selectedOrganize);
      } else {
        alert(data.detail || 'เกิดข้อผิดพลาด');
      }
    } catch (e) {
      console.error('Failed to create member:', e);
      alert('เกิดข้อผิดพลาดในการเพิ่มสมาชิก');
    }
  };

  const handleEditOrganize = async (oldName) => {
    const newName = prompt('กรุณากรอกชื่อ organize ใหม่:', oldName);
    if (!newName || newName.trim() === '' || newName === oldName) return;

    try {
      const response = await fetch(
        `http://localhost:8000/organize/${encodeURIComponent(oldName)}/rename?new_name=${encodeURIComponent(newName)}`,
        { method: 'PUT' }
      );

      if (response.ok) {
        alert('เปลี่ยนชื่อ organize สำเร็จ');
        if (selectedOrganize === oldName) {
          setSelectedOrganize(newName);
        }
        await fetchOrganizes();
      } else {
        const data = await response.json();
        alert(`เกิดข้อผิดพลาด: ${data.detail}`);
      }
    } catch (error) {
      console.error('Error renaming organize:', error);
      alert('เกิดข้อผิดพลาดในการเปลี่ยนชื่อ organize');
    }
  };

  const handleDeleteOrganize = async (organizeName) => {
    if (!confirm(`ต้องการลบ organize "${organizeName}" หรือไม่?\n\n⚠️ การลบจะลบข้อมูลทั้งหมดภายใน organize นี้`)) {
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:8000/organize/${encodeURIComponent(organizeName)}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        alert('ลบ organize สำเร็จ');
        if (selectedOrganize === organizeName) {
          setSelectedOrganize('');
          setMembers([]);
        }
        await fetchOrganizes();
      } else {
        const data = await response.json();
        alert(`เกิดข้อผิดพลาด: ${data.detail}`);
      }
    } catch (error) {
      console.error('Error deleting organize:', error);
      alert('เกิดข้อผิดพลาดในการลบ organize');
    }
  };

  const handleEditMember = async (member) => {
    const newName = prompt('กรุณากรอกชื่อสมาชิกใหม่:', member.person_name);
    if (!newName || newName.trim() === '' || newName === member.person_name) return;

    try {
      const response = await fetch(
        `http://localhost:8000/organize/${encodeURIComponent(selectedOrganize)}/member/${encodeURIComponent(member.person_name)}/rename?new_name=${encodeURIComponent(newName)}`,
        { method: 'PUT' }
      );

      if (response.ok) {
        const data = await response.json();
        alert(data.message);
        await fetchOrganizeDetails(selectedOrganize);
      } else {
        const data = await response.json();
        alert(`เกิดข้อผิดพลาด: ${data.detail}`);
      }
    } catch (error) {
      console.error('Error renaming member:', error);
      alert('เกิดข้อผิดพลาดในการเปลี่ยนชื่อสมาชิก');
    }
  };

  const handleDeleteMember = async (member) => {
    if (!confirm(`ต้องการลบสมาชิก "${member.person_name}" หรือไม่?\n\n⚠️ การลบจะลบรูปภาพทั้งหมดของสมาชิกนี้`)) {
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:8000/organize/${encodeURIComponent(selectedOrganize)}/member/${encodeURIComponent(member.person_name)}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        const data = await response.json();
        alert(data.message);
        await fetchOrganizeDetails(selectedOrganize);
      } else {
        const data = await response.json();
        alert(`เกิดข้อผิดพลาด: ${data.detail}`);
      }
    } catch (error) {
      console.error('Error deleting member:', error);
      alert('เกิดข้อผิดพลาดในการลบสมาชิก');
    }
  };

  /* =========================
     IMAGE MANAGEMENT
  ========================= */
  const openImageModal = async (member) => {
    setCurrentMember(member);
    setShowModal(true);
    await fetchMemberImages(member.person_name);
  };

  const closeModal = () => {
    setShowModal(false);
    setCurrentMember(null);
    setMemberImages([]);
    setSelectedFile(null);
    stopCamera();
  };

  const fetchMemberImages = async (personName) => {
    try {
      const res = await fetch(`http://localhost:8000/organize/${selectedOrganize}/member/${personName}/images`);
      const data = await res.json();
      setMemberImages(data.images || []);
    } catch (e) {
      console.error('Failed to fetch images:', e);
    }
  };

  const handleFileSelect = (e) => {
    setSelectedFile(e.target.files[0]);
  };

  const handleUploadImage = async () => {
    if (!selectedFile && !isCameraOn) {
      alert('กรุณาเลือกไฟล์หรือถ่ายภาพ');
      return;
    }

    setIsUploading(true);
    const fd = new FormData();
    
    if (selectedFile) {
      fd.append('file', selectedFile);
    } else if (isCameraOn && videoModalRef.current) {
      // Capture from camera
      const canvas = document.createElement('canvas');
      canvas.width = videoModalRef.current.videoWidth;
      canvas.height = videoModalRef.current.videoHeight;
      canvas.getContext('2d').drawImage(videoModalRef.current, 0, 0);
      
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg'));
      fd.append('file', blob, 'captured.jpg');
    }

    try {
      const res = await fetch(
        `http://localhost:8000/organize/${selectedOrganize}/member/${currentMember.person_name}/upload`,
        { method: 'POST', body: fd }
      );
      const data = await res.json();
      
      if (res.ok) {
        alert('อัปโหลดสำเร็จ');
        setSelectedFile(null);
        await fetchMemberImages(currentMember.person_name);
        await fetchOrganizeDetails(selectedOrganize);
      } else {
        alert(data.detail || 'เกิดข้อผิดพลาด');
      }
    } catch (e) {
      console.error('Upload error:', e);
      alert('เกิดข้อผิดพลาดในการอัปโหลด');
    }
    setIsUploading(false);
  };

  const handleDeleteImage = async (filename) => {
    if (!confirm(`ต้องการลบภาพ ${filename} หรือไม่?`)) return;

    try {
      const res = await fetch(
        `http://localhost:8000/organize/${selectedOrganize}/member/${currentMember.person_name}/image/${filename}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      
      if (res.ok) {
        alert('ลบสำเร็จ');
        await fetchMemberImages(currentMember.person_name);
        await fetchOrganizeDetails(selectedOrganize);
      } else {
        alert(data.detail || 'เกิดข้อผิดพลาด');
      }
    } catch (e) {
      console.error('Delete error:', e);
      alert('เกิดข้อผิดพลาดในการลบ');
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoModalRef.current.srcObject = stream;
      setIsCameraOn(true);
    } catch (e) {
      console.error('Camera error:', e);
      alert('ไม่สามารถเปิดกล้องได้');
    }
  };

  const stopCamera = () => {
    if (videoModalRef.current?.srcObject) {
      videoModalRef.current.srcObject.getTracks().forEach(t => t.stop());
      setIsCameraOn(false);
    }
  };

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
      
      isUploadingRef.current = true; // Mark as uploading
      
      try {
        // Build URL with query parameters
        let url = 'http://localhost:8000/upload?';
        if (selectedOrganize) {
          url += `organize_name=${encodeURIComponent(selectedOrganize)}&`;
        }
        if (sessionId) {
          url += `session_id=${encodeURIComponent(sessionId)}`;
        }
        
        const response = await fetch(url, {
          method: 'POST',
          body: fd
        });
        const result = await response.json();
        
        // Update detection result
        if (result.status === 'success' || result.status === 'unknown') {
          setPersonDetection(result.person || 'Unknown');
          setConfidenceDetection(result.similarity ? (result.similarity * 100).toFixed(2) + '%' : 'N/A');
          
          // Update confirmed person
          setConfirmedPerson(result.confirmed_person || 'กำลังตรวจสอบ...');
        } else if (result.status === 'no_face') {
          setPersonDetection('No face detected');
          setConfidenceDetection('N/A');
          setConfirmedPerson('N/A');
        } else if (result.status === 'error') {
          console.warn('Server error:', result.message);
        }
      } catch (e) {
        console.error('Upload error:', e);
        setPersonDetection('Error');
        setConfidenceDetection('N/A');
        setConfirmedPerson('N/A');
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
      <h1>Face Detection</h1>
      <p>{status}</p>

      <div className="video-container">
        <video ref={videoRef} autoPlay playsInline muted />
        <canvas ref={canvasRef} />
      </div>

{organizes && organizes.length > 0 &&
      <button onClick={() => setIsRunning(v => !v)} disabled={!session}>
        {isRunning ? 'Stop Detection' : 'Start Detection'}
      </button>
}      
      {/* Detection Result Display */}
      <div className="detection-result">
        <h3>Detection Result</h3>
        <p><strong>Current Detection:</strong> {personDetection}</p>
        <p><strong>Confidence:</strong> {confidenceDetection}</p>
        <p><strong>✅ Confirmed Person:</strong> <span style={{ color: confirmedPerson !== 'N/A' && confirmedPerson !== 'กำลังตรวจสอบ...' ? '#00AA00' : 'inherit', fontWeight: 'bold' }}>{confirmedPerson}</span></p>
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
          {selectedOrganize && (
            <div style={{ display: 'inline-block', marginLeft: '10px' }}>
              <button 
                onClick={() => handleEditOrganize(selectedOrganize)}
                style={{ backgroundColor: '#ffa500', color: 'white', marginRight: '5px', padding: '5px 10px', border: 'none', cursor: 'pointer', borderRadius: '3px' }}
              >
                แก้ไข
              </button>
              <button 
                onClick={() => handleDeleteOrganize(selectedOrganize)}
                style={{ backgroundColor: '#dc3545', color: 'white', padding: '5px 10px', border: 'none', cursor: 'pointer', borderRadius: '3px' }}
              >
                ลบ
              </button>
            </div>
          )}
          <div className="add-organize">
            <input
              type="text"
              placeholder="ชื่อ organize ใหม่"
              value={newOrganizeName}
              onChange={(e) => setNewOrganizeName(e.target.value)}
            />
            <button onClick={handleAddOrganize}>เพิ่ม organize ใหม่</button>
          </div>
        </div>

        {selectedOrganize && (
          <>
            <h3>Members in {selectedOrganize}</h3>
            <div className="add-member">
              <input
                type="text"
                placeholder="ชื่อสมาชิกใหม่"
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
              />
              <button onClick={handleAddMember}>เพิ่มสมาชิกใหม่</button>
            </div>

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
                      <td>
                        <button 
                          onClick={() => handleEditMember(member)}
                          style={{ backgroundColor: '#ffa500', color: 'white', padding: '5px 10px', border: 'none', cursor: 'pointer', borderRadius: '3px' }}
                        >
                          แก้ไข
                        </button>
                      </td>
                      <td>
                        <button onClick={() => openImageModal(member)}>
                          {member.image_count > 0 ? 'แก้ไขรูปภาพ' : 'เพิ่มรูปภาพ'}
                        </button>
                      </td>
                      <td>
                        <button 
                          onClick={() => handleDeleteMember(member)}
                          style={{ backgroundColor: '#dc3545', color: 'white', padding: '5px 10px', border: 'none', cursor: 'pointer', borderRadius: '3px' }}
                        >
                          ลบ
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>ไม่พบสมาชิกใน organize นี้</p>
            )}

{members.length > 0 &&
            <button 
              onClick={handleRebuildVectors} 
              disabled={isRebuilding}
              className="rebuild-button"
            >
              {isRebuilding ? 'กำลังบีบอัด...' : 'บีบอัด Vector'}
            </button>}
          </>
        )}
      </div>

      {/* Image Management Modal */}
      {showModal && currentMember && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <span className="close" onClick={closeModal}>&times;</span>
            <h2>จัดการรูปภาพของ {currentMember.person_name}</h2>
            <p>Organize: {selectedOrganize}</p>

            <div className="upload-section">
              <h3>เพิ่มรูปภาพ</h3>
              
              <div className="upload-options">
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    disabled={isUploading || isCameraOn}
                  />
                  {selectedFile && <span>✓ {selectedFile.name}</span>}
                </div>

                <div className="camera-section">
                  {!isCameraOn ? (
                    <button onClick={startCamera} disabled={isUploading || selectedFile}>
                      📷 เปิดกล้อง
                    </button>
                  ) : (
                    <>
                      <button onClick={stopCamera}>ปิดกล้อง</button>
                      <video
                        ref={videoModalRef}
                        autoPlay
                        playsInline
                        style={{ width: '100%', maxWidth: '400px', marginTop: '10px' }}
                      />
                    </>
                  )}
                </div>
              </div>

              <button
                onClick={handleUploadImage}
                disabled={isUploading || (!selectedFile && !isCameraOn)}
                className="upload-button"
              >
                {isUploading ? 'กำลังอัปโหลด...' : 'อัปโหลด'}
              </button>
            </div>

            <div className="images-section">
              <h3>รูปภาพทั้งหมด ({memberImages.length})</h3>
              {memberImages.length > 0 ? (
                <div className="image-grid">
                  {memberImages.map((imgName) => (
                    <div key={imgName} className="image-item">
                      <img
                        src={`http://localhost:8000/organize/${selectedOrganize}/member/${currentMember.person_name}/image/${imgName}`}
                        alt={imgName}
                      />
                      <button
                        onClick={() => handleDeleteImage(imgName)}
                        className="delete-btn"
                      >
                        🗑️ ลบ
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p>ยังไม่มีรูปภาพ</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
