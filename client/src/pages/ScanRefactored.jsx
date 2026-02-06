/**
 * Scan Page Component - Production-ready face scanning interface
 * 
 * Main component for real-time face detection, alignment, and recognition.
 * Uses modular services for clean separation of concerns.
 * 
 * @author FaceScanning Team
 * @version 2.0.0
 */

import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  getFaceDetectionService,
  getFaceAlignmentService,
  getEmbeddingService,
  getAPIService,
  FaceDetectionConfig
} from "../lib";

/* ================= CUSTOM HOOKS ================= */

/**
 * Hook for managing camera stream
 */
function useCamera() {
  const videoRef = useRef(null);
  const [isRunning, setIsRunning] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "user" } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsRunning(true);
      }
      return true;
    } catch (error) {
      console.error("[useCamera] Failed to start:", error);
      return false;
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsRunning(false);
  }, []);

  return { videoRef, isRunning, startCamera, stopCamera };
}

/**
 * Hook for managing organizes and members
 */
function useOrganizeManagement() {
  const api = getAPIService();
  
  const [organizes, setOrganizes] = useState([]);
  const [selectedOrganize, setSelectedOrganize] = useState("");
  const [members, setMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchOrganizes = useCallback(async () => {
    try {
      const data = await api.getOrganizes();
      setOrganizes(data);
      return data;
    } catch (error) {
      console.error("[useOrganizeManagement] Fetch failed:", error);
      return [];
    }
  }, []);

  const fetchMembers = useCallback(async (organizeName) => {
    if (!organizeName) {
      setMembers([]);
      return;
    }
    setIsLoading(true);
    try {
      const data = await api.getOrganizeDetails(organizeName);
      setMembers(data.members || []);
    } catch (error) {
      console.error("[useOrganizeManagement] Fetch members failed:", error);
      setMembers([]);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchOrganizes().then(orgs => {
      if (!selectedOrganize && orgs.length > 0) {
        setSelectedOrganize(orgs[0]);
      }
    });
  }, []);

  useEffect(() => {
    fetchMembers(selectedOrganize);
  }, [selectedOrganize, fetchMembers]);

  return {
    organizes,
    selectedOrganize,
    setSelectedOrganize,
    members,
    isLoading,
    fetchOrganizes,
    fetchMembers
  };
}

/* ================= MAIN COMPONENT ================= */
export default function Scan() {
  // Services
  const detectionService = getFaceDetectionService();
  const alignmentService = getFaceAlignmentService();
  const embeddingService = getEmbeddingService();
  const api = getAPIService();

  // Camera hook
  const { videoRef, isRunning, startCamera, stopCamera } = useCamera();

  // Canvas refs
  const canvasRef = useRef(null);
  const cropCanvasRef = useRef(null);
  const alignCanvasRef = useRef(null);

  // Detection loop refs
  const rafRef = useRef(null);
  const lastTimeRef = useRef(performance.now());

  // State
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [fps, setFps] = useState(0);
  const [embeddingDims, setEmbeddingDims] = useState(null);
  const [matchPerson, setMatchPerson] = useState("-");
  const [matchSimilarity, setMatchSimilarity] = useState("-");

  // Timing state
  const [timingInfo, setTimingInfo] = useState({
    detection: 0,
    crop: 0,
    align: 0,
    embedding: 0,
    search: 0,
    total: 0
  });

  // Organize management
  const {
    organizes,
    selectedOrganize,
    setSelectedOrganize,
    members,
    isLoading,
    fetchOrganizes,
    fetchMembers
  } = useOrganizeManagement();

  // Organize/Member management state
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [newOrganizeName, setNewOrganizeName] = useState("");
  const [newMemberName, setNewMemberName] = useState("");

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [currentMember, setCurrentMember] = useState(null);
  const [memberImages, setMemberImages] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const videoModalRef = useRef(null);

  /* ================= MODEL LOADING ================= */
  useEffect(() => {
    async function loadModels() {
      try {
        await detectionService.initialize({
          onProgress: (msg) => console.log(`[ModelLoad] ${msg}`)
        });
        await embeddingService.initialize();
        setIsModelLoaded(true);
        console.log("[Scan] All models loaded");
      } catch (error) {
        console.error("[Scan] Model loading failed:", error);
      }
    }
    loadModels();
  }, []);

  /* ================= DETECTION LOOP ================= */
  const detectLoop = useCallback(async () => {
    if (!detectionService.isReady() || !embeddingService.isReady()) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(detectLoop);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Timing variables
    const tStart = performance.now();
    let tDetection = 0, tCrop = 0, tAlign = 0, tEmbed = 0, tSearch = 0;

    try {
      // YOLO Detection
      const tDetectStart = performance.now();
      let detections = await detectionService.detectYOLO(video);
      detections = detectionService.applyNMS(detections)
        .sort((a, b) => b.conf * detectionService.config.boxArea?.(b.bbox) - 
                        a.conf * detectionService.config.boxArea?.(a.bbox))
        .slice(0, 1);
      tDetection = performance.now() - tDetectStart;

      for (const det of detections) {
        // Crop and detect landmarks
        const tCropStart = performance.now();
        const crop = detectionService.cropRegion(video, det.bbox, 0);
        const faces = await detectionService.detectSCRFDLandmarks(crop.canvas);
        const bestFace = detectionService.pickBestFace(
          detectionService.applyNMS(faces)
        );
        tCrop = performance.now() - tCropStart;

        if (!bestFace) continue;

        // Draw crop with landmarks
        const tAlignStart = performance.now();
        if (cropCanvasRef.current) {
          alignmentService.drawCroppedFace(crop, bestFace, cropCanvasRef.current);
        }

        // Align face
        if (alignCanvasRef.current) {
          alignmentService.alignFace(crop.canvas, bestFace, alignCanvasRef.current);
        }
        tAlign = performance.now() - tAlignStart;

        // Extract embedding and search
        try {
          const tEmbedStart = performance.now();
          const embedding = await embeddingService.extractEmbedding(alignCanvasRef.current);
          tEmbed = performance.now() - tEmbedStart;
          
          if (embedding) {
            if (!embeddingDims) {
              setEmbeddingDims(embedding.length);
            }

            // Search for match
            const tSearchStart = performance.now();
            const result = await api.searchByEmbedding(
              selectedOrganize,
              embedding,
              1
            );
            tSearch = performance.now() - tSearchStart;

            if (result) {
              setMatchPerson(result.person || "unknown");
              setMatchSimilarity(
                result.similarity !== null ? result.similarity.toFixed(4) : "-"
              );
            }
          }
        } catch (embError) {
          console.warn("[Scan] Embedding error:", embError);
        }

        // Draw bounding box on overlay
        const globalBox = [
          crop.x1 + bestFace.bbox[0],
          crop.y1 + bestFace.bbox[1],
          crop.x1 + bestFace.bbox[2],
          crop.y1 + bestFace.bbox[3]
        ];

        ctx.strokeStyle = "lime";
        ctx.lineWidth = 2;
        ctx.strokeRect(
          globalBox[0],
          globalBox[1],
          globalBox[2] - globalBox[0],
          globalBox[3] - globalBox[1]
        );

        // Draw landmarks
        ctx.fillStyle = "red";
        bestFace.landmarks.forEach(p => {
          ctx.beginPath();
          ctx.arc(crop.x1 + p.x, crop.y1 + p.y, 3, 0, Math.PI * 2);
          ctx.fill();
        });

        // Update timing info
        const tTotal = performance.now() - tStart;
        setTimingInfo({
          detection: tDetection,
          crop: tCrop,
          align: tAlign,
          embedding: tEmbed,
          search: tSearch,
          total: tTotal
        });
      }
    } catch (error) {
      console.error("[Scan] Detection error:", error);
    }

    // Update FPS
    const now = performance.now();
    setFps(Math.round(1000 / (now - lastTimeRef.current)));
    lastTimeRef.current = now;

    rafRef.current = requestAnimationFrame(detectLoop);
  }, [selectedOrganize, embeddingDims]);

  /* ================= CAMERA CONTROL ================= */
  const handleStart = async () => {
    const started = await startCamera();
    if (started) {
      detectLoop();
    }
  };

  const handleStop = () => {
    cancelAnimationFrame(rafRef.current);
    stopCamera();
    setMatchPerson("-");
    setMatchSimilarity("-");
  };

  /* ================= ORGANIZE MANAGEMENT ================= */
  const handleAddOrganize = async () => {
    if (!newOrganizeName.trim()) {
      alert("กรุณากรอกชื่อ organize");
      return;
    }
    try {
      await api.createOrganize(newOrganizeName);
      setNewOrganizeName("");
      await fetchOrganizes();
      alert("สร้าง organize สำเร็จ");
    } catch (error) {
      alert(error.message || "เกิดข้อผิดพลาด");
    }
  };

  const handleEditOrganize = async (oldName) => {
    const newName = prompt("กรุณากรอกชื่อ organize ใหม่:", oldName);
    if (!newName || newName.trim() === oldName) return;
    try {
      await api.renameOrganize(oldName, newName);
      if (selectedOrganize === oldName) {
        setSelectedOrganize(newName.trim());
      }
      await fetchOrganizes();
      alert("✅ เปลี่ยนชื่อสำเร็จ");
    } catch (error) {
      alert(`❌ ${error.message}`);
    }
  };

  const handleDeleteOrganize = async (organizeName) => {
    if (!confirm(`ต้องการลบ organize "${organizeName}" หรือไม่?`)) return;
    try {
      await api.deleteOrganize(organizeName);
      if (selectedOrganize === organizeName) {
        setSelectedOrganize("");
      }
      await fetchOrganizes();
      alert("✅ ลบสำเร็จ");
    } catch (error) {
      alert(`❌ ${error.message}`);
    }
  };

  /* ================= MEMBER MANAGEMENT ================= */
  const handleAddMember = async () => {
    if (!selectedOrganize || !newMemberName.trim()) {
      alert("กรุณาเลือก organize และกรอกชื่อสมาชิก");
      return;
    }
    try {
      await api.addMember(selectedOrganize, newMemberName);
      setNewMemberName("");
      await fetchMembers(selectedOrganize);
      alert("เพิ่มสมาชิกสำเร็จ");
    } catch (error) {
      alert(error.message || "เกิดข้อผิดพลาด");
    }
  };

  const handleEditMember = async (member) => {
    const newName = prompt("กรุณากรอกชื่อสมาชิกใหม่:", member.person_name);
    if (!newName || newName.trim() === member.person_name) return;
    try {
      await api.renameMember(selectedOrganize, member.person_name, newName);
      await fetchMembers(selectedOrganize);
      alert("✅ เปลี่ยนชื่อสำเร็จ");
    } catch (error) {
      alert(`❌ ${error.message}`);
    }
  };

  const handleDeleteMember = async (member) => {
    if (!confirm(`ต้องการลบสมาชิก "${member.person_name}" หรือไม่?`)) return;
    try {
      await api.deleteMember(selectedOrganize, member.person_name);
      await fetchMembers(selectedOrganize);
      alert("✅ ลบสำเร็จ");
    } catch (error) {
      alert(`❌ ${error.message}`);
    }
  };

  const handleRebuildVectors = async () => {
    if (!selectedOrganize) return;
    if (!confirm("ต้องการบีบอัด vector หรือไม่?")) return;
    
    setIsRebuilding(true);
    try {
      const result = await api.rebuildVectors(selectedOrganize);
      await fetchMembers(selectedOrganize);
      alert(`✅ ${result.message}\nTotal vectors: ${result.total_vectors}`);
    } catch (error) {
      alert(`❌ ${error.message}`);
    }
    setIsRebuilding(false);
  };

  /* ================= IMAGE MANAGEMENT ================= */
  const openImageModal = async (member) => {
    setCurrentMember(member);
    setShowModal(true);
    try {
      const images = await api.getMemberImages(selectedOrganize, member.person_name);
      setMemberImages(images);
    } catch (error) {
      console.error("Failed to fetch images:", error);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setCurrentMember(null);
    setMemberImages([]);
    setSelectedFile(null);
    stopModalCamera();
  };

  const startModalCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoModalRef.current) {
        videoModalRef.current.srcObject = stream;
      }
      setIsCameraOn(true);
    } catch (error) {
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
    try {
      let file = selectedFile;
      
      if (!file && isCameraOn && videoModalRef.current) {
        const canvas = document.createElement("canvas");
        canvas.width = videoModalRef.current.videoWidth;
        canvas.height = videoModalRef.current.videoHeight;
        canvas.getContext("2d").drawImage(videoModalRef.current, 0, 0);
        const blob = await new Promise(resolve => 
          canvas.toBlob(resolve, "image/jpeg")
        );
        file = new File([blob], "captured.jpg", { type: "image/jpeg" });
      }

      await api.uploadMemberImage(selectedOrganize, currentMember.person_name, file);
      setSelectedFile(null);
      
      const images = await api.getMemberImages(selectedOrganize, currentMember.person_name);
      setMemberImages(images);
      await fetchMembers(selectedOrganize);
      
      alert("อัปโหลดสำเร็จ");
    } catch (error) {
      alert(error.message || "เกิดข้อผิดพลาด");
    }
    setIsUploading(false);
  };

  const handleDeleteImage = async (filename) => {
    if (!confirm(`ต้องการลบภาพ ${filename} หรือไม่?`)) return;
    try {
      await api.deleteMemberImage(selectedOrganize, currentMember.person_name, filename);
      const images = await api.getMemberImages(selectedOrganize, currentMember.person_name);
      setMemberImages(images);
      await fetchMembers(selectedOrganize);
      alert("ลบสำเร็จ");
    } catch (error) {
      alert(error.message || "เกิดข้อผิดพลาด");
    }
  };

  /* ================= RENDER ================= */
  return (
    <div style={{ padding: 20 }}>
      <h1>Face Scanning</h1>
      
      {!isModelLoaded && (
        <div style={{ padding: 20, backgroundColor: "#fff3cd", marginBottom: 20, borderRadius: 8 }}>
          <p>⏳ กำลังโหลดโมเดล...</p>
        </div>
      )}
      
      {/* 3 Columns Layout */}
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(3, 1fr)", 
        gap: 20, 
        marginBottom: 20,
        alignItems: "start"
      }}>
        {/* Col 1: Original + BBox */}
        <div style={{ 
          backgroundColor: "#f8f9fa", 
          padding: 15, 
          borderRadius: 8,
          border: "1px solid #dee2e6"
        }}>
          <h3 style={{ margin: "0 0 10px 0", fontSize: 16, color: "#495057" }}>
            📹 Original + BBox
          </h3>
          <div style={{ position: "relative", width: "100%" }}>
            <video 
              ref={videoRef} 
              muted 
              playsInline 
              style={{ width: "100%", borderRadius: 4, backgroundColor: "#000" }} 
            />
            <canvas 
              ref={canvasRef} 
              style={{ 
                position: "absolute", 
                top: 0, 
                left: 0, 
                width: "100%", 
                height: "100%",
                pointerEvents: "none" 
              }} 
            />
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}>
            {!isRunning ? (
              <button 
                onClick={handleStart} 
                disabled={!isModelLoaded}
                style={{
                  padding: "8px 20px",
                  backgroundColor: isModelLoaded ? "#28a745" : "#ccc",
                  color: "white",
                  border: "none",
                  borderRadius: 4,
                  cursor: isModelLoaded ? "pointer" : "not-allowed",
                  fontWeight: "bold"
                }}
              >
                ▶ Start
              </button>
            ) : (
              <button 
                onClick={handleStop}
                style={{
                  padding: "8px 20px",
                  backgroundColor: "#dc3545",
                  color: "white",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontWeight: "bold"
                }}
              >
                ⏹ Stop
              </button>
            )}
            <span style={{ 
              padding: "4px 12px", 
              backgroundColor: "#e9ecef", 
              borderRadius: 4,
              fontSize: 14,
              fontWeight: "bold",
              color: fps > 15 ? "#28a745" : fps > 5 ? "#ffc107" : "#dc3545"
            }}>
              {fps} FPS
            </span>
          </div>
        </div>

        {/* Col 2: Cropped Face */}
        <div style={{ 
          backgroundColor: "#f8f9fa", 
          padding: 15, 
          borderRadius: 8,
          border: "1px solid #dee2e6"
        }}>
          <h3 style={{ margin: "0 0 10px 0", fontSize: 16, color: "#495057" }}>
            ✂️ YOLO Cropped + Keypoints
          </h3>
          <div style={{ 
            width: "100%", 
            minHeight: 200,
            backgroundColor: "#e9ecef",
            borderRadius: 4,
            display: "flex",
            justifyContent: "center",
            alignItems: "center"
          }}>
            <canvas 
              ref={cropCanvasRef} 
              style={{ 
                position: "static",
                maxWidth: "100%", 
                maxHeight: 300,
                borderRadius: 4
              }} 
            />
          </div>
        </div>

        {/* Col 3: Aligned Face */}
        <div style={{ 
          backgroundColor: "#f8f9fa", 
          padding: 15, 
          borderRadius: 8,
          border: "1px solid #dee2e6"
        }}>
          <h3 style={{ margin: "0 0 10px 0", fontSize: 16, color: "#495057" }}>
            🎯 Aligned Face (112x112)
          </h3>
          <div style={{ 
            width: "100%", 
            minHeight: 200,
            backgroundColor: "#e9ecef",
            borderRadius: 4,
            display: "flex",
            justifyContent: "center",
            alignItems: "center"
          }}>
            <canvas 
              ref={alignCanvasRef} 
              style={{ 
                position: "static",
                maxWidth: "100%",
                maxHeight: 300,
                borderRadius: 4,
                imageRendering: "pixelated"
              }} 
            />
          </div>
          <p style={{ margin: "10px 0 0 0", fontSize: 13, color: "#6c757d" }}>
            Embedding: {embeddingDims ? `${embeddingDims} dims` : "-"}
          </p>
        </div>
      </div>

      {/* Detection Result */}
      <div style={{ 
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 20,
        marginBottom: 20
      }}>
        {/* Result Card */}
        <div style={{ 
          padding: 20, 
          backgroundColor: "#f8f9fa", 
          borderRadius: 8,
          border: "1px solid #dee2e6"
        }}>
          <h3 style={{ margin: "0 0 15px 0", fontSize: 18, color: "#212529" }}>
            🔍 Detection Result
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between",
              padding: "10px 15px",
              backgroundColor: "#fff",
              borderRadius: 4,
              border: "1px solid #dee2e6"
            }}>
              <span style={{ fontWeight: "bold", color: "#495057" }}>Current Detection:</span>
              <span style={{ 
                fontWeight: "bold", 
                color: matchPerson !== "-" && matchPerson !== "unknown" ? "#28a745" : "#6c757d",
                fontSize: 16
              }}>
                {matchPerson}
              </span>
            </div>
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between",
              padding: "10px 15px",
              backgroundColor: "#fff",
              borderRadius: 4,
              border: "1px solid #dee2e6"
            }}>
              <span style={{ fontWeight: "bold", color: "#495057" }}>Confidence:</span>
              <span style={{ 
                fontWeight: "bold", 
                color: matchSimilarity !== "-" ? "#007bff" : "#6c757d" 
              }}>
                {matchSimilarity}
              </span>
            </div>
          </div>
        </div>

        {/* Timing Card */}
        <div style={{ 
          padding: 20, 
          backgroundColor: "#f8f9fa", 
          borderRadius: 8,
          border: "1px solid #dee2e6"
        }}>
          <h3 style={{ margin: "0 0 15px 0", fontSize: 18, color: "#212529" }}>
            ⏱️ Processing Time / Image
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
              <span style={{ color: "#495057" }}>🎯 YOLO Detection:</span>
              <span style={{ fontWeight: "bold", color: "#6f42c1" }}>{timingInfo.detection.toFixed(1)} ms</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
              <span style={{ color: "#495057" }}>✂️ Crop + SCRFD:</span>
              <span style={{ fontWeight: "bold", color: "#fd7e14" }}>{timingInfo.crop.toFixed(1)} ms</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
              <span style={{ color: "#495057" }}>📐 Face Alignment:</span>
              <span style={{ fontWeight: "bold", color: "#20c997" }}>{timingInfo.align.toFixed(1)} ms</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
              <span style={{ color: "#495057" }}>🧠 Embedding:</span>
              <span style={{ fontWeight: "bold", color: "#17a2b8" }}>{timingInfo.embedding.toFixed(1)} ms</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
              <span style={{ color: "#495057" }}>🔎 Search:</span>
              <span style={{ fontWeight: "bold", color: "#6c757d" }}>{timingInfo.search.toFixed(1)} ms</span>
            </div>
            <hr style={{ margin: "8px 0", border: "none", borderTop: "1px solid #dee2e6" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15 }}>
              <span style={{ fontWeight: "bold", color: "#212529" }}>📊 Total:</span>
              <span style={{ 
                fontWeight: "bold", 
                color: timingInfo.total < 100 ? "#28a745" : timingInfo.total < 200 ? "#ffc107" : "#dc3545",
                fontSize: 16
              }}>
                {timingInfo.total.toFixed(1)} ms
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Organize Management */}
      <div style={{ marginTop: 20, padding: 20, backgroundColor: "#fafafa", borderRadius: 8 }}>
        <h2>Organize Management</h2>
        
        <div style={{ marginBottom: 15 }}>
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
          <span>({organizes.length} organize{organizes.length !== 1 ? "s" : ""})</span>
          
          {selectedOrganize && (
            <span style={{ marginLeft: 10 }}>
              <button 
                onClick={() => handleEditOrganize(selectedOrganize)}
                style={{ backgroundColor: "#ffa500", color: "white", padding: "5px 10px", border: "none", borderRadius: 3, marginRight: 5, cursor: "pointer" }}
              >
                แก้ไข
              </button>
              <button 
                onClick={() => handleDeleteOrganize(selectedOrganize)}
                style={{ backgroundColor: "#dc3545", color: "white", padding: "5px 10px", border: "none", borderRadius: 3, cursor: "pointer" }}
              >
                ลบ
              </button>
            </span>
          )}
          
          <div style={{ marginTop: 10 }}>
            <input
              type="text"
              placeholder="ชื่อ organize ใหม่"
              value={newOrganizeName}
              onChange={(e) => setNewOrganizeName(e.target.value)}
              style={{ padding: "5px 10px", marginRight: 10 }}
            />
            <button onClick={handleAddOrganize}>เพิ่ม organize ใหม่</button>
          </div>
        </div>

        {selectedOrganize && (
          <>
            <h3>Members in {selectedOrganize}</h3>
            <div style={{ marginBottom: 15 }}>
              <input
                type="text"
                placeholder="ชื่อสมาชิกใหม่"
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                style={{ padding: "5px 10px", marginRight: 10 }}
              />
              <button onClick={handleAddMember}>เพิ่มสมาชิกใหม่</button>
            </div>

            {isLoading ? (
              <p>Loading...</p>
            ) : members.length > 0 ? (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
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
                          style={{ backgroundColor: "#ffa500", color: "white", padding: "5px 10px", border: "none", borderRadius: 3, marginRight: 5, cursor: "pointer" }}
                        >
                          แก้ไข
                        </button>
                        <button 
                          onClick={() => openImageModal(member)}
                          style={{ backgroundColor: "#007bff", color: "white", padding: "5px 10px", border: "none", borderRadius: 3, marginRight: 5, cursor: "pointer" }}
                        >
                          {member.image_count > 0 ? "แก้ไขรูปภาพ" : "เพิ่มรูปภาพ"}
                        </button>
                        <button 
                          onClick={() => handleDeleteMember(member)}
                          style={{ backgroundColor: "#dc3545", color: "white", padding: "5px 10px", border: "none", borderRadius: 3, cursor: "pointer" }}
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
                {isRebuilding ? "กำลังบีบอัด..." : "บีบอัด Vector"}
              </button>
            )}
          </>
        )}
      </div>

      {/* Image Management Modal */}
      {showModal && currentMember && (
        <div 
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

            <div style={{ marginTop: 20 }}>
              <h3>เพิ่มรูปภาพ</h3>
              <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setSelectedFile(e.target.files[0])}
                    disabled={isUploading || isCameraOn}
                  />
                  {selectedFile && <span style={{ marginLeft: 10 }}>✓ {selectedFile.name}</span>}
                </div>
                <div>
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
                        style={{ width: "100%", maxWidth: 400, marginTop: 10, display: "block" }}
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
                {isUploading ? "กำลังอัปโหลด..." : "อัปโหลด"}
              </button>
            </div>

            <div style={{ marginTop: 20 }}>
              <h3>รูปภาพทั้งหมด ({memberImages.length})</h3>
              {memberImages.length > 0 ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10 }}>
                  {memberImages.map((imgName) => (
                    <div key={imgName} style={{ position: "relative" }}>
                      <img
                        src={api.getImageUrl(selectedOrganize, currentMember.person_name, imgName)}
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
