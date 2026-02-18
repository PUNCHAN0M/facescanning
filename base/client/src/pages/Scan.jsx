import React, { useRef, useEffect, useState } from "react";
import * as ort from "onnxruntime-web";

/* ================= CONFIG ================= */
const INPUT_SIZE = 640;
const CONF_THRESH = 0.6;
const NMS_THRESH = 0.4;
const STRIDES = [8, 16, 32];

const YOLO_INPUT = 640;
const YOLO_CONF = 0.5;
const PADDING_PX = 0;

const MBF_INPUT = 112;

const SERVER_URL = "http://localhost:8000";
const SEARCH_INTERVAL_MS = 700;

/* ================= COMPONENT ================= */
export default function Scan() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cropCanvasRef = useRef(null);
  const alignCanvasRef = useRef(null);

  const sessionRef = useRef(null);
  const yoloRef = useRef(null);
  const mbfRef = useRef(null);
  const rafRef = useRef(null);
  const lastTimeRef = useRef(performance.now());
  const lastSearchTimeRef = useRef(0);
  const isSearchingRef = useRef(false);

  const [running, setRunning] = useState(false);
  const [fps, setFps] = useState(0);
  const [embeddingDims, setEmbeddingDims] = useState(null);

  const [organizes, setOrganizes] = useState([]);
  const [selectedOrganize, setSelectedOrganize] = useState("");
  const [matchPerson, setMatchPerson] = useState("-");
  const [matchSimilarity, setMatchSimilarity] = useState("-");

  // Organize Management States
  const [members, setMembers] = useState([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [newOrganizeName, setNewOrganizeName] = useState("");
  const [newMemberName, setNewMemberName] = useState("");
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [currentMember, setCurrentMember] = useState(null);
  const [memberImages, setMemberImages] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const videoModalRef = useRef(null);

  /* ================= LOAD MODEL ================= */
  useEffect(() => {
    async function load() {
      sessionRef.current = await ort.InferenceSession.create(
        "/scrfd_2.5g.onnx",
        { executionProviders: ["wasm"] }
      );
      yoloRef.current = await ort.InferenceSession.create(
        "/yolov12n-face.onnx",
        { executionProviders: ["wasm"] }
      );
      mbfRef.current = await ort.InferenceSession.create(
        "/w600k_mbf.onnx",
        { executionProviders: ["wasm"] }
      );
      console.log("Models loaded");
    }
    load();
  }, []);

  useEffect(() => {
    async function loadOrganizes() {
      try {
        const res = await fetch(`${SERVER_URL}/organizes`);
        const data = await res.json();
        const orgs = data.organizes || [];
        setOrganizes(orgs);
        if (!selectedOrganize && orgs.length > 0) {
          setSelectedOrganize(orgs[0]);
        }
      } catch (e) {
        console.warn("Failed to fetch organizes:", e);
      }
    }
    loadOrganizes();
  }, []);

  // Fetch organize details when selected organize changes
  useEffect(() => {
    if (selectedOrganize) {
      fetchOrganizeDetails(selectedOrganize);
    } else {
      setMembers([]);
    }
  }, [selectedOrganize]);

  /* ================= FETCH DATA ================= */
  const fetchOrganizes = async () => {
    try {
      const res = await fetch(`${SERVER_URL}/organizes`);
      const data = await res.json();
      setOrganizes(data.organizes || []);
    } catch (e) {
      console.error("Failed to fetch organizes:", e);
    }
  };

  const fetchOrganizeDetails = async (organizeName) => {
    if (!organizeName) return;
    setIsLoadingMembers(true);
    try {
      const res = await fetch(`${SERVER_URL}/organize/${organizeName}/details`);
      const data = await res.json();
      setMembers(data.members || []);
    } catch (e) {
      console.error("Failed to fetch organize details:", e);
      setMembers([]);
    }
    setIsLoadingMembers(false);
  };

  /* ================= ORGANIZE MANAGEMENT ================= */
  const handleAddOrganize = async () => {
    if (!newOrganizeName.trim()) {
      alert("กรุณากรอกชื่อ organize");
      return;
    }
    try {
      const res = await fetch(`${SERVER_URL}/organize/create?organize_name=${encodeURIComponent(newOrganizeName)}`, {
        method: "POST"
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        setNewOrganizeName("");
        await fetchOrganizes();
      } else {
        alert(data.detail || "เกิดข้อผิดพลาด");
      }
    } catch (e) {
      console.error("Failed to create organize:", e);
      alert("เกิดข้อผิดพลาดในการสร้าง organize");
    }
  };

  const handleEditOrganize = async (oldName) => {
    const newName = prompt("กรุณากรอกชื่อ organize ใหม่:", oldName);
    if (!newName || newName.trim() === "" || newName.trim() === oldName) return;
    try {
      const res = await fetch(`${SERVER_URL}/organize/${encodeURIComponent(oldName)}/rename?new_name=${encodeURIComponent(newName.trim())}`, {
        method: "PUT"
      });
      const data = await res.json();
      if (res.ok) {
        alert(`✅ ${data.message}`);
        if (selectedOrganize === oldName) setSelectedOrganize(newName.trim());
        await fetchOrganizes();
      } else {
        alert(`❌ เกิดข้อผิดพลาด: ${data.detail || 'Unknown error'}`);
      }
    } catch (e) {
      console.error("Error renaming organize:", e);
      alert("❌ เกิดข้อผิดพลาดในการเปลี่ยนชื่อ organize");
    }
  };

  const handleDeleteOrganize = async (organizeName) => {
    if (!confirm(`ต้องการลบ organize "${organizeName}" หรือไม่?\n\n⚠️ การลบจะลบข้อมูลทั้งหมดภายใน organize นี้ รวมถึง:\n- สมาชิกทั้งหมด\n- รูปภาพทั้งหมด\n- Vector ทั้งหมด`)) return;
    try {
      const res = await fetch(`${SERVER_URL}/organize/${encodeURIComponent(organizeName)}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (res.ok) {
        alert(`✅ ${data.message}`);
        if (selectedOrganize === organizeName) {
          setSelectedOrganize("");
          setMembers([]);
        }
        await fetchOrganizes();
      } else {
        alert(`❌ เกิดข้อผิดพลาด: ${data.detail || 'Unknown error'}`);
      }
    } catch (e) {
      console.error("Error deleting organize:", e);
      alert("❌ เกิดข้อผิดพลาดในการลบ organize");
    }
  };

  /* ================= MEMBER MANAGEMENT ================= */
  const handleAddMember = async () => {
    if (!selectedOrganize) {
      alert("กรุณาเลือก organize ก่อน");
      return;
    }
    if (!newMemberName.trim()) {
      alert("กรุณากรอกชื่อสมาชิก");
      return;
    }
    try {
      const res = await fetch(`${SERVER_URL}/organize/${selectedOrganize}/member?person_name=${encodeURIComponent(newMemberName)}`, {
        method: "POST"
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        setNewMemberName("");
        await fetchOrganizeDetails(selectedOrganize);
      } else {
        alert(data.detail || "เกิดข้อผิดพลาด");
      }
    } catch (e) {
      console.error("Failed to create member:", e);
      alert("เกิดข้อผิดพลาดในการเพิ่มสมาชิก");
    }
  };

  const handleEditMember = async (member) => {
    const newName = prompt("กรุณากรอกชื่อสมาชิกใหม่:", member.person_name);
    if (!newName || newName.trim() === "" || newName.trim() === member.person_name) return;
    try {
      const res = await fetch(`${SERVER_URL}/organize/${encodeURIComponent(selectedOrganize)}/member/${encodeURIComponent(member.person_name)}/rename?new_name=${encodeURIComponent(newName.trim())}`, {
        method: "PUT"
      });
      const data = await res.json();
      if (res.ok) {
        alert(`✅ ${data.message}`);
        await fetchOrganizeDetails(selectedOrganize);
      } else {
        alert(`❌ เกิดข้อผิดพลาด: ${data.detail || 'Unknown error'}`);
      }
    } catch (e) {
      console.error("Error renaming member:", e);
      alert("❌ เกิดข้อผิดพลาดในการเปลี่ยนชื่อสมาชิก");
    }
  };

  const handleDeleteMember = async (member) => {
    if (!confirm(`ต้องการลบสมาชิก "${member.person_name}" หรือไม่?\n\n⚠️ การลบจะลบ:\n- รูปภาพทั้งหมด (${member.image_count} รูป)\n- Vector ทั้งหมด (${member.vector_count} vectors)\n\n💡 อย่าลืม "บีบอัด Vector" หลังลบเพื่ออัปเดต database`)) return;
    try {
      const res = await fetch(`${SERVER_URL}/organize/${encodeURIComponent(selectedOrganize)}/member/${encodeURIComponent(member.person_name)}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (res.ok) {
        alert(`✅ ${data.message}`);
        await fetchOrganizeDetails(selectedOrganize);
      } else {
        alert(`❌ เกิดข้อผิดพลาด: ${data.detail || 'Unknown error'}`);
      }
    } catch (e) {
      console.error("Error deleting member:", e);
      alert("❌ เกิดข้อผิดพลาดในการลบสมาชิก");
    }
  };

  const handleRebuildVectors = async () => {
    if (!selectedOrganize) {
      alert("กรุณาเลือก organize ก่อน");
      return;
    }
    if (!confirm(`ต้องการบีบอัด vector ของ ${selectedOrganize} หรือไม่?\n\n⏳ การดำเนินการนี้อาจใช้เวลาสักครู่`)) return;
    setIsRebuilding(true);
    try {
      const res = await fetch(`${SERVER_URL}/organize/${encodeURIComponent(selectedOrganize)}/rebuild`, {
        method: "POST"
      });
      const data = await res.json();
      if (res.ok) {
        alert(`✅ ${data.message}\n\nTotal vectors: ${data.total_vectors}`);
        await fetchOrganizeDetails(selectedOrganize);
      } else {
        alert(`❌ เกิดข้อผิดพลาด: ${data.detail || 'Unknown error'}`);
      }
    } catch (e) {
      console.error("Failed to rebuild vectors:", e);
      alert("❌ เกิดข้อผิดพลาดในการบีบอัด vector");
    }
    setIsRebuilding(false);
  };

  /* ================= IMAGE MANAGEMENT ================= */
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
    stopModalCamera();
  };

  const fetchMemberImages = async (personName) => {
    try {
      const res = await fetch(`${SERVER_URL}/organize/${selectedOrganize}/member/${personName}/images`);
      const data = await res.json();
      setMemberImages(data.images || []);
    } catch (e) {
      console.error("Failed to fetch images:", e);
    }
  };

  const handleFileSelect = (e) => {
    setSelectedFile(e.target.files[0]);
  };

  const startModalCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoModalRef.current) {
        videoModalRef.current.srcObject = stream;
      }
      setIsCameraOn(true);
    } catch (e) {
      console.error("Failed to start modal camera:", e);
      alert("ไม่สามารถเปิดกล้องได้");
    }
  };

  const stopModalCamera = () => {
    if (videoModalRef.current?.srcObject) {
      videoModalRef.current.srcObject.getTracks().forEach(t => t.stop());
    }
    setIsCameraOn(false);
  };

  const handleUploadImage = async () => {
    if (!selectedFile && !isCameraOn) {
      alert("กรุณาเลือกไฟล์หรือถ่ายภาพ");
      return;
    }
    setIsUploading(true);
    const fd = new FormData();
    if (selectedFile) {
      fd.append("file", selectedFile);
    } else if (isCameraOn && videoModalRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = videoModalRef.current.videoWidth;
      canvas.height = videoModalRef.current.videoHeight;
      canvas.getContext("2d").drawImage(videoModalRef.current, 0, 0);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg"));
      fd.append("file", blob, "captured.jpg");
    }
    try {
      const res = await fetch(`${SERVER_URL}/organize/${selectedOrganize}/member/${currentMember.person_name}/upload`, {
        method: "POST",
        body: fd
      });
      const data = await res.json();
      if (res.ok) {
        alert("อัปโหลดสำเร็จ");
        setSelectedFile(null);
        await fetchMemberImages(currentMember.person_name);
        await fetchOrganizeDetails(selectedOrganize);
      } else {
        alert(data.detail || "เกิดข้อผิดพลาด");
      }
    } catch (e) {
      console.error("Upload error:", e);
      alert("เกิดข้อผิดพลาดในการอัปโหลด");
    }
    setIsUploading(false);
  };

  const handleDeleteImage = async (filename) => {
    if (!confirm(`ต้องการลบภาพ ${filename} หรือไม่?`)) return;
    try {
      const res = await fetch(`${SERVER_URL}/organize/${selectedOrganize}/member/${currentMember.person_name}/image/${filename}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (res.ok) {
        alert("ลบสำเร็จ");
        await fetchMemberImages(currentMember.person_name);
        await fetchOrganizeDetails(selectedOrganize);
      } else {
        alert(data.detail || "เกิดข้อผิดพลาด");
      }
    } catch (e) {
      console.error("Delete error:", e);
      alert("เกิดข้อผิดพลาดในการลบภาพ");
    }
  };

  /* ================= CAMERA ================= */
  const startCamera = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    videoRef.current.srcObject = stream;
    await videoRef.current.play();
    setRunning(true);
    detectLoop();
  };

  const stopCamera = () => {
    cancelAnimationFrame(rafRef.current);
    videoRef.current.srcObject?.getTracks().forEach(t => t.stop());
    setRunning(false);
  };

  /* ================= UTILS ================= */
  const sigmoid = x => 1 / (1 + Math.exp(-x));

  function iou(a, b) {
    const [ax1, ay1, ax2, ay2] = a;
    const [bx1, by1, bx2, by2] = b;
    const ix1 = Math.max(ax1, bx1);
    const iy1 = Math.max(ay1, by1);
    const ix2 = Math.min(ax2, bx2);
    const iy2 = Math.min(ay2, by2);
    const iw = Math.max(0, ix2 - ix1);
    const ih = Math.max(0, iy2 - iy1);
    const inter = iw * ih;
    const areaA = (ax2 - ax1) * (ay2 - ay1);
    const areaB = (bx2 - bx1) * (by2 - by1);
    return inter / (areaA + areaB - inter + 1e-6);
  }

  function nms(faces) {
    const sorted = [...faces].sort((a, b) => b.conf - a.conf);
    const kept = [];
    for (const f of sorted) {
      let ok = true;
      for (const k of kept) {
        if (iou(f.bbox, k.bbox) > NMS_THRESH) {
          ok = false;
          break;
        }
      }
      if (ok) kept.push(f);
    }
    return kept;
  }

  function boxArea(b) {
    return Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]);
  }

  function pickBestFace(faces) {
    if (!faces.length) return null;
    let best = faces[0];
    for (const f of faces.slice(1)) {
      if (
        f.conf > best.conf ||
        (Math.abs(f.conf - best.conf) < 1e-6 &&
          boxArea(f.bbox) > boxArea(best.bbox))
      ) {
        best = f;
      }
    }
    return best;
  }

  /* ================= PREPROCESS SCRFD ================= */
  function preprocess(imgSrc) {
    const c = document.createElement("canvas");
    c.width = INPUT_SIZE;
    c.height = INPUT_SIZE;
    const ctx = c.getContext("2d");
    ctx.drawImage(imgSrc, 0, 0, INPUT_SIZE, INPUT_SIZE);

    const img = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE).data;
    const input = new Float32Array(1 * 3 * INPUT_SIZE * INPUT_SIZE);
    const HW = INPUT_SIZE * INPUT_SIZE;

    for (let i = 0; i < HW; i++) {
      const r = img[i * 4];
      const g = img[i * 4 + 1];
      const b = img[i * 4 + 2];
      input[i] = (b - 127.5) / 128;
      input[HW + i] = (g - 127.5) / 128;
      input[2 * HW + i] = (r - 127.5) / 128;
    }

    return new ort.Tensor("float32", input, [1, 3, INPUT_SIZE, INPUT_SIZE]);
  }

  /* ================= PREPROCESS YOLO ================= */
  function preprocessYolo(video) {
    const srcW = video.videoWidth;
    const srcH = video.videoHeight;
    const r = Math.min(YOLO_INPUT / srcW, YOLO_INPUT / srcH);
    const newW = Math.round(srcW * r);
    const newH = Math.round(srcH * r);
    const padX = Math.floor((YOLO_INPUT - newW) / 2);
    const padY = Math.floor((YOLO_INPUT - newH) / 2);

    const c = document.createElement("canvas");
    c.width = YOLO_INPUT;
    c.height = YOLO_INPUT;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, YOLO_INPUT, YOLO_INPUT);
    ctx.drawImage(video, 0, 0, srcW, srcH, padX, padY, newW, newH);

    const img = ctx.getImageData(0, 0, YOLO_INPUT, YOLO_INPUT).data;
    const input = new Float32Array(1 * 3 * YOLO_INPUT * YOLO_INPUT);

    for (let i = 0; i < YOLO_INPUT * YOLO_INPUT; i++) {
      input[i] = img[i * 4] / 255;
      input[YOLO_INPUT * YOLO_INPUT + i] = img[i * 4 + 1] / 255;
      input[2 * YOLO_INPUT * YOLO_INPUT + i] = img[i * 4 + 2] / 255;
    }

    return {
      tensor: new ort.Tensor("float32", input, [1, 3, YOLO_INPUT, YOLO_INPUT]),
      scale: r,
      padX,
      padY,
      srcW,
      srcH
    };
  }

  /* ================= PARSE YOLO ================= */
  function parseYOLO(outputs, lb) {
    const out = Object.values(outputs)[0];
    const data = out.data;
    const rows = data.length / 6;
    const boxes = [];

    for (let i = 0; i < rows; i++) {
      const off = i * 6;
      const conf = data[off + 4];
      if (conf < YOLO_CONF) continue;

      const cx = data[off];
      const cy = data[off + 1];
      const w = data[off + 2];
      const h = data[off + 3];

      const x1 = (cx - w / 2 - lb.padX) / lb.scale;
      const y1 = (cy - h / 2 - lb.padY) / lb.scale;
      const x2 = (cx + w / 2 - lb.padX) / lb.scale;
      const y2 = (cy + h / 2 - lb.padY) / lb.scale;

      boxes.push({
        bbox: [
          Math.max(0, x1),
          Math.max(0, y1),
          Math.min(lb.srcW, x2),
          Math.min(lb.srcH, y2)
        ],
        conf
      });
    }
    return boxes;
  }

  /* ================= CROP ================= */
  function cropWithPad(video, bbox, pad) {
    const x1 = Math.max(0, bbox[0] - pad);
    const y1 = Math.max(0, bbox[1] - pad);
    const x2 = Math.min(video.videoWidth, bbox[2] + pad);
    const y2 = Math.min(video.videoHeight, bbox[3] + pad);
    const w = x2 - x1;
    const h = y2 - y1;

    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d").drawImage(video, x1, y1, w, h, 0, 0, w, h);
    return { canvas: c, x1, y1, w, h };
  }

  /* ================= SCRFD PARSER ================= */
  function parseSCRFD(outputs, imgW, imgH) {
    const faces = [];
    const o = Object.values(outputs);
    const maps = {
      8: { s: o[0].data, b: o[1].data, k: o[2].data },
      16: { s: o[3].data, b: o[4].data, k: o[5].data },
      32: { s: o[6].data, b: o[7].data, k: o[8].data }
    };

    STRIDES.forEach(stride => {
      const { s, b, k, sd, bd } = maps[stride];
      const fm = INPUT_SIZE / stride;
      // Derive anchors robustly from bbox tensor: 4 values per anchor
      const anchors = Math.max(1, Math.round(b.length / (fm * fm * 4)));
      // Scores per anchor (e.g., 1 or number of classes)
      const sPerAnchor = Math.max(1, Math.round(s.length / (fm * fm * anchors)));

      const total = fm * fm * anchors;
      for (let i = 0; i < total; i++) {
        const sIdx = i * sPerAnchor + (sPerAnchor - 1); // pick last channel as face score
        const conf = sigmoid(s[sIdx]);
        if (conf < CONF_THRESH) continue;

        const grid = Math.floor(i / anchors);
        const gx = grid % fm;
        const gy = Math.floor(grid / fm);
        const cx = (gx + 0.5) * stride;
        const cy = (gy + 0.5) * stride;

        const base4 = i * 4;
        const l = b[base4] * stride;
        const t = b[base4 + 1] * stride;
        const r = b[base4 + 2] * stride;
        const bb = b[base4 + 3] * stride;

        const bbox = [
          (cx - l) * imgW / INPUT_SIZE,
          (cy - t) * imgH / INPUT_SIZE,
          (cx + r) * imgW / INPUT_SIZE,
          (cy + bb) * imgH / INPUT_SIZE
        ];

        const landmarks = [];
        for (let j = 0; j < 5; j++) {
          const base10 = i * 10 + j * 2;
          landmarks.push({
            x: (cx + k[base10] * stride) * imgW / INPUT_SIZE,
            y: (cy + k[base10 + 1] * stride) * imgH / INPUT_SIZE
          });
        }

        faces.push({ bbox, landmarks, conf });
      }
    });

    return faces;
  }

  /* ================= DRAW CROP ================= */
  function drawCrop(crop, face) {
    const c = cropCanvasRef.current;
    if (!c || !face) return;

    const [x1, y1, x2, y2] = face.bbox;
    const bw = Math.max(1, Math.round(x2 - x1));
    const bh = Math.max(1, Math.round(y2 - y1));

    // Resize crop canvas to bbox size and draw only the bbox area
    c.width = bw;
    c.height = bh;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, bw, bh);
    ctx.drawImage(
      crop.canvas,
      x1, y1, bw, bh, // source rect inside crop
      0, 0, bw, bh     // destination rect
    );

    // Optional outline
    ctx.strokeStyle = "lime";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, bw, bh);

    // Draw landmarks offset into bbox-local coordinates
    ctx.fillStyle = "red";
    face.landmarks.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x - x1, p.y - y1, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  /* ================= ARCFACE ALIGNMENT ================= */
  // ArcFace standard reference landmarks for 112x112 output
  // Order: [left_eye, right_eye, nose, mouth_left, mouth_right]
  const ARCFACE_REF_112 = [
    [38.2946, 51.6963],
    [73.5318, 51.5014],
    [56.0252, 71.7366],
    [41.5493, 92.3655],
    [70.7299, 92.2041]
  ];

  /**
   * Compute similarity transform (scale, rotation, translation) using Umeyama algorithm
   * This is the standard method used in InsightFace/ArcFace
   */
  function umeyamaSimilarityTransform(src, dst) {
    const n = src.length;
    if (n < 2) return null;

    // 1. Compute mean
    let srcMeanX = 0, srcMeanY = 0, dstMeanX = 0, dstMeanY = 0;
    for (let i = 0; i < n; i++) {
      srcMeanX += src[i][0];
      srcMeanY += src[i][1];
      dstMeanX += dst[i][0];
      dstMeanY += dst[i][1];
    }
    srcMeanX /= n; srcMeanY /= n;
    dstMeanX /= n; dstMeanY /= n;

    // 2. Compute centered coordinates and variance
    const srcCentered = [];
    const dstCentered = [];
    let srcVar = 0;
    
    for (let i = 0; i < n; i++) {
      const sx = src[i][0] - srcMeanX;
      const sy = src[i][1] - srcMeanY;
      const dx = dst[i][0] - dstMeanX;
      const dy = dst[i][1] - dstMeanY;
      srcCentered.push([sx, sy]);
      dstCentered.push([dx, dy]);
      srcVar += sx * sx + sy * sy;
    }
    srcVar /= n;
    if (srcVar < 1e-10) return null;

    // 3. Compute covariance matrix (2x2)
    // cov = dst^T * src / n
    let cov00 = 0, cov01 = 0, cov10 = 0, cov11 = 0;
    for (let i = 0; i < n; i++) {
      cov00 += dstCentered[i][0] * srcCentered[i][0];
      cov01 += dstCentered[i][0] * srcCentered[i][1];
      cov10 += dstCentered[i][1] * srcCentered[i][0];
      cov11 += dstCentered[i][1] * srcCentered[i][1];
    }
    cov00 /= n; cov01 /= n; cov10 /= n; cov11 /= n;

    // 4. SVD of 2x2 matrix: cov = U * S * V^T
    // For 2x2, we can compute analytically
    const { U, S, V } = svd2x2(cov00, cov01, cov10, cov11);

    // 5. Compute rotation matrix R = U * V^T
    // Check for reflection
    let det = (U[0][0] * U[1][1] - U[0][1] * U[1][0]) * (V[0][0] * V[1][1] - V[0][1] * V[1][0]);
    
    const d = det < 0 ? -1 : 1;
    const Vt = [[V[0][0], V[1][0]], [V[0][1] * d, V[1][1] * d]];
    
    // R = U * Vt
    const R = [
      [U[0][0] * Vt[0][0] + U[0][1] * Vt[1][0], U[0][0] * Vt[0][1] + U[0][1] * Vt[1][1]],
      [U[1][0] * Vt[0][0] + U[1][1] * Vt[1][0], U[1][0] * Vt[0][1] + U[1][1] * Vt[1][1]]
    ];

    // 6. Compute scale
    const traceS = S[0] + (det < 0 ? -S[1] : S[1]);
    const scale = traceS / srcVar;

    // 7. Compute translation
    const tx = dstMeanX - scale * (R[0][0] * srcMeanX + R[0][1] * srcMeanY);
    const ty = dstMeanY - scale * (R[1][0] * srcMeanX + R[1][1] * srcMeanY);

    // Return transformation matrix components
    // Canvas setTransform(a, b, c, d, e, f) applies: x' = ax + cy + e, y' = bx + dy + f
    return {
      a: scale * R[0][0],
      b: scale * R[1][0],
      c: scale * R[0][1],
      d: scale * R[1][1],
      tx: tx,
      ty: ty
    };
  }

  /**
   * SVD for 2x2 matrix using analytical solution
   */
  function svd2x2(a, b, c, d) {
    // Compute A^T * A
    const ata00 = a * a + c * c;
    const ata01 = a * b + c * d;
    const ata11 = b * b + d * d;

    // Eigenvalues of A^T * A
    const trace = ata00 + ata11;
    const det = ata00 * ata11 - ata01 * ata01;
    const disc = Math.sqrt(Math.max(0, trace * trace / 4 - det));
    const s1Sq = trace / 2 + disc;
    const s2Sq = trace / 2 - disc;
    const s1 = Math.sqrt(Math.max(0, s1Sq));
    const s2 = Math.sqrt(Math.max(0, s2Sq));

    // Compute V (eigenvectors of A^T * A)
    let V;
    if (Math.abs(ata01) > 1e-10) {
      const v1x = ata01;
      const v1y = s1Sq - ata00;
      const len1 = Math.hypot(v1x, v1y) || 1;
      const v2x = ata01;
      const v2y = s2Sq - ata00;
      const len2 = Math.hypot(v2x, v2y) || 1;
      V = [[v1x / len1, v2x / len2], [v1y / len1, v2y / len2]];
    } else {
      V = [[1, 0], [0, 1]];
    }

    // Compute U = A * V * S^-1
    let U;
    if (s1 > 1e-10) {
      const u1x = (a * V[0][0] + b * V[1][0]) / s1;
      const u1y = (c * V[0][0] + d * V[1][0]) / s1;
      let u2x, u2y;
      if (s2 > 1e-10) {
        u2x = (a * V[0][1] + b * V[1][1]) / s2;
        u2y = (c * V[0][1] + d * V[1][1]) / s2;
      } else {
        // Orthogonal to u1
        u2x = -u1y;
        u2y = u1x;
      }
      U = [[u1x, u2x], [u1y, u2y]];
    } else {
      U = [[1, 0], [0, 1]];
    }

    return { U, S: [s1, s2], V };
  }

  /**
   * ArcFace-style face alignment using 5-point landmarks
   * Uses Umeyama similarity transform (same as InsightFace)
   */
  function drawAlignedFace(crop, face) {
    const c = alignCanvasRef.current;
    if (!c || !face || face.landmarks.length < 5) return;

    // Output size
    const OUT = 112;
    c.width = OUT;
    c.height = OUT;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#808080"; // gray background
    ctx.fillRect(0, 0, OUT, OUT);

    // Source landmarks from detection (relative to crop canvas)
    // SCRFD order: [left_eye, right_eye, nose, mouth_left, mouth_right]
    const srcPts = face.landmarks.map(p => [p.x, p.y]);

    // Destination landmarks (ArcFace reference for 112x112)
    const dstPts = ARCFACE_REF_112;

    // Estimate similarity transform using Umeyama algorithm
    const M = umeyamaSimilarityTransform(srcPts, dstPts);
    if (!M) return;

    // Apply transform
    // Canvas setTransform(a, b, c, d, e, f): x' = ax + cy + e, y' = bx + dy + f
    ctx.save();
    ctx.setTransform(M.a, M.b, M.c, M.d, M.tx, M.ty);
    ctx.drawImage(crop.canvas, 0, 0);
    ctx.restore();
  }

  /* ================= MBF EMBEDDING ================= */
  function preprocessMbfFromCanvas(srcCanvas) {
    const c = document.createElement("canvas");
    c.width = MBF_INPUT;
    c.height = MBF_INPUT;
    const ctx = c.getContext("2d");
    ctx.drawImage(srcCanvas, 0, 0, MBF_INPUT, MBF_INPUT);

    const img = ctx.getImageData(0, 0, MBF_INPUT, MBF_INPUT).data;
    const input = new Float32Array(1 * 3 * MBF_INPUT * MBF_INPUT);
    const HW = MBF_INPUT * MBF_INPUT;

    // Normalize similar to ArcFace-style: (x - 127.5) / 128
    for (let i = 0; i < HW; i++) {
      const r = img[i * 4];
      const g = img[i * 4 + 1];
      const b = img[i * 4 + 2];
      input[i] = (r - 127.5) / 128;
      input[HW + i] = (g - 127.5) / 128;
      input[2 * HW + i] = (b - 127.5) / 128;
    }

    return new ort.Tensor("float32", input, [1, 3, MBF_INPUT, MBF_INPUT]);
  }

  function l2Normalize(vec) {
    let sum = 0;
    for (let i = 0; i < vec.length; i++) sum += vec[i] * vec[i];
    const norm = Math.sqrt(sum) || 1;
    const out = new Float32Array(vec.length);
    for (let i = 0; i < vec.length; i++) out[i] = vec[i] / norm;
    return out;
  }

  async function runMbfEmbedding() {
    const mbf = mbfRef.current;
    const aligned = alignCanvasRef.current;
    if (!mbf || !aligned) return null;
    const inputTensor = preprocessMbfFromCanvas(aligned);
    const outputs = await mbf.run({ [mbf.inputNames[0]]: inputTensor });
    const out = outputs[mbf.outputNames[0]] ?? Object.values(outputs)[0];
    const emb = out.data;
    return l2Normalize(emb);
  }

  async function searchFaissByEmbedding(emb) {
    if (!selectedOrganize) return;
    const now = performance.now();
    if (isSearchingRef.current) return;
    if (now - lastSearchTimeRef.current < SEARCH_INTERVAL_MS) return;

    lastSearchTimeRef.current = now;
    isSearchingRef.current = true;
    try {
      const res = await fetch(
        `${SERVER_URL}/organize/${encodeURIComponent(selectedOrganize)}/search_vector`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ embedding: Array.from(emb), k: 1 })
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setMatchPerson("-");
        setMatchSimilarity("-");
        console.warn("search_vector error:", data);
        return;
      }
      if (data.status === "success") {
        setMatchPerson(data.person ?? "-");
        setMatchSimilarity(typeof data.similarity === "number" ? data.similarity.toFixed(4) : "-");
      } else {
        setMatchPerson("unknown");
        setMatchSimilarity("-");
      }
    } catch (e) {
      console.warn("search_vector failed:", e);
    } finally {
      isSearchingRef.current = false;
    }
  }

  /* ================= LOOP ================= */
  async function detectLoop() {
    if (!sessionRef.current || !yoloRef.current || !mbfRef.current) return;

    const tLoopStart = performance.now();

    const v = videoRef.current;
    const c = canvasRef.current;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext("2d");

    // YOLO Detection
    const tYoloStart = performance.now();
    const yprep = preprocessYolo(v);
    let dets = parseYOLO(
      await yoloRef.current.run({ [yoloRef.current.inputNames[0]]: yprep.tensor }),
      yprep
    );
    const tYoloDone = performance.now();

    dets = nms(dets)
      .sort((a, b) => b.conf * boxArea(b.bbox) - a.conf * boxArea(a.bbox))
      .slice(0, 1);

    ctx.clearRect(0, 0, c.width, c.height);

    for (const d of dets) {
      // SCRFD Landmark Detection
      const tScrfdStart = performance.now();
      const crop = cropWithPad(v, d.bbox, PADDING_PX);
      const faces = parseSCRFD(
        await sessionRef.current.run({
          [sessionRef.current.inputNames[0]]: preprocess(crop.canvas)
        }),
        crop.w,
        crop.h
      );
      const tScrfdDone = performance.now();

      const best = pickBestFace(nms(faces));
      if (!best) continue;

      // Alignment
      const tAlignStart = performance.now();
      drawCrop(crop, best);
      drawAlignedFace(crop, best);
      const tAlignDone = performance.now();

      // Generate embedding from aligned face
      try {
        const tEmbedStart = performance.now();
        const emb = await runMbfEmbedding();
        const tEmbedDone = performance.now();
        
        if (emb) {
          if (embeddingDims == null) setEmbeddingDims(emb.length);
          
          const tSearchStart = performance.now();
          await searchFaissByEmbedding(emb);
          const tSearchDone = performance.now();

          // Log timing (only every 30 frames to reduce console spam)
          if (Math.random() < 0.033) {
            console.log(
              `[TIMING] Client Pipeline:\n` +
              `  YOLO: ${(tYoloDone - tYoloStart).toFixed(1)}ms\n` +
              `  SCRFD: ${(tScrfdDone - tScrfdStart).toFixed(1)}ms\n` +
              `  Align: ${(tAlignDone - tAlignStart).toFixed(1)}ms\n` +
              `  Embed: ${(tEmbedDone - tEmbedStart).toFixed(1)}ms\n` +
              `  Search: ${(tSearchDone - tSearchStart).toFixed(1)}ms\n` +
              `  Total: ${(performance.now() - tLoopStart).toFixed(1)}ms`
            );
          }
        }
      } catch (e) {
        console.warn("MBF embedding failed:", e);
      }

      const gb = [
        crop.x1 + best.bbox[0],
        crop.y1 + best.bbox[1],
        crop.x1 + best.bbox[2],
        crop.y1 + best.bbox[3]
      ];

      ctx.strokeStyle = "lime";
      ctx.lineWidth = 2;
      ctx.strokeRect(gb[0], gb[1], gb[2] - gb[0], gb[3] - gb[1]);

      ctx.fillStyle = "red";
      best.landmarks.forEach(p => {
        ctx.beginPath();
        ctx.arc(crop.x1 + p.x, crop.y1 + p.y, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    const now = performance.now();
    setFps(Math.round(1000 / (now - lastTimeRef.current)));
    lastTimeRef.current = now;

    rafRef.current = requestAnimationFrame(detectLoop);
  }

  /* ================= UI ================= */
  return (
    <div style={{ padding: 20 }}>
      <h1>Face Scanning</h1>
      
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        {/* Original video with overlay */}
        <div style={{ position: "relative" }}>
          <video ref={videoRef} muted playsInline style={{ maxWidth: 640 }} />
          <canvas ref={canvasRef} style={{ position: "absolute", top: 0, left: 0 }} />
          {!running ? (
            <button onClick={startCamera}>Start</button>
          ) : (
            <button onClick={stopCamera}>Stop</button>
          )}
          <p>FPS: {fps}</p>
        </div>

        {/* YOLO cropped + keypoints */}
        <div>
          <h3>YOLO Cropped + Keypoints</h3>
          <canvas
            ref={cropCanvasRef}
            style={{ border: "1px solid #ccc", position: "relative", pointerEvents: "auto" }}
          />
        </div>

        {/* Aligned face image */}
        <div>
          <h3>Aligned Face</h3>
          <canvas
            ref={alignCanvasRef}
            style={{ border: "1px solid #ccc", position: "relative", pointerEvents: "auto" }}
          />
          <p style={{ maxWidth: 280 }}>
            Embedding: {embeddingDims ? `${embeddingDims} dims` : "-"}
          </p>
          <p style={{ maxWidth: 280 }}>
            Result: {matchPerson} (conf: {matchSimilarity})
          </p>
        </div>
      </div>

      {/* Detection Result Display */}
      <div className="detection-result" style={{ marginTop: 20, padding: 15, backgroundColor: "#f5f5f5", borderRadius: 8 }}>
        <h3>Detection Result</h3>
        <p><strong>Current Detection:</strong> {matchPerson}</p>
        <p><strong>Confidence:</strong> {matchSimilarity}</p>
      </div>

      {/* Organize Management */}
      <div className="organize-section" style={{ marginTop: 20, padding: 20, backgroundColor: "#fafafa", borderRadius: 8 }}>
        <h2>Organize Management</h2>
        
        <div className="organize-selector" style={{ marginBottom: 15 }}>
          <label>เลือก Organize: </label>
          <select 
            value={selectedOrganize} 
            onChange={(e) => setSelectedOrganize(e.target.value)}
            style={{ padding: "5px 10px", marginRight: 10 }}
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
          <div className="add-organize" style={{ marginTop: 10 }}>
            <input
              type="text"
              placeholder="ชื่อ organize ใหม่"
              value={newOrganizeName}
              onChange={(e) => setNewOrganizeName(e.target.value)}
              style={{ padding: "5px 10px", marginRight: 10 }}
            />
            <button onClick={handleAddOrganize} style={{ padding: "5px 15px" }}>เพิ่ม organize ใหม่</button>
          </div>
        </div>

        {selectedOrganize && (
          <>
            <h3>Members in {selectedOrganize}</h3>
            <div className="add-member" style={{ marginBottom: 15 }}>
              <input
                type="text"
                placeholder="ชื่อสมาชิกใหม่"
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                style={{ padding: "5px 10px", marginRight: 10 }}
              />
              <button onClick={handleAddMember} style={{ padding: "5px 15px" }}>เพิ่มสมาชิกใหม่</button>
            </div>

            {isLoadingMembers ? (
              <p>Loading...</p>
            ) : members.length > 0 ? (
              <table className="members-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: "#e0e0e0" }}>
                    <th style={{ padding: 10, border: "1px solid #ccc" }}>Person Name</th>
                    <th style={{ padding: 10, border: "1px solid #ccc" }}>จำนวนภาพ</th>
                    <th style={{ padding: 10, border: "1px solid #ccc" }}>จำนวน Vector</th>
                    <th style={{ padding: 10, border: "1px solid #ccc" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.person_name}>
                      <td style={{ padding: 10, border: "1px solid #ccc" }}>{member.person_name}</td>
                      <td style={{ padding: 10, border: "1px solid #ccc", textAlign: "center" }}>{member.image_count}</td>
                      <td style={{ padding: 10, border: "1px solid #ccc", textAlign: "center" }}>{member.vector_count}</td>
                      <td style={{ padding: 10, border: "1px solid #ccc" }}>
                        <button 
                          onClick={() => handleEditMember(member)}
                          style={{ backgroundColor: '#ffa500', color: 'white', padding: '5px 10px', border: 'none', cursor: 'pointer', borderRadius: '3px', marginRight: 5 }}
                        >
                          แก้ไข
                        </button>
                        <button 
                          onClick={() => openImageModal(member)}
                          style={{ backgroundColor: '#007bff', color: 'white', padding: '5px 10px', border: 'none', cursor: 'pointer', borderRadius: '3px', marginRight: 5 }}
                        >
                          {member.image_count > 0 ? 'แก้ไขรูปภาพ' : 'เพิ่มรูปภาพ'}
                        </button>
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

            {members.length > 0 && (
              <button 
                onClick={handleRebuildVectors} 
                disabled={isRebuilding}
                style={{ 
                  marginTop: 15, 
                  padding: "10px 20px", 
                  backgroundColor: isRebuilding ? "#ccc" : "#28a745", 
                  color: "white", 
                  border: "none", 
                  borderRadius: 5, 
                  cursor: isRebuilding ? "not-allowed" : "pointer" 
                }}
              >
                {isRebuilding ? 'กำลังบีบอัด...' : 'บีบอัด Vector'}
              </button>
            )}
          </>
        )}
      </div>

      {/* Image Management Modal */}
      {showModal && currentMember && (
        <div 
          className="modal-overlay" 
          onClick={closeModal}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000
          }}
        >
          <div 
            className="modal-content" 
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "white",
              padding: 30,
              borderRadius: 10,
              maxWidth: 600,
              maxHeight: "80vh",
              overflow: "auto",
              position: "relative"
            }}
          >
            <span 
              className="close" 
              onClick={closeModal}
              style={{
                position: "absolute",
                top: 10,
                right: 15,
                fontSize: 24,
                cursor: "pointer"
              }}
            >
              &times;
            </span>
            <h2>จัดการรูปภาพของ {currentMember.person_name}</h2>
            <p>Organize: {selectedOrganize}</p>

            <div className="upload-section" style={{ marginTop: 20 }}>
              <h3>เพิ่มรูปภาพ</h3>
              
              <div className="upload-options" style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    disabled={isUploading || isCameraOn}
                  />
                  {selectedFile && <span style={{ marginLeft: 10 }}>✓ {selectedFile.name}</span>}
                </div>

                <div className="camera-section">
                  {!isCameraOn ? (
                    <button onClick={startModalCamera} disabled={isUploading || selectedFile}>
                      📷 เปิดกล้อง
                    </button>
                  ) : (
                    <>
                      <button onClick={stopModalCamera}>ปิดกล้อง</button>
                      <video
                        ref={videoModalRef}
                        autoPlay
                        playsInline
                        style={{ width: '100%', maxWidth: '400px', marginTop: '10px', display: "block" }}
                      />
                    </>
                  )}
                </div>
              </div>

              <button
                onClick={handleUploadImage}
                disabled={isUploading || (!selectedFile && !isCameraOn)}
                style={{
                  marginTop: 15,
                  padding: "10px 20px",
                  backgroundColor: (isUploading || (!selectedFile && !isCameraOn)) ? "#ccc" : "#007bff",
                  color: "white",
                  border: "none",
                  borderRadius: 5,
                  cursor: (isUploading || (!selectedFile && !isCameraOn)) ? "not-allowed" : "pointer"
                }}
              >
                {isUploading ? 'กำลังอัปโหลด...' : 'อัปโหลด'}
              </button>
            </div>

            <div className="images-section" style={{ marginTop: 20 }}>
              <h3>รูปภาพทั้งหมด ({memberImages.length})</h3>
              {memberImages.length > 0 ? (
                <div className="image-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10 }}>
                  {memberImages.map((imgName) => (
                    <div key={imgName} className="image-item" style={{ position: "relative" }}>
                      <img
                        src={`${SERVER_URL}/organize/${selectedOrganize}/member/${currentMember.person_name}/image/${imgName}`}
                        alt={imgName}
                        style={{ width: "100%", height: 100, objectFit: "cover", borderRadius: 5 }}
                      />
                      <button
                        onClick={() => handleDeleteImage(imgName)}
                        style={{
                          position: "absolute",
                          top: 5,
                          right: 5,
                          backgroundColor: "#dc3545",
                          color: "white",
                          border: "none",
                          borderRadius: 3,
                          padding: "2px 5px",
                          cursor: "pointer",
                          fontSize: 12
                        }}
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
