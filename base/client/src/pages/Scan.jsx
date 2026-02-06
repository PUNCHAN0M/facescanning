import React, { useRef, useEffect, useState } from "react";
import * as ort from "onnxruntime-web";

/* ================= CONFIG ================= */
const INPUT_SIZE = 640;
const CONF_THRESH = 0.6;
const NMS_THRESH = 0.4;
const STRIDES = [8, 16, 32];

const YOLO_INPUT = 640;
const YOLO_CONF = 0.5;
const PADDING_PX = 40;

/* ================= COMPONENT ================= */
export default function Scan() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cropCanvasRef = useRef(null);
  const alignCanvasRef = useRef(null);

  const sessionRef = useRef(null);
  const yoloRef = useRef(null);
  const rafRef = useRef(null);
  const lastTimeRef = useRef(performance.now());

  const [running, setRunning] = useState(false);
  const [fps, setFps] = useState(0);

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
      console.log("Models loaded");
    }
    load();
  }, []);

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

  /* ================= ALIGN DRAW ================= */
  function drawAlignedFace(crop, face) {
    const c = alignCanvasRef.current;
    if (!c || !face) return;

    // Fixed output size for aligned face
    const OUT = 256;
    c.width = OUT;
    c.height = OUT;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, OUT, OUT);

    // Assume SCRFD landmark order: [left_eye, right_eye, nose, mouth_left, mouth_right]
    const [bx1, by1, bx2, by2] = face.bbox;
    const bw = Math.max(1, bx2 - bx1);
    const bh = Math.max(1, by2 - by1);

    // Crop a tighter patch around the face bbox (small extra padding),
    // so we don't include YOLO padding/background in the aligned view.
    const extra = 0.08 * Math.max(bw, bh); // ~8% extra around bbox
    const px1 = Math.max(0, Math.floor(bx1 - extra));
    const py1 = Math.max(0, Math.floor(by1 - extra));
    const px2 = Math.min(crop.w, Math.ceil(bx2 + extra));
    const py2 = Math.min(crop.h, Math.ceil(by2 + extra));
    const pw = Math.max(1, px2 - px1);
    const ph = Math.max(1, py2 - py1);

    const patch = document.createElement("canvas");
    patch.width = pw;
    patch.height = ph;
    patch.getContext("2d").drawImage(crop.canvas, px1, py1, pw, ph, 0, 0, pw, ph);

    // Convert landmarks to patch-local coordinates
    const leftEye = { x: face.landmarks[0].x - px1, y: face.landmarks[0].y - py1 };
    const rightEye = { x: face.landmarks[1].x - px1, y: face.landmarks[1].y - py1 };

    const center = {
      x: (pw) / 2,
      y: (ph) / 2
    };

    const angle = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);

    // Smaller margin = less background border
    const margin = 1.1;
    const scale = Math.min(OUT / (pw * margin), OUT / (ph * margin));

    ctx.save();
    ctx.translate(OUT / 2, OUT / 2);
    ctx.rotate(-angle);
    ctx.scale(scale, scale);
    ctx.drawImage(patch, -center.x, -center.y);
    ctx.restore();

    // Optional: outline
    ctx.strokeStyle = "#888";
    ctx.strokeRect(0, 0, OUT, OUT);
  }

  /* ================= LOOP ================= */
  async function detectLoop() {
    if (!sessionRef.current || !yoloRef.current) return;

    const v = videoRef.current;
    const c = canvasRef.current;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext("2d");

    const yprep = preprocessYolo(v);
    let dets = parseYOLO(
      await yoloRef.current.run({ [yoloRef.current.inputNames[0]]: yprep.tensor }),
      yprep
    );

    dets = nms(dets)
      .sort((a, b) => b.conf * boxArea(b.bbox) - a.conf * boxArea(a.bbox))
      .slice(0, 1);

    ctx.clearRect(0, 0, c.width, c.height);

    for (const d of dets) {
      const crop = cropWithPad(v, d.bbox, PADDING_PX);
      const faces = parseSCRFD(
        await sessionRef.current.run({
          [sessionRef.current.inputNames[0]]: preprocess(crop.canvas)
        }),
        crop.w,
        crop.h
      );

      const best = pickBestFace(nms(faces));
      if (!best) continue;

      drawCrop(crop, best);
      drawAlignedFace(crop, best);

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
    <div style={{ display: "flex", gap: 20 }}>
      {/* Original video with overlay */}
      <div style={{ position: "relative" }}>
        <video ref={videoRef} muted playsInline />
        <canvas ref={canvasRef} style={{ position: "absolute", top: 0 }} />
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
      </div>
    </div>
  );
}
