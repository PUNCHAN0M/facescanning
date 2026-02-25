/**
 * FaceDetectionService
 *
 * Handles YOLO face detection and SCRFD landmark extraction
 * using ONNX Runtime Web for browser-based inference.
 */

import * as ort from "onnxruntime-web";

/* ================= CONFIGURATION ================= */
export const FaceDetectionConfig = Object.freeze({
  SCRFD: {
    INPUT_SIZE: 640,
    CONFIDENCE_THRESHOLD: 0.6,
    NMS_THRESHOLD: 0.4,
    STRIDES: [8, 16, 32],
    MODEL_PATH: "/scrfd_2.5g.onnx",
  },
  YOLO: {
    INPUT_SIZE: 640,
    CONFIDENCE_THRESHOLD: 0.5,
    MODEL_PATH: "/yolov12n-face.onnx",
  },
  ARCFACE_INPUT_SIZE: 112,
  ARCFACE_REFERENCE_LANDMARKS_112: Object.freeze([
    [38.2946, 51.6963],
    [73.5318, 51.5014],
    [56.0252, 71.7366],
    [41.5493, 92.3655],
    [70.7299, 92.2041],
  ]),
});

/**
 * Available embedding models.
 * Each model produces 512-d embeddings but from different architectures.
 * Client and server MUST use the same model for vectors to match.
 */
export const EMBEDDING_MODELS = Object.freeze({
   r100: {
    key: "r100",
    label: "R100 (ResNet-100)",
    modelPath: "/r100.onnx",
    externalData: "/r100.onnx_data",
    sizeMB: 249,
    description: "Highest accuracy, slowest",
  },
  w600k_r50: {
    key: "w600k_r50",
    label: "W600K R50 (ResNet-50)",
    modelPath: "/w600k_r50.onnx",
    externalData: "/w600k_r50.onnx_data",
    sizeMB: 166,
    description: "High accuracy, slower",
  },
  w600k_mbf: {
    key: "w600k_mbf",
    label: "W600K MBF (MobileFaceNet)",
    modelPath: "/w600k_mbf.onnx",
    externalData: null,
    sizeMB: 13,
    description: "Fast, lightweight",
  },
 
});

export const DEFAULT_EMBEDDING_MODEL = "w600k_r50";

/* ================= MATH UTILITIES ================= */
export class MathUtils {
  static sigmoid(value) {
    return 1 / (1 + Math.exp(-value));
  }

  static calculateIntersectionOverUnion(boxA, boxB) {
    const [ax1, ay1, ax2, ay2] = boxA;
    const [bx1, by1, bx2, by2] = boxB;

    const intersectX1 = Math.max(ax1, bx1);
    const intersectY1 = Math.max(ay1, by1);
    const intersectX2 = Math.min(ax2, bx2);
    const intersectY2 = Math.min(ay2, by2);

    const intersectWidth = Math.max(0, intersectX2 - intersectX1);
    const intersectHeight = Math.max(0, intersectY2 - intersectY1);
    const intersectArea = intersectWidth * intersectHeight;

    const areaA = (ax2 - ax1) * (ay2 - ay1);
    const areaB = (bx2 - bx1) * (by2 - by1);

    return intersectArea / (areaA + areaB - intersectArea + 1e-6);
  }

  static calculateBoundingBoxArea(bbox) {
    return Math.max(0, bbox[2] - bbox[0]) * Math.max(0, bbox[3] - bbox[1]);
  }

  static l2Normalize(vector) {
    let squaredSum = 0;
    for (let i = 0; i < vector.length; i++) {
      squaredSum += vector[i] * vector[i];
    }
    const norm = Math.sqrt(squaredSum) || 1;
    const normalized = new Float32Array(vector.length);
    for (let i = 0; i < vector.length; i++) {
      normalized[i] = vector[i] / norm;
    }
    return normalized;
  }

  static computeSVD2x2(a, b, c, d) {
    const ata00 = a * a + c * c;
    const ata01 = a * b + c * d;
    const ata11 = b * b + d * d;

    const trace = ata00 + ata11;
    const determinant = ata00 * ata11 - ata01 * ata01;
    const discriminant = Math.sqrt(Math.max(0, trace * trace / 4 - determinant));
    const singularSquared1 = trace / 2 + discriminant;
    const singularSquared2 = trace / 2 - discriminant;
    const singular1 = Math.sqrt(Math.max(0, singularSquared1));
    const singular2 = Math.sqrt(Math.max(0, singularSquared2));

    let V;
    if (Math.abs(ata01) > 1e-10) {
      const v1x = ata01;
      const v1y = singularSquared1 - ata00;
      const length1 = Math.hypot(v1x, v1y) || 1;
      const v2x = ata01;
      const v2y = singularSquared2 - ata00;
      const length2 = Math.hypot(v2x, v2y) || 1;
      V = [
        [v1x / length1, v2x / length2],
        [v1y / length1, v2y / length2],
      ];
    } else {
      V = [
        [1, 0],
        [0, 1],
      ];
    }

    let U;
    if (singular1 > 1e-10) {
      const u1x = (a * V[0][0] + b * V[1][0]) / singular1;
      const u1y = (c * V[0][0] + d * V[1][0]) / singular1;
      let u2x, u2y;
      if (singular2 > 1e-10) {
        u2x = (a * V[0][1] + b * V[1][1]) / singular2;
        u2y = (c * V[0][1] + d * V[1][1]) / singular2;
      } else {
        u2x = -u1y;
        u2y = u1x;
      }
      U = [
        [u1x, u2x],
        [u1y, u2y],
      ];
    } else {
      U = [
        [1, 0],
        [0, 1],
      ];
    }

    return { U, S: [singular1, singular2], V };
  }
}

/* ================= FACE DETECTION SERVICE ================= */
export class FaceDetectionService {
  constructor() {
    this.scrfdSession = null;
    this.yoloSession = null;
    this.isInitialized = false;
  }

  async initialize(options = {}) {
    const { executionProvider = "wasm", onProgress = null } = options;

    try {
      onProgress?.("Loading SCRFD model...");
      this.scrfdSession = await ort.InferenceSession.create(
        FaceDetectionConfig.SCRFD.MODEL_PATH,
        { executionProviders: [executionProvider] }
      );

      onProgress?.("Loading YOLO model...");
      this.yoloSession = await ort.InferenceSession.create(
        FaceDetectionConfig.YOLO.MODEL_PATH,
        { executionProviders: [executionProvider] }
      );

      this.isInitialized = true;
      onProgress?.("Detection models loaded");
      return true;
    } catch (error) {
      console.error("[FaceDetectionService] Initialization failed:", error);
      throw new Error(`Detection model initialization failed: ${error.message}`);
    }
  }

  isReady() {
    return this.isInitialized && this.scrfdSession && this.yoloSession;
  }

  preprocessForYOLO(videoElement) {
    const { INPUT_SIZE } = FaceDetectionConfig.YOLO;
    const sourceWidth = videoElement.videoWidth;
    const sourceHeight = videoElement.videoHeight;

    const scale = Math.min(INPUT_SIZE / sourceWidth, INPUT_SIZE / sourceHeight);
    const newWidth = Math.round(sourceWidth * scale);
    const newHeight = Math.round(sourceHeight * scale);
    const paddingX = Math.floor((INPUT_SIZE - newWidth) / 2);
    const paddingY = Math.floor((INPUT_SIZE - newHeight) / 2);

    const canvas = document.createElement("canvas");
    canvas.width = INPUT_SIZE;
    canvas.height = INPUT_SIZE;
    const context = canvas.getContext("2d");

    context.fillStyle = "black";
    context.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
    context.drawImage(videoElement, 0, 0, sourceWidth, sourceHeight, paddingX, paddingY, newWidth, newHeight);

    const imageData = context.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE).data;
    const inputArray = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE);
    const pixelCount = INPUT_SIZE * INPUT_SIZE;

    for (let i = 0; i < pixelCount; i++) {
      inputArray[i] = imageData[i * 4] / 255;
      inputArray[pixelCount + i] = imageData[i * 4 + 1] / 255;
      inputArray[2 * pixelCount + i] = imageData[i * 4 + 2] / 255;
    }

    return {
      tensor: new ort.Tensor("float32", inputArray, [1, 3, INPUT_SIZE, INPUT_SIZE]),
      metadata: { scale, paddingX, paddingY, sourceWidth, sourceHeight },
    };
  }

  preprocessForSCRFD(imageSource) {
    const { INPUT_SIZE } = FaceDetectionConfig.SCRFD;

    const canvas = document.createElement("canvas");
    canvas.width = INPUT_SIZE;
    canvas.height = INPUT_SIZE;
    const context = canvas.getContext("2d");
    context.drawImage(imageSource, 0, 0, INPUT_SIZE, INPUT_SIZE);

    const imageData = context.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE).data;
    const inputArray = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE);
    const pixelCount = INPUT_SIZE * INPUT_SIZE;

    for (let i = 0; i < pixelCount; i++) {
      const r = imageData[i * 4];
      const g = imageData[i * 4 + 1];
      const b = imageData[i * 4 + 2];
      inputArray[i] = (b - 127.5) / 128;
      inputArray[pixelCount + i] = (g - 127.5) / 128;
      inputArray[2 * pixelCount + i] = (r - 127.5) / 128;
    }

    return new ort.Tensor("float32", inputArray, [1, 3, INPUT_SIZE, INPUT_SIZE]);
  }

  parseYOLODetections(outputs, metadata) {
    const { CONFIDENCE_THRESHOLD } = FaceDetectionConfig.YOLO;
    const { scale, paddingX, paddingY, sourceWidth, sourceHeight } = metadata;

    const outputTensor = Object.values(outputs)[0];
    const data = outputTensor.data;
    const rowCount = data.length / 6;
    const detections = [];

    for (let i = 0; i < rowCount; i++) {
      const offset = i * 6;
      const confidence = data[offset + 4];
      if (confidence < CONFIDENCE_THRESHOLD) continue;

      const centerX = data[offset];
      const centerY = data[offset + 1];
      const width = data[offset + 2];
      const height = data[offset + 3];

      detections.push({
        bbox: [
          Math.max(0, (centerX - width / 2 - paddingX) / scale),
          Math.max(0, (centerY - height / 2 - paddingY) / scale),
          Math.min(sourceWidth, (centerX + width / 2 - paddingX) / scale),
          Math.min(sourceHeight, (centerY + height / 2 - paddingY) / scale),
        ],
        conf: confidence,
      });
    }

    return detections;
  }

  parseSCRFDDetections(outputs, imageWidth, imageHeight) {
    const { INPUT_SIZE, CONFIDENCE_THRESHOLD, STRIDES } = FaceDetectionConfig.SCRFD;
    const faces = [];
    const outputValues = Object.values(outputs);

    const strideOutputs = {
      8: { scores: outputValues[0].data, boxes: outputValues[1].data, keypoints: outputValues[2].data },
      16: { scores: outputValues[3].data, boxes: outputValues[4].data, keypoints: outputValues[5].data },
      32: { scores: outputValues[6].data, boxes: outputValues[7].data, keypoints: outputValues[8].data },
    };

    for (const stride of STRIDES) {
      const { scores, boxes, keypoints } = strideOutputs[stride];
      const featureMapSize = INPUT_SIZE / stride;
      const anchorsPerCell = Math.max(1, Math.round(boxes.length / (featureMapSize * featureMapSize * 4)));
      const scoresPerAnchor = Math.max(1, Math.round(scores.length / (featureMapSize * featureMapSize * anchorsPerCell)));
      const totalAnchors = featureMapSize * featureMapSize * anchorsPerCell;

      for (let i = 0; i < totalAnchors; i++) {
        const scoreIndex = i * scoresPerAnchor + (scoresPerAnchor - 1);
        const confidence = MathUtils.sigmoid(scores[scoreIndex]);
        if (confidence < CONFIDENCE_THRESHOLD) continue;

        const gridIndex = Math.floor(i / anchorsPerCell);
        const gridX = gridIndex % featureMapSize;
        const gridY = Math.floor(gridIndex / featureMapSize);
        const anchorCenterX = (gridX + 0.5) * stride;
        const anchorCenterY = (gridY + 0.5) * stride;

        const boxOffset = i * 4;
        const left = boxes[boxOffset] * stride;
        const top = boxes[boxOffset + 1] * stride;
        const right = boxes[boxOffset + 2] * stride;
        const bottom = boxes[boxOffset + 3] * stride;

        const bbox = [
          ((anchorCenterX - left) * imageWidth) / INPUT_SIZE,
          ((anchorCenterY - top) * imageHeight) / INPUT_SIZE,
          ((anchorCenterX + right) * imageWidth) / INPUT_SIZE,
          ((anchorCenterY + bottom) * imageHeight) / INPUT_SIZE,
        ];

        const landmarks = [];
        for (let j = 0; j < 5; j++) {
          const keypointOffset = i * 10 + j * 2;
          landmarks.push({
            x: ((anchorCenterX + keypoints[keypointOffset] * stride) * imageWidth) / INPUT_SIZE,
            y: ((anchorCenterY + keypoints[keypointOffset + 1] * stride) * imageHeight) / INPUT_SIZE,
          });
        }

        faces.push({ bbox, landmarks, conf: confidence });
      }
    }

    return faces;
  }

  applyNonMaximumSuppression(faces) {
    const { NMS_THRESHOLD } = FaceDetectionConfig.SCRFD;
    const sortedFaces = [...faces].sort((a, b) => b.conf - a.conf);
    const keptFaces = [];

    for (const face of sortedFaces) {
      const overlapsWithKept = keptFaces.some(
        (kept) => MathUtils.calculateIntersectionOverUnion(face.bbox, kept.bbox) > NMS_THRESHOLD
      );
      if (!overlapsWithKept) keptFaces.push(face);
    }

    return keptFaces;
  }

  selectBestFace(faces) {
    if (!faces.length) return null;
    return faces.reduce((best, face) => {
      const bestArea = MathUtils.calculateBoundingBoxArea(best.bbox);
      const faceArea = MathUtils.calculateBoundingBoxArea(face.bbox);
      if (face.conf > best.conf || (Math.abs(face.conf - best.conf) < 1e-6 && faceArea > bestArea)) {
        return face;
      }
      return best;
    });
  }

  cropRegionFromVideo(videoElement, bbox, padding = 0) {
    const x1 = Math.max(0, bbox[0] - padding);
    const y1 = Math.max(0, bbox[1] - padding);
    const x2 = Math.min(videoElement.videoWidth, bbox[2] + padding);
    const y2 = Math.min(videoElement.videoHeight, bbox[3] + padding);
    const width = x2 - x1;
    const height = y2 - y1;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(videoElement, x1, y1, width, height, 0, 0, width, height);

    return { canvas, x1, y1, width, height };
  }

  async detectFacesWithYOLO(videoElement) {
    if (!this.yoloSession) throw new Error("YOLO session not initialized");
    const { tensor, metadata } = this.preprocessForYOLO(videoElement);
    const outputs = await this.yoloSession.run({ [this.yoloSession.inputNames[0]]: tensor });
    return this.parseYOLODetections(outputs, metadata);
  }

  async detectLandmarksWithSCRFD(cropCanvas) {
    if (!this.scrfdSession) throw new Error("SCRFD session not initialized");
    const tensor = this.preprocessForSCRFD(cropCanvas);
    const outputs = await this.scrfdSession.run({ [this.scrfdSession.inputNames[0]]: tensor });
    return this.parseSCRFDDetections(outputs, cropCanvas.width, cropCanvas.height);
  }

  dispose() {
    this.scrfdSession = null;
    this.yoloSession = null;
    this.isInitialized = false;
  }
}

/* ================= SINGLETON ================= */
let serviceInstance = null;

export function getFaceDetectionService() {
  if (!serviceInstance) serviceInstance = new FaceDetectionService();
  return serviceInstance;
}

export default FaceDetectionService;
