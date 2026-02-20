/* eslint-disable no-console */
import * as ort from 'onnxruntime-web';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useOnnxModel } from '../hooks/useOnnxModel';
import type { Member } from '../types/face-detection';
import { preprocessImage } from '../utils/onnx-preprocessing';

const API_BASE_URL = 'http://localhost:8000';

interface FaceBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  conf: number;
}

export default function FaceDetectionPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoModalRef = useRef<HTMLVideoElement>(null);

  const { session, status } = useOnnxModel('/yolov12n-face.onnx');
  const [isDetecting, setIsDetecting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  // Organization management
  const [organizes, setOrganizes] = useState<string[]>([]);
  const [selectedOrganize, setSelectedOrganize] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isRebuilding, setIsRebuilding] = useState(false);

  // Detection result
  const [personDetection, setPersonDetection] = useState('N/A');
  const [confidenceDetection, setConfidenceDetection] = useState('N/A');
  const [confirmedPerson, setConfirmedPerson] = useState('N/A');
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Modal and forms
  const [showModal, setShowModal] = useState(false);
  const [currentMember, setCurrentMember] = useState<Member | null>(null);
  const [memberImages, setMemberImages] = useState<string[]>([]);
  const [newOrganizeName, setNewOrganizeName] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);

  // Upload control
  const isUploadingRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);
  const lastDetectTimeRef = useRef(0);
  const DETECT_INTERVAL = 500;

  // Initialize
  useEffect(() => {
    const currentVideo = videoRef.current;
    setupCamera();
    fetchOrganizes();

    if (!sessionId) {
      setSessionId(crypto.randomUUID());
    }

    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      if (currentVideo?.srcObject) {
        const stream = currentVideo.srcObject as MediaStream;
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [sessionId]);

  const setupCamera = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 },
    });
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  };

  // Fetch organizes
  const fetchOrganizes = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/organizes`);
      const data = await res.json();
      setOrganizes(data.organizes || []);
    } catch (e) {
      console.error('Failed to fetch organizes:', e);
    }
  };

  const fetchOrganizeDetails = async (organizeName: string) => {
    if (!organizeName) return;

    setIsLoadingMembers(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/organize/${organizeName}/details`,
      );
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
      const res = await fetch(
        `${API_BASE_URL}/organize/${selectedOrganize}/rebuild`,
        {
          method: 'POST',
        },
      );
      const data = await res.json();
      alert(data.message);
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

  // Organize CRUD
  const handleAddOrganize = async () => {
    if (!newOrganizeName.trim()) {
      alert('กรุณากรอกชื่อ organize');
      return;
    }

    try {
      const res = await fetch(
        `${API_BASE_URL}/organize/create?organize_name=${encodeURIComponent(newOrganizeName)}`,
        { method: 'POST' },
      );
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
      const res = await fetch(
        `${API_BASE_URL}/organize/${selectedOrganize}/member?person_name=${encodeURIComponent(newMemberName)}`,
        { method: 'POST' },
      );
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

  const handleEditOrganize = async (oldName: string) => {
    const newName = prompt('กรุณากรอกชื่อ organize ใหม่:', oldName);
    if (!newName || newName.trim() === '' || newName === oldName) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/organize/${encodeURIComponent(oldName)}/rename?new_name=${encodeURIComponent(newName)}`,
        { method: 'PUT' },
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

  const handleDeleteOrganize = async (organizeName: string) => {
    if (
      !confirm(
        `ต้องการลบ organize "${organizeName}" หรือไม่?\n\n⚠️ การลบจะลบข้อมูลทั้งหมดภายใน organize นี้`,
      )
    ) {
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/organize/${encodeURIComponent(organizeName)}`,
        {
          method: 'DELETE',
        },
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

  const handleEditMember = async (member: Member) => {
    const newName = prompt('กรุณากรอกชื่อสมาชิกใหม่:', member.person_name);
    if (!newName || newName.trim() === '' || newName === member.person_name)
      return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/organize/${encodeURIComponent(selectedOrganize)}/member/${encodeURIComponent(member.person_name)}/rename?new_name=${encodeURIComponent(newName)}`,
        { method: 'PUT' },
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

  const handleDeleteMember = async (member: Member) => {
    if (
      !confirm(
        `ต้องการลบสมาชิก "${member.person_name}" หรือไม่?\n\n⚠️ การลบจะลบรูปภาพทั้งหมดของสมาชิกนี้`,
      )
    ) {
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/organize/${encodeURIComponent(selectedOrganize)}/member/${encodeURIComponent(member.person_name)}`,
        { method: 'DELETE' },
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

  // Image management
  const openImageModal = async (member: Member) => {
    setCurrentMember(member);
    setShowModal(true);
    await fetchMemberImages(member.person_name);
  };

  const closeModal = () => {
    setShowModal(false);
    setCurrentMember(null);
    setMemberImages([]);
    setSelectedFile(null);
    stopCameraModal();
  };

  const fetchMemberImages = async (personName: string) => {
    try {
      const res = await fetch(
        `${API_BASE_URL}/organize/${selectedOrganize}/member/${personName}/images`,
      );
      const data = await res.json();
      setMemberImages(data.images || []);
    } catch (e) {
      console.error('Failed to fetch images:', e);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(e.target.files?.[0] || null);
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
      const canvas = document.createElement('canvas');
      canvas.width = videoModalRef.current.videoWidth;
      canvas.height = videoModalRef.current.videoHeight;
      canvas.getContext('2d')!.drawImage(videoModalRef.current, 0, 0);

      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), 'image/jpeg'),
      );
      fd.append('file', blob, 'captured.jpg');
    }

    try {
      const res = await fetch(
        `${API_BASE_URL}/organize/${selectedOrganize}/member/${currentMember!.person_name}/upload`,
        { method: 'POST', body: fd },
      );
      const data = await res.json();

      if (res.ok) {
        alert('อัปโหลดสำเร็จ');
        setSelectedFile(null);
        await fetchMemberImages(currentMember!.person_name);
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

  const handleDeleteImage = async (filename: string) => {
    if (!confirm(`ต้องการลบภาพ ${filename} หรือไม่?`)) return;

    try {
      const res = await fetch(
        `${API_BASE_URL}/organize/${selectedOrganize}/member/${currentMember!.person_name}/image/${filename}`,
        { method: 'DELETE' },
      );
      const data = await res.json();

      if (res.ok) {
        alert('ลบสำเร็จ');
        await fetchMemberImages(currentMember!.person_name);
        await fetchOrganizeDetails(selectedOrganize);
      } else {
        alert(data.detail || 'เกิดข้อผิดพลาด');
      }
    } catch (e) {
      console.error('Delete error:', e);
      alert('เกิดข้อผิดพลาดในการลบ');
    }
  };

  const startCameraModal = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoModalRef.current) {
        videoModalRef.current.srcObject = stream;
      }
      setIsCameraOn(true);
    } catch (e) {
      console.error('Camera error:', e);
      alert('ไม่สามารถเปิดกล้องได้');
    }
  };

  const stopCameraModal = () => {
    if (videoModalRef.current?.srcObject) {
      const stream = videoModalRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      setIsCameraOn(false);
    }
  };

  // Face detection
  const drawDetections = useCallback((output: ort.Tensor): FaceBox[] => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return [];

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const data = output.data as Float32Array;
    const [, numBoxes, values] = output.dims;

    let largestFace: FaceBox | null = null;
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

      if (height > 150 && area > maxArea) {
        maxArea = area;
        largestFace = { x1, y1, x2, y2, conf };
      }
    }

    if (largestFace) {
      const { x1, y1, x2, y2, conf } = largestFace;

      ctx.strokeStyle = '#00FF00';
      ctx.lineWidth = 2;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      ctx.fillStyle = '#00FF00';
      ctx.fillText(`${(conf * 100).toFixed(1)}%`, x1, y1 - 5);

      return [largestFace];
    }

    return [];
  }, []);

  const sendCroppedFaces = useCallback(
    async (boxes: FaceBox[]) => {
      if (boxes.length === 0) return;

      if (isUploadingRef.current) {
        console.log('Skipping upload - previous request still processing');
        return;
      }

      const v = videoRef.current!;
      const c = document.createElement('canvas');
      const ctx = c.getContext('2d')!;

      const { x1, y1, x2, y2 } = boxes[0];
      const padding = 50;

      const expandedX1 = Math.max(0, x1 - padding);
      const expandedY1 = Math.max(0, y1 - padding);
      const expandedX2 = Math.min(v.videoWidth, x2 + padding);
      const expandedY2 = Math.min(v.videoHeight, y2 + padding);

      const w = expandedX2 - expandedX1;
      const h = expandedY2 - expandedY1;

      c.width = w;
      c.height = h;
      ctx.drawImage(v, expandedX1, expandedY1, w, h, 0, 0, w, h);

      c.toBlob(
        async (blob) => {
          const fd = new FormData();
          fd.append('file', blob!, 'expanded_face.jpg');

          isUploadingRef.current = true;

          try {
            let url = `${API_BASE_URL}/upload?`;
            if (selectedOrganize) {
              url += `organize_name=${encodeURIComponent(selectedOrganize)}&`;
            }
            if (sessionId) {
              url += `session_id=${encodeURIComponent(sessionId)}`;
            }

            const response = await fetch(url, {
              method: 'POST',
              body: fd,
            });
            const result = await response.json();

            if (result.status === 'success' || result.status === 'unknown') {
              setPersonDetection(result.person || 'Unknown');
              setConfidenceDetection(
                result.similarity
                  ? (result.similarity * 100).toFixed(2) + '%'
                  : 'N/A',
              );
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
            isUploadingRef.current = false;
          }
        },
        'image/jpeg',
        0.8,
      );
    },
    [selectedOrganize, sessionId],
  );

  const detectFaces = useCallback(async () => {
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
  }, [session, isDetecting, drawDetections, sendCroppedFaces]);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const detectLoop = useCallback(
    async (time: number) => {
      if (!isRunning) return;

      if (time - lastDetectTimeRef.current >= DETECT_INTERVAL) {
        lastDetectTimeRef.current = time;
        await detectFaces();
      }

      rafIdRef.current = requestAnimationFrame(detectLoop);
    },
    [detectFaces, isRunning],
  );

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
  }, [isRunning, detectLoop]);

  return (
    <div className='min-h-screen bg-gray-50 p-6'>
      <div className='mx-auto max-w-6xl'>
        <h1 className='mb-2 text-3xl font-bold text-gray-800'>
          Face Detection
        </h1>
        <p className='mb-6 text-gray-600'>{status}</p>

        <div className='relative mb-6 inline-block'>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className='block max-w-full rounded-lg border-2 border-gray-300'
          />
          <canvas
            ref={canvasRef}
            className='pointer-events-none absolute top-0 left-0'
          />
        </div>

        {organizes && organizes.length > 0 && (
          <button
            onClick={() => setIsRunning((v) => !v)}
            disabled={!session}
            className='rounded bg-green-500 px-6 py-3 text-white hover:bg-green-600 disabled:bg-gray-400'
          >
            {isRunning ? 'Stop Detection' : 'Start Detection'}
          </button>
        )}

        {/* Detection Result */}
        <div className='my-6 max-w-md rounded-lg border-2 border-green-500 bg-blue-50 p-4'>
          <h3 className='mb-2 text-lg font-semibold'>Detection Result</h3>
          <p>
            <strong className='text-green-600'>Current Detection:</strong>{' '}
            {personDetection}
          </p>
          <p>
            <strong className='text-green-600'>Confidence:</strong>{' '}
            {confidenceDetection}
          </p>
          <p>
            <strong className='text-green-600'>✅ Confirmed Person:</strong>{' '}
            <span
              className={
                confirmedPerson !== 'N/A' &&
                confirmedPerson !== 'กำลังตรวจสอบ...'
                  ? 'font-bold text-green-700'
                  : ''
              }
            >
              {confirmedPerson}
            </span>
          </p>
        </div>

        {/* Organize Management */}
        <div className='mt-10 rounded-lg bg-white p-6 shadow'>
          <h2 className='mb-4 text-2xl font-bold text-gray-800'>
            Organize Management
          </h2>

          <div className='mb-4 flex items-center gap-3'>
            <label className='font-semibold'>เลือก Organize:</label>
            <select
              value={selectedOrganize}
              onChange={(e) => setSelectedOrganize(e.target.value)}
              className='min-w-50 rounded border border-gray-300 bg-white px-3 py-2'
            >
              <option value=''>-- เลือก organize --</option>
              {organizes.map((org) => (
                <option key={org} value={org}>
                  {org}
                </option>
              ))}
            </select>
            <span>
              ({organizes.length} organize{organizes.length !== 1 ? 's' : ''})
            </span>
            {selectedOrganize && (
              <div className='ml-2 inline-flex gap-2'>
                <button
                  onClick={() => handleEditOrganize(selectedOrganize)}
                  className='rounded bg-orange-500 px-3 py-1 text-white hover:bg-orange-600'
                >
                  แก้ไข
                </button>
                <button
                  onClick={() => handleDeleteOrganize(selectedOrganize)}
                  className='rounded bg-red-600 px-3 py-1 text-white hover:bg-red-700'
                >
                  ลบ
                </button>
              </div>
            )}
          </div>

          <div className='mb-4 flex gap-2'>
            <input
              type='text'
              placeholder='ชื่อ organize ใหม่'
              value={newOrganizeName}
              onChange={(e) => setNewOrganizeName(e.target.value)}
              className='flex-1 rounded border border-gray-300 px-3 py-2'
            />
            <button
              onClick={handleAddOrganize}
              className='rounded bg-green-500 px-4 py-2 text-white hover:bg-green-600'
            >
              เพิ่ม organize ใหม่
            </button>
          </div>

          {selectedOrganize && (
            <>
              <h3 className='mt-6 mb-3 text-xl font-semibold'>
                Members in {selectedOrganize}
              </h3>
              <div className='mb-4 flex gap-2'>
                <input
                  type='text'
                  placeholder='ชื่อสมาชิกใหม่'
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  className='flex-1 rounded border border-gray-300 px-3 py-2'
                />
                <button
                  onClick={handleAddMember}
                  className='rounded bg-green-500 px-4 py-2 text-white hover:bg-green-600'
                >
                  เพิ่มสมาชิกใหม่
                </button>
              </div>

              {isLoadingMembers ? (
                <p>Loading...</p>
              ) : members.length > 0 ? (
                <table className='w-full overflow-hidden rounded bg-white shadow'>
                  <thead className='bg-green-500 text-white'>
                    <tr>
                      <th className='p-3 text-left'>Person Name</th>
                      <th className='p-3 text-left'>จำนวนภาพ</th>
                      <th className='p-3 text-left'>จำนวน Vector</th>
                      <th className='p-3'></th>
                      <th className='p-3'></th>
                      <th className='p-3'></th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => (
                      <tr
                        key={member.person_name}
                        className='border-b hover:bg-gray-50'
                      >
                        <td className='p-3'>{member.person_name}</td>
                        <td className='p-3'>{member.image_count}</td>
                        <td className='p-3'>{member.vector_count}</td>
                        <td className='p-3'>
                          <button
                            onClick={() => handleEditMember(member)}
                            className='rounded bg-orange-500 px-3 py-1 text-white hover:bg-orange-600'
                          >
                            แก้ไข
                          </button>
                        </td>
                        <td className='p-3'>
                          <button
                            onClick={() => openImageModal(member)}
                            className='rounded bg-blue-500 px-3 py-1 text-white hover:bg-blue-600'
                          >
                            {member.image_count > 0
                              ? 'แก้ไขรูปภาพ'
                              : 'เพิ่มรูปภาพ'}
                          </button>
                        </td>
                        <td className='p-3'>
                          <button
                            onClick={() => handleDeleteMember(member)}
                            className='rounded bg-red-600 px-3 py-1 text-white hover:bg-red-700'
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

              {members.length > 0 && (
                <button
                  onClick={handleRebuildVectors}
                  disabled={isRebuilding}
                  className='mt-4 rounded bg-orange-500 px-4 py-2 text-white hover:bg-orange-600 disabled:bg-gray-400'
                >
                  {isRebuilding ? 'กำลังบีบอัด...' : 'บีบอัด Vector'}
                </button>
              )}
            </>
          )}
        </div>

        {/* Image Modal */}
        {showModal && currentMember && (
          <div
            className='bg-opacity-70 fixed inset-0 z-50 flex items-center justify-center bg-black'
            onClick={closeModal}
          >
            <div
              className='relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-8 shadow-xl'
              onClick={(e) => e.stopPropagation()}
            >
              <span
                className='absolute top-2 right-5 cursor-pointer text-4xl font-bold text-gray-600 hover:text-black'
                onClick={closeModal}
              >
                &times;
              </span>
              <h2 className='mt-0 mb-2 text-2xl font-bold'>
                จัดการรูปภาพของ {currentMember.person_name}
              </h2>
              <p className='mb-4'>Organize: {selectedOrganize}</p>

              <div className='mb-6 rounded bg-gray-100 p-4'>
                <h3 className='mb-3 text-lg font-semibold'>เพิ่มรูปภาพ</h3>

                <div className='mb-3 flex flex-col gap-3'>
                  <div>
                    <input
                      type='file'
                      accept='image/*'
                      onChange={handleFileSelect}
                      disabled={isUploading || isCameraOn}
                      className='text-sm'
                    />
                    {selectedFile && (
                      <span className='ml-2'>✓ {selectedFile.name}</span>
                    )}
                  </div>

                  <div>
                    {!isCameraOn ? (
                      <button
                        onClick={startCameraModal}
                        disabled={isUploading || !!selectedFile}
                        className='rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:bg-gray-400'
                      >
                        📷 เปิดกล้อง
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={stopCameraModal}
                          className='rounded bg-red-500 px-4 py-2 text-white hover:bg-red-600'
                        >
                          ปิดกล้อง
                        </button>
                        <video
                          ref={videoModalRef}
                          autoPlay
                          playsInline
                          className='mt-2 w-full max-w-md'
                        />
                      </>
                    )}
                  </div>
                </div>

                <button
                  onClick={handleUploadImage}
                  disabled={isUploading || (!selectedFile && !isCameraOn)}
                  className='rounded bg-green-500 px-4 py-2 text-white hover:bg-green-600 disabled:bg-gray-400'
                >
                  {isUploading ? 'กำลังอัปโหลด...' : 'อัปโหลด'}
                </button>
              </div>

              <div>
                <h3 className='mb-3 text-lg font-semibold'>
                  รูปภาพทั้งหมด ({memberImages.length})
                </h3>
                {memberImages.length > 0 ? (
                  <div className='grid grid-cols-3 gap-4'>
                    {memberImages.map((imgName) => (
                      <div
                        key={imgName}
                        className='relative overflow-hidden rounded border-2'
                      >
                        <img
                          src={`${API_BASE_URL}/organize/${selectedOrganize}/member/${currentMember.person_name}/image/${imgName}`}
                          alt={imgName}
                          className='h-40 w-full object-cover'
                        />
                        <button
                          onClick={() => handleDeleteImage(imgName)}
                          className='bg-opacity-80 hover:bg-opacity-100 absolute top-1 right-1 rounded bg-red-600 px-2 py-1 text-xs text-white'
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
    </div>
  );
}
