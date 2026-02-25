/**
 * EmbeddingService - Production-ready face embedding service
 * 
 * Supports switching between multiple ArcFace models at runtime:
 * - w600k_r50  (ResNet-50, 166MB, high accuracy)
 * - w600k_mbf  (MobileFaceNet, 13MB, fast)
 * - r100       (ResNet-100, 249MB, highest accuracy)
 * 
 * IMPORTANT: Client and server must use the same model for FAISS search
 * to produce matching embeddings. Switching model requires server rebuild.
 * 
 * @author FaceScanning Team
 * @version 3.0.0
 */

import * as ort from "onnxruntime-web";
import { FaceDetectionConfig, EMBEDDING_MODELS, DEFAULT_EMBEDDING_MODEL, MathUtils } from "./FaceDetectionService";

/* ================= EMBEDDING SERVICE ================= */
export class EmbeddingService {
  constructor() {
    this.session = null;
    this.inputSize = FaceDetectionConfig.ARCFACE_INPUT_SIZE;
    this.isInitialized = false;
    this.embeddingDims = null;
    this.currentModelKey = null;
  }

  /**
   * Get current model key
   * @returns {string|null}
   */
  getModelKey() {
    return this.currentModelKey;
  }

  /**
   * Initialize (or switch to) an embedding model
   * 
   * @param {Object} options - Initialization options
   * @param {string} [options.modelKey] - Key from EMBEDDING_MODELS
   * @param {string} [options.executionProvider] - ONNX execution provider
   * @returns {Promise<boolean>} Success status
   */
  async initialize(options = {}) {
    const {
      modelKey = DEFAULT_EMBEDDING_MODEL,
      executionProvider = "wasm",
    } = options;

    const modelDef = EMBEDDING_MODELS[modelKey];
    if (!modelDef) {
      throw new Error(`Unknown embedding model: "${modelKey}". Available: ${Object.keys(EMBEDDING_MODELS).join(", ")}`);
    }

    // If already loaded with same model, skip
    if (this.isInitialized && this.currentModelKey === modelKey) {
      console.log(`[EmbeddingService] Model "${modelKey}" already loaded, skipping`);
      return true;
    }

    // Dispose previous session
    if (this.session) {
      console.log(`[EmbeddingService] Disposing previous model "${this.currentModelKey}"...`);
      this.dispose();
    }

    try {
      console.log(`[EmbeddingService] Loading model "${modelDef.label}" (${modelDef.sizeMB} MB)...`);

      const sessionOptions = {
        executionProviders: [executionProvider],
      };

      // Large models use external data format to bypass protobuf size limit
      if (modelDef.externalData) {
        sessionOptions.externalData = [
          {
            path: modelDef.externalData.split("/").pop(),
            data: modelDef.externalData,
          },
        ];
        console.log("[EmbeddingService] Using external data format");
      }

      this.session = await ort.InferenceSession.create(modelDef.modelPath, sessionOptions);
      this.currentModelKey = modelKey;
      this.isInitialized = true;
      this.embeddingDims = null; // reset, will be set on first extraction

      console.log(`[EmbeddingService] Model "${modelDef.label}" loaded successfully`);
      return true;
    } catch (error) {
      console.error(`[EmbeddingService] Failed to load "${modelKey}":`, error);
      throw new Error(`Embedding model initialization failed (${modelKey}): ${error.message}`);
    }
  }

  /**
   * Check if service is ready
   */
  isReady() {
    return this.isInitialized && this.session !== null;
  }

  /**
   * Preprocess aligned face canvas for MBF model
   * Matches the preprocessing used in server-side arcfacecustom.py
   * 
   * @param {HTMLCanvasElement} alignedCanvas - Aligned face canvas (112x112)
   * @returns {ort.Tensor} Preprocessed tensor
   */
  preprocessCanvas(alignedCanvas) {
    const canvas = document.createElement("canvas");
    canvas.width = this.inputSize;
    canvas.height = this.inputSize;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(alignedCanvas, 0, 0, this.inputSize, this.inputSize);

    const imgData = ctx.getImageData(0, 0, this.inputSize, this.inputSize).data;
    const input = new Float32Array(1 * 3 * this.inputSize * this.inputSize);
    const hw = this.inputSize * this.inputSize;

    // Normalize: (x - 127.5) / 128 (matches server-side preprocessing)
    // RGB order (matches canvas/browser standard)
    for (let i = 0; i < hw; i++) {
      const r = imgData[i * 4];
      const g = imgData[i * 4 + 1];
      const b = imgData[i * 4 + 2];
      input[i] = (r - 127.5) / 128;
      input[hw + i] = (g - 127.5) / 128;
      input[2 * hw + i] = (b - 127.5) / 128;
    }

    return new ort.Tensor("float32", input, [1, 3, this.inputSize, this.inputSize]);
  }

  /**
   * Extract embedding from aligned face
   * 
   * @param {HTMLCanvasElement} alignedCanvas - Aligned face canvas
   * @returns {Promise<Float32Array|null>} L2-normalized embedding or null
   */
  async extractEmbedding(alignedCanvas) {
    if (!this.isReady()) {
      throw new Error("EmbeddingService not initialized");
    }

    if (!alignedCanvas) {
      console.warn("[EmbeddingService] No canvas provided");
      return null;
    }

    try {
      const inputTensor = this.preprocessCanvas(alignedCanvas);
      
      const outputs = await this.session.run({
        [this.session.inputNames[0]]: inputTensor
      });

      const output = outputs[this.session.outputNames[0]] ?? Object.values(outputs)[0];
      const embedding = output.data;

      // L2 normalize
      const normalizedEmbedding = MathUtils.l2Normalize(embedding);
      
      // Cache embedding dimensions
      if (this.embeddingDims === null) {
        this.embeddingDims = normalizedEmbedding.length;
      }

      return normalizedEmbedding;
    } catch (error) {
      console.error("[EmbeddingService] Embedding extraction failed:", error);
      return null;
    }
  }

  /**
   * Get embedding dimensions
   */
  getEmbeddingDims() {
    return this.embeddingDims;
  }

  /**
   * Compute cosine similarity between two embeddings
   * 
   * @param {Float32Array} emb1 - First embedding (assumed L2-normalized)
   * @param {Float32Array} emb2 - Second embedding (assumed L2-normalized)
   * @returns {number} Cosine similarity [-1, 1]
   */
  static cosineSimilarity(emb1, emb2) {
    if (!emb1 || !emb2 || emb1.length !== emb2.length) {
      return 0;
    }
    
    let dotProduct = 0;
    for (let i = 0; i < emb1.length; i++) {
      dotProduct += emb1[i] * emb2[i];
    }
    
    return dotProduct;
  }

  /**
   * Cleanup resources
   */
  dispose() {
    this.session = null;
    this.isInitialized = false;
    this.embeddingDims = null;
    this.currentModelKey = null;
  }
}

/* ================= SINGLETON INSTANCE ================= */
let embeddingInstance = null;

export function getEmbeddingService() {
  if (!embeddingInstance) {
    embeddingInstance = new EmbeddingService();
  }
  return embeddingInstance;
}

export default EmbeddingService;
