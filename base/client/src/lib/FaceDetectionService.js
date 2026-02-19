/**
 * FaceDetectionService - Production-ready face detection service
 * 
 * Handles YOLO and SCRFD model inference for face detection and landmark extraction.
 * Uses ONNX Runtime Web for browser-based inference.
 * 
 * @author FaceScanning Team
 * @version 2.0.0
 */

import * as ort from "onnxruntime-web";

/* ================= CONFIGURATION ================= */
export const FaceDetectionConfig = Object.freeze({
  // SCRFD Configuration
  SCRFD: {
    INPUT_SIZE: 640,
    CONF_THRESHOLD: 0.6,
    NMS_THRESHOLD: 0.4,
    STRIDES: [8, 16, 32],
    MODEL_PATH: "/scrfd_2.5g.onnx"
  },
  
  // YOLO Configuration
  YOLO: {
    INPUT_SIZE: 640,
    CONF_THRESHOLD: 0.5,
    MODEL_PATH: "/yolov12n-face.onnx"
  },
  
  // MBF (MobileFaceNet) Configuration
  MBF: {
    INPUT_SIZE: 112,
    MODEL_PATH: "/w600k_mbf.onnx"
  },
  
  // ArcFace reference landmarks for 112x112 output
  ARCFACE_REF_112: Object.freeze([
    [38.2946, 51.6963],  // left_eye
    [73.5318, 51.5014],  // right_eye
    [56.0252, 71.7366],  // nose
    [41.5493, 92.3655],  // mouth_left
    [70.7299, 92.2041]   // mouth_right
  ])
});

/* ================= UTILITY FUNCTIONS ================= */
export class MathUtils {
  /**
   * Sigmoid activation function
   */
  static sigmoid(x) {
    return 1 / (1 + Math.exp(-x));
  }

  /**
   * Calculate IoU (Intersection over Union) between two bounding boxes
   */
  static iou(boxA, boxB) {
    const [ax1, ay1, ax2, ay2] = boxA;
    const [bx1, by1, bx2, by2] = boxB;
    
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

  /**
   * Calculate box area
   */
  static boxArea(bbox) {
    return Math.max(0, bbox[2] - bbox[0]) * Math.max(0, bbox[3] - bbox[1]);
  }

  /**
   * L2 normalize a vector
   */
  static l2Normalize(vec) {
    let sum = 0;
    for (let i = 0; i < vec.length; i++) {
      sum += vec[i] * vec[i];
    }
    const norm = Math.sqrt(sum) || 1;
    const out = new Float32Array(vec.length);
    for (let i = 0; i < vec.length; i++) {
      out[i] = vec[i] / norm;
    }
    return out;
  }

  /**
   * SVD for 2x2 matrix using analytical solution
   */
  static svd2x2(a, b, c, d) {
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
        u2x = -u1y;
        u2y = u1x;
      }
      U = [[u1x, u2x], [u1y, u2y]];
    } else {
      U = [[1, 0], [0, 1]];
    }

    return { U, S: [s1, s2], V };
  }
}

/* ================= FACE DETECTION SERVICE ================= */
export class FaceDetectionService {
  constructor() {
    this.scrfdSession = null;
    this.yoloSession = null;
    this.mbfSession = null;
    this.isInitialized = false;
    this.config = FaceDetectionConfig;
  }

  /**
   * Initialize all ONNX models
   */
  async initialize(options = {}) {
    const {
      executionProvider = "wasm",
      onProgress = null
    } = options;

    try {
      onProgress?.("Loading SCRFD model...");
      this.scrfdSession = await ort.InferenceSession.create(
        this.config.SCRFD.MODEL_PATH,
        { executionProviders: [executionProvider] }
      );

      onProgress?.("Loading YOLO model...");
      this.yoloSession = await ort.InferenceSession.create(
        this.config.YOLO.MODEL_PATH,
        { executionProviders: [executionProvider] }
      );

      onProgress?.("Loading MBF model...");
      this.mbfSession = await ort.InferenceSession.create(
        this.config.MBF.MODEL_PATH,
        { executionProviders: [executionProvider] }
      );

      this.isInitialized = true;
      onProgress?.("All models loaded successfully");
      
      return true;
    } catch (error) {
      console.error("[FaceDetectionService] Initialization failed:", error);
      throw new Error(`Model initialization failed: ${error.message}`);
    }
  }

  /**
   * Check if service is ready
   */
  isReady() {
    return this.isInitialized && this.scrfdSession && this.yoloSession && this.mbfSession;
  }

  /**
   * Preprocess image for YOLO detection
   */
  preprocessYOLO(videoElement) {
    const { INPUT_SIZE } = this.config.YOLO;
    const srcW = videoElement.videoWidth;
    const srcH = videoElement.videoHeight;
    
    const scale = Math.min(INPUT_SIZE / srcW, INPUT_SIZE / srcH);
    const newW = Math.round(srcW * scale);
    const newH = Math.round(srcH * scale);
    const padX = Math.floor((INPUT_SIZE - newW) / 2);
    const padY = Math.floor((INPUT_SIZE - newH) / 2);

    const canvas = document.createElement("canvas");
    canvas.width = INPUT_SIZE;
    canvas.height = INPUT_SIZE;
    const ctx = canvas.getContext("2d");
    
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
    ctx.drawImage(videoElement, 0, 0, srcW, srcH, padX, padY, newW, newH);

    const imgData = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE).data;
    const input = new Float32Array(1 * 3 * INPUT_SIZE * INPUT_SIZE);
    const hw = INPUT_SIZE * INPUT_SIZE;

    for (let i = 0; i < hw; i++) {
      input[i] = imgData[i * 4] / 255;
      input[hw + i] = imgData[i * 4 + 1] / 255;
      input[2 * hw + i] = imgData[i * 4 + 2] / 255;
    }

    return {
      tensor: new ort.Tensor("float32", input, [1, 3, INPUT_SIZE, INPUT_SIZE]),
      metadata: { scale, padX, padY, srcW, srcH }
    };
  }

  /**
   * Preprocess image for SCRFD detection
   */
  preprocessSCRFD(imageSource) {
    const { INPUT_SIZE } = this.config.SCRFD;
    
    const canvas = document.createElement("canvas");
    canvas.width = INPUT_SIZE;
    canvas.height = INPUT_SIZE;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(imageSource, 0, 0, INPUT_SIZE, INPUT_SIZE);

    const imgData = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE).data;
    const input = new Float32Array(1 * 3 * INPUT_SIZE * INPUT_SIZE);
    const hw = INPUT_SIZE * INPUT_SIZE;

    // BGR order with normalization
    for (let i = 0; i < hw; i++) {
      const r = imgData[i * 4];
      const g = imgData[i * 4 + 1];
      const b = imgData[i * 4 + 2];
      input[i] = (b - 127.5) / 128;
      input[hw + i] = (g - 127.5) / 128;
      input[2 * hw + i] = (r - 127.5) / 128;
    }

    return new ort.Tensor("float32", input, [1, 3, INPUT_SIZE, INPUT_SIZE]);
  }

  /**
   * Parse YOLO detection outputs
   */
  parseYOLOOutput(outputs, metadata) {
    const { CONF_THRESHOLD } = this.config.YOLO;
    const { scale, padX, padY, srcW, srcH } = metadata;
    
    const out = Object.values(outputs)[0];
    const data = out.data;
    const rows = data.length / 6;
    const boxes = [];

    for (let i = 0; i < rows; i++) {
      const offset = i * 6;
      const conf = data[offset + 4];
      
      if (conf < CONF_THRESHOLD) continue;

      const cx = data[offset];
      const cy = data[offset + 1];
      const w = data[offset + 2];
      const h = data[offset + 3];

      const x1 = (cx - w / 2 - padX) / scale;
      const y1 = (cy - h / 2 - padY) / scale;
      const x2 = (cx + w / 2 - padX) / scale;
      const y2 = (cy + h / 2 - padY) / scale;

      boxes.push({
        bbox: [
          Math.max(0, x1),
          Math.max(0, y1),
          Math.min(srcW, x2),
          Math.min(srcH, y2)
        ],
        conf
      });
    }
    
    return boxes;
  }

  /**
   * Parse SCRFD detection outputs with landmarks
   */
  parseSCRFDOutput(outputs, imgW, imgH) {
    const { INPUT_SIZE, CONF_THRESHOLD, STRIDES } = this.config.SCRFD;
    const faces = [];
    const outputValues = Object.values(outputs);
    
    const maps = {
      8: { s: outputValues[0].data, b: outputValues[1].data, k: outputValues[2].data },
      16: { s: outputValues[3].data, b: outputValues[4].data, k: outputValues[5].data },
      32: { s: outputValues[6].data, b: outputValues[7].data, k: outputValues[8].data }
    };

    STRIDES.forEach(stride => {
      const { s, b, k } = maps[stride];
      const fm = INPUT_SIZE / stride;
      const anchors = Math.max(1, Math.round(b.length / (fm * fm * 4)));
      const sPerAnchor = Math.max(1, Math.round(s.length / (fm * fm * anchors)));

      const total = fm * fm * anchors;
      
      for (let i = 0; i < total; i++) {
        const sIdx = i * sPerAnchor + (sPerAnchor - 1);
        const conf = MathUtils.sigmoid(s[sIdx]);
        
        if (conf < CONF_THRESHOLD) continue;

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

  /**
   * Apply Non-Maximum Suppression
   */
  applyNMS(faces) {
    const { NMS_THRESHOLD } = this.config.SCRFD;
    const sorted = [...faces].sort((a, b) => b.conf - a.conf);
    const kept = [];
    
    for (const face of sorted) {
      let shouldKeep = true;
      for (const keptFace of kept) {
        if (MathUtils.iou(face.bbox, keptFace.bbox) > NMS_THRESHOLD) {
          shouldKeep = false;
          break;
        }
      }
      if (shouldKeep) kept.push(face);
    }
    
    return kept;
  }

  /**
   * Pick the best face from detections
   */
  pickBestFace(faces) {
    if (!faces.length) return null;
    
    let best = faces[0];
    for (const face of faces.slice(1)) {
      const bestArea = MathUtils.boxArea(best.bbox);
      const faceArea = MathUtils.boxArea(face.bbox);
      
      if (face.conf > best.conf || 
          (Math.abs(face.conf - best.conf) < 1e-6 && faceArea > bestArea)) {
        best = face;
      }
    }
    
    return best;
  }

  /**
   * Crop region from video with padding
   */
  cropRegion(videoElement, bbox, padding = 0) {
    const x1 = Math.max(0, bbox[0] - padding);
    const y1 = Math.max(0, bbox[1] - padding);
    const x2 = Math.min(videoElement.videoWidth, bbox[2] + padding);
    const y2 = Math.min(videoElement.videoHeight, bbox[3] + padding);
    const w = x2 - x1;
    const h = y2 - y1;

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(videoElement, x1, y1, w, h, 0, 0, w, h);
    
    return { canvas, x1, y1, w, h };
  }

  /**
   * Run YOLO detection
   */
  async detectYOLO(videoElement) {
    if (!this.yoloSession) {
      throw new Error("YOLO session not initialized");
    }

    const { tensor, metadata } = this.preprocessYOLO(videoElement);
    const outputs = await this.yoloSession.run({
      [this.yoloSession.inputNames[0]]: tensor
    });
    
    return this.parseYOLOOutput(outputs, metadata);
  }

  /**
   * Run SCRFD landmark detection on cropped region
   */
  async detectSCRFDLandmarks(cropCanvas) {
    if (!this.scrfdSession) {
      throw new Error("SCRFD session not initialized");
    }

    const tensor = this.preprocessSCRFD(cropCanvas);
    const outputs = await this.scrfdSession.run({
      [this.scrfdSession.inputNames[0]]: tensor
    });
    
    return this.parseSCRFDOutput(outputs, cropCanvas.width, cropCanvas.height);
  }

  /**
   * Cleanup resources
   */
  dispose() {
    this.scrfdSession = null;
    this.yoloSession = null;
    this.mbfSession = null;
    this.isInitialized = false;
  }
}

/* ================= SINGLETON INSTANCE ================= */
let serviceInstance = null;

export function getFaceDetectionService() {
  if (!serviceInstance) {
    serviceInstance = new FaceDetectionService();
  }
  return serviceInstance;
}

export default FaceDetectionService;
