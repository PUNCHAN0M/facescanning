/**
 * FaceAlignmentService - Production-ready face alignment service
 * 
 * Provides ArcFace-style face alignment using Umeyama similarity transform.
 * Aligns detected faces to a canonical pose for optimal embedding extraction.
 * 
 * @author FaceScanning Team
 * @version 2.0.0
 */

import { FaceDetectionConfig, MathUtils } from "./FaceDetectionService";

/* ================= FACE ALIGNMENT SERVICE ================= */
export class FaceAlignmentService {
  constructor() {
    this.outputSize = FaceDetectionConfig.MBF.INPUT_SIZE;
    this.referencePoints = FaceDetectionConfig.ARCFACE_REF_112;
  }

  /**
   * Compute Umeyama similarity transform between source and destination points
   * This is the standard method used in InsightFace/ArcFace
   * 
   * @param {Array} src - Source landmark points [[x,y], ...]
   * @param {Array} dst - Destination reference points [[x,y], ...]
   * @returns {Object|null} Transform matrix components {a, b, c, d, tx, ty}
   */
  computeUmeyamaTransform(src, dst) {
    const n = src.length;
    if (n < 2) return null;

    // 1. Compute means
    let srcMeanX = 0, srcMeanY = 0, dstMeanX = 0, dstMeanY = 0;
    for (let i = 0; i < n; i++) {
      srcMeanX += src[i][0];
      srcMeanY += src[i][1];
      dstMeanX += dst[i][0];
      dstMeanY += dst[i][1];
    }
    srcMeanX /= n;
    srcMeanY /= n;
    dstMeanX /= n;
    dstMeanY /= n;

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
    let cov00 = 0, cov01 = 0, cov10 = 0, cov11 = 0;
    for (let i = 0; i < n; i++) {
      cov00 += dstCentered[i][0] * srcCentered[i][0];
      cov01 += dstCentered[i][0] * srcCentered[i][1];
      cov10 += dstCentered[i][1] * srcCentered[i][0];
      cov11 += dstCentered[i][1] * srcCentered[i][1];
    }
    cov00 /= n;
    cov01 /= n;
    cov10 /= n;
    cov11 /= n;

    // 4. SVD of 2x2 matrix
    const { U, S, V } = MathUtils.svd2x2(cov00, cov01, cov10, cov11);

    // 5. Compute rotation matrix R = U * V^T with reflection check
    const det = (U[0][0] * U[1][1] - U[0][1] * U[1][0]) * 
                (V[0][0] * V[1][1] - V[0][1] * V[1][0]);
    const d = det < 0 ? -1 : 1;
    const Vt = [[V[0][0], V[1][0]], [V[0][1] * d, V[1][1] * d]];
    
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

    return {
      a: scale * R[0][0],
      b: scale * R[1][0],
      c: scale * R[0][1],
      d: scale * R[1][1],
      tx,
      ty
    };
  }

  /**
   * Align face image using 5-point landmarks
   * 
   * @param {HTMLCanvasElement} sourceCanvas - Canvas containing face crop
   * @param {Object} faceData - Face detection data with landmarks
   * @param {HTMLCanvasElement} outputCanvas - Target canvas for aligned face
   * @returns {boolean} Success status
   */
  alignFace(sourceCanvas, faceData, outputCanvas) {
    if (!sourceCanvas || !faceData || !faceData.landmarks || faceData.landmarks.length < 5) {
      console.warn("[FaceAlignmentService] Invalid input for alignment");
      return false;
    }

    if (!outputCanvas) {
      console.warn("[FaceAlignmentService] Output canvas not provided");
      return false;
    }

    // Setup output canvas
    outputCanvas.width = this.outputSize;
    outputCanvas.height = this.outputSize;
    const ctx = outputCanvas.getContext("2d");
    
    // Fill with gray background (standard for ArcFace)
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, this.outputSize, this.outputSize);

    // Extract source points from landmarks
    // SCRFD order: [left_eye, right_eye, nose, mouth_left, mouth_right]
    const srcPts = faceData.landmarks.map(p => [p.x, p.y]);

    // Compute transform
    const transform = this.computeUmeyamaTransform(srcPts, this.referencePoints);
    if (!transform) {
      console.warn("[FaceAlignmentService] Failed to compute transform");
      return false;
    }

    // Apply transform
    ctx.save();
    ctx.setTransform(
      transform.a,
      transform.b,
      transform.c,
      transform.d,
      transform.tx,
      transform.ty
    );
    ctx.drawImage(sourceCanvas, 0, 0);
    ctx.restore();

    return true;
  }

  /**
   * Create aligned face canvas from source
   * 
   * @param {HTMLCanvasElement} sourceCanvas - Canvas containing face crop
   * @param {Object} faceData - Face detection data with landmarks
   * @returns {HTMLCanvasElement|null} New canvas with aligned face
   */
  createAlignedFace(sourceCanvas, faceData) {
    const outputCanvas = document.createElement("canvas");
    const success = this.alignFace(sourceCanvas, faceData, outputCanvas);
    return success ? outputCanvas : null;
  }

  /**
   * Draw cropped face with landmarks for visualization
   * 
   * @param {Object} cropData - Crop data {canvas, x1, y1, w, h}
   * @param {Object} faceData - Face detection data
   * @param {HTMLCanvasElement} outputCanvas - Target canvas
   */
  drawCroppedFace(cropData, faceData, outputCanvas) {
    if (!cropData || !faceData || !outputCanvas) return;

    const [x1, y1, x2, y2] = faceData.bbox;
    const bw = Math.max(1, Math.round(x2 - x1));
    const bh = Math.max(1, Math.round(y2 - y1));

    outputCanvas.width = bw;
    outputCanvas.height = bh;
    const ctx = outputCanvas.getContext("2d");
    
    ctx.clearRect(0, 0, bw, bh);
    ctx.drawImage(cropData.canvas, x1, y1, bw, bh, 0, 0, bw, bh);

    // Draw border
    ctx.strokeStyle = "lime";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, bw, bh);

    // Draw landmarks
    ctx.fillStyle = "red";
    faceData.landmarks.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x - x1, p.y - y1, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  /**
   * Get transform matrix for given landmarks
   * 
   * @param {Array} landmarks - Array of {x, y} landmark points
   * @returns {Object|null} Transform matrix
   */
  getTransformMatrix(landmarks) {
    if (!landmarks || landmarks.length < 5) return null;
    const srcPts = landmarks.map(p => [p.x, p.y]);
    return this.computeUmeyamaTransform(srcPts, this.referencePoints);
  }
}

/* ================= SINGLETON INSTANCE ================= */
let alignmentInstance = null;

export function getFaceAlignmentService() {
  if (!alignmentInstance) {
    alignmentInstance = new FaceAlignmentService();
  }
  return alignmentInstance;
}

export default FaceAlignmentService;
