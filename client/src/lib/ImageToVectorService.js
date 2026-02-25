/**
 * ImageToVectorService
 *
 * Extracts a 512-d L2-normalised face embedding vector from a static image.
 * Pipeline: Image Source → Canvas → YOLO detection → Crop → SCRFD landmarks
 *           → Face alignment (Umeyama) → ArcFace embedding → Float32Array
 *
 * This service returns ONLY the vector.
 * To compare the vector against the database use APIService.searchByEmbedding().
 * To store a new member vector use APIService.uploadMemberImageWithVector().
 *
 * Supported input types for extractVector():
 *   File | Blob | HTMLImageElement | HTMLCanvasElement | string (URL)
 *
 * @version 1.0.0
 */

import * as ort from "onnxruntime-web";
import {
  FaceDetectionConfig,
  MathUtils,
  getFaceDetectionService,
} from "./FaceDetectionService";
import { getFaceAlignmentService } from "./FaceAlignmentService";
import { getEmbeddingService } from "./EmbeddingService";

/* ─────────────── helpers ─────────────── */

/**
 * Load an <img> element from a URL (waits for onload).
 * @param {string} url
 * @returns {Promise<HTMLImageElement>}
 */
function loadImageElement(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

/**
 * Normalise any supported image source to an HTMLCanvasElement.
 *
 * @param {File|Blob|HTMLImageElement|HTMLCanvasElement|string} src
 * @returns {Promise<HTMLCanvasElement>}
 */
async function toCanvas(src) {
  if (src instanceof HTMLCanvasElement) {
    return src;
  }

  let imgEl;
  let objectUrl = null;

  if (src instanceof File || src instanceof Blob) {
    objectUrl = URL.createObjectURL(src);
    imgEl = await loadImageElement(objectUrl);
  } else if (src instanceof HTMLImageElement) {
    imgEl = src;
  } else if (typeof src === "string") {
    imgEl = await loadImageElement(src);
  } else {
    throw new TypeError(
      "ImageToVectorService: unsupported image source type. " +
        "Expected File, Blob, HTMLImageElement, HTMLCanvasElement or URL string."
    );
  }

  const canvas = document.createElement("canvas");
  canvas.width = imgEl.naturalWidth || imgEl.width;
  canvas.height = imgEl.naturalHeight || imgEl.height;
  canvas.getContext("2d").drawImage(imgEl, 0, 0);

  if (objectUrl) URL.revokeObjectURL(objectUrl);
  return canvas;
}

/* ─────────────── service ─────────────── */

export class ImageToVectorService {
  constructor() {
    /** @type {import("./FaceDetectionService").FaceDetectionService|null} */
    this._detection = null;
    /** @type {import("./FaceAlignmentService").FaceAlignmentService|null} */
    this._alignment = null;
    /** @type {import("./EmbeddingService").EmbeddingService|null} */
    this._embedding = null;
    this._initialized = false;
  }

  /**
   * Initialize all required models.
   *
   * @param {object}   [options]
   * @param {string}   [options.modelKey]            - ArcFace model key (default: DEFAULT_EMBEDDING_MODEL)
   * @param {string}   [options.executionProvider]   - ONNX provider: "wasm" | "webgl" | "webgpu"
   * @param {function} [options.onProgress]          - Progress callback (message: string) => void
   * @returns {Promise<true>}
   */
  async initialize(options = {}) {
    const { modelKey, executionProvider = "wasm", onProgress } = options;

    // ── Detection models ──
    onProgress?.("Loading face detection models...");
    this._detection = getFaceDetectionService();
    if (!this._detection.isReady()) {
      await this._detection.initialize({ executionProvider, onProgress });
    }

    // ── Alignment (pure math, no model) ──
    this._alignment = getFaceAlignmentService();

    // ── Embedding model ──
    onProgress?.("Loading face embedding model...");
    this._embedding = getEmbeddingService();
    if (!this._embedding.isReady()) {
      await this._embedding.initialize({ modelKey, executionProvider });
    }

    this._initialized = true;
    onProgress?.("ImageToVectorService ready");
    return true;
  }

  /** Returns true when all models are loaded and ready. */
  isReady() {
    return (
      this._initialized &&
      this._detection?.isReady() === true &&
      this._embedding?.isReady() === true
    );
  }

  /**
   * Extract a 512-d face embedding from any static image source.
   *
   * Steps:
   *   1. Normalise input → HTMLCanvasElement
   *   2. YOLO detection  → face bounding boxes
   *   3. Select best face, crop region
   *   4. SCRFD inference → 5-point landmarks
   *   5. Umeyama alignment → 112×112 aligned canvas
   *   6. ArcFace inference → Float32Array(512), L2-normalised
   *
   * @param {File|Blob|HTMLImageElement|HTMLCanvasElement|string} imageSource
   * @returns {Promise<Float32Array|null>}  512-d embedding, or null if no face found
   */
  async extractVector(imageSource) {
    if (!this.isReady()) {
      throw new Error(
        "ImageToVectorService is not initialised. Call initialize() first."
      );
    }

    // Step 1 – normalise to canvas
    const sourceCanvas = await toCanvas(imageSource);

    // Step 2 – YOLO face detection on canvas
    const yoloDetections = await this._detectFacesOnCanvas(sourceCanvas);
    if (!yoloDetections.length) {
      console.warn("[ImageToVectorService] No face detected by YOLO");
      return null;
    }

    // Step 3 – pick best (highest-confidence / largest) face
    const bestYolo = this._detection.selectBestFace(yoloDetections);
    if (!bestYolo) return null;

    // Step 4 – crop face region
    const cropCanvas = this._cropCanvas(sourceCanvas, bestYolo.bbox);

    // Step 5 – SCRFD landmark detection on the cropped region
    const scrfdFaces = await this._detection.detectLandmarksWithSCRFD(cropCanvas);
    if (!scrfdFaces.length) {
      console.warn("[ImageToVectorService] No landmarks detected by SCRFD after crop");
      return null;
    }
    const bestScrfd = this._detection.selectBestFace(scrfdFaces);
    if (!bestScrfd) return null;

    // Step 6 – align face (Umeyama / ArcFace canonical pose)
    const alignedCanvas = this._alignment.createAlignedFaceCanvas(cropCanvas, bestScrfd);
    if (!alignedCanvas) {
      console.warn("[ImageToVectorService] Face alignment failed");
      return null;
    }

    // Step 7 – ArcFace embedding
    return await this._embedding.extractEmbedding(alignedCanvas);
  }

  /* ───── private helpers ───── */

  /**
   * YOLO detection adapted to work with a plain HTMLCanvasElement
   * (the built-in preprocessForYOLO uses videoElement.videoWidth / videoHeight).
   *
   * @param {HTMLCanvasElement} canvas
   * @returns {Promise<Array<{bbox: number[], conf: number}>>}
   */
  async _detectFacesOnCanvas(canvas) {
    const { INPUT_SIZE, CONFIDENCE_THRESHOLD } = FaceDetectionConfig.YOLO;
    const sourceWidth = canvas.width;
    const sourceHeight = canvas.height;

    const scale = Math.min(INPUT_SIZE / sourceWidth, INPUT_SIZE / sourceHeight);
    const newWidth = Math.round(sourceWidth * scale);
    const newHeight = Math.round(sourceHeight * scale);
    const paddingX = Math.floor((INPUT_SIZE - newWidth) / 2);
    const paddingY = Math.floor((INPUT_SIZE - newHeight) / 2);

    // Draw scaled + padded image to offscreen canvas
    const offscreen = document.createElement("canvas");
    offscreen.width = INPUT_SIZE;
    offscreen.height = INPUT_SIZE;
    const ctx = offscreen.getContext("2d");
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
    ctx.drawImage(
      canvas,
      0, 0, sourceWidth, sourceHeight,
      paddingX, paddingY, newWidth, newHeight
    );

    // Build CHW float32 tensor  [0, 1]
    const imageData = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE).data;
    const inputArray = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE);
    const pixelCount = INPUT_SIZE * INPUT_SIZE;
    for (let i = 0; i < pixelCount; i++) {
      inputArray[i]               = imageData[i * 4]     / 255;
      inputArray[pixelCount + i]  = imageData[i * 4 + 1] / 255;
      inputArray[2 * pixelCount + i] = imageData[i * 4 + 2] / 255;
    }

    const tensor = new ort.Tensor("float32", inputArray, [1, 3, INPUT_SIZE, INPUT_SIZE]);
    const session = this._detection.yoloSession;
    const outputs = await session.run({ [session.inputNames[0]]: tensor });

    // Parse raw output → detections in original-image coordinates
    const outputData = Object.values(outputs)[0].data;
    const rowCount = outputData.length / 6;
    const detections = [];

    for (let i = 0; i < rowCount; i++) {
      const offset = i * 6;
      const confidence = outputData[offset + 4];
      if (confidence < CONFIDENCE_THRESHOLD) continue;

      const cx = outputData[offset];
      const cy = outputData[offset + 1];
      const w  = outputData[offset + 2];
      const h  = outputData[offset + 3];

      detections.push({
        bbox: [
          Math.max(0, (cx - w / 2 - paddingX) / scale),
          Math.max(0, (cy - h / 2 - paddingY) / scale),
          Math.min(sourceWidth,  (cx + w / 2 - paddingX) / scale),
          Math.min(sourceHeight, (cy + h / 2 - paddingY) / scale),
        ],
        conf: confidence,
      });
    }

    return this._detection.applyNonMaximumSuppression(detections);
  }

  /**
   * Crop a rectangular region from a canvas.
   *
   * @param {HTMLCanvasElement} src
   * @param {number[]} bbox  - [x1, y1, x2, y2] in src coordinates
   * @param {number}   [padding=0]
   * @returns {HTMLCanvasElement}
   */
  _cropCanvas(src, bbox, padding = 0) {
    const x1 = Math.max(0, Math.floor(bbox[0]) - padding);
    const y1 = Math.max(0, Math.floor(bbox[1]) - padding);
    const x2 = Math.min(src.width,  Math.ceil(bbox[2]) + padding);
    const y2 = Math.min(src.height, Math.ceil(bbox[3]) + padding);
    const w  = Math.max(1, x2 - x1);
    const h  = Math.max(1, y2 - y1);

    const crop = document.createElement("canvas");
    crop.width  = w;
    crop.height = h;
    crop.getContext("2d").drawImage(src, x1, y1, w, h, 0, 0, w, h);
    return crop;
  }

  /** Release singleton reference (forces re-init on next use). */
  dispose() {
    this._initialized = false;
    _instance = null;
  }
}

/* ─────────────── singleton ─────────────── */

let _instance = null;

/**
 * Get (or lazily create) the shared ImageToVectorService instance.
 * @returns {ImageToVectorService}
 */
export function getImageToVectorService() {
  if (!_instance) _instance = new ImageToVectorService();
  return _instance;
}

export default ImageToVectorService;
