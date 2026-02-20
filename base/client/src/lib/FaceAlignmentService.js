/**
 * FaceAlignmentService
 *
 * ArcFace-style face alignment using Umeyama similarity transform.
 * Aligns detected faces to a canonical pose for embedding extraction.
 */

import { FaceDetectionConfig, MathUtils } from "./FaceDetectionService";

export class FaceAlignmentService {
  constructor() {
    this.outputSize = FaceDetectionConfig.MBF.INPUT_SIZE;
    this.referencePoints = FaceDetectionConfig.ARCFACE_REFERENCE_LANDMARKS_112;
  }

  computeUmeyamaTransform(sourcePoints, destinationPoints) {
    const pointCount = sourcePoints.length;
    if (pointCount < 2) return null;

    let sourceMeanX = 0, sourceMeanY = 0, destinationMeanX = 0, destinationMeanY = 0;
    for (let i = 0; i < pointCount; i++) {
      sourceMeanX += sourcePoints[i][0];
      sourceMeanY += sourcePoints[i][1];
      destinationMeanX += destinationPoints[i][0];
      destinationMeanY += destinationPoints[i][1];
    }
    sourceMeanX /= pointCount;
    sourceMeanY /= pointCount;
    destinationMeanX /= pointCount;
    destinationMeanY /= pointCount;

    const sourceCentered = [];
    const destinationCentered = [];
    let sourceVariance = 0;

    for (let i = 0; i < pointCount; i++) {
      const sx = sourcePoints[i][0] - sourceMeanX;
      const sy = sourcePoints[i][1] - sourceMeanY;
      const dx = destinationPoints[i][0] - destinationMeanX;
      const dy = destinationPoints[i][1] - destinationMeanY;
      sourceCentered.push([sx, sy]);
      destinationCentered.push([dx, dy]);
      sourceVariance += sx * sx + sy * sy;
    }
    sourceVariance /= pointCount;
    if (sourceVariance < 1e-10) return null;

    let cov00 = 0, cov01 = 0, cov10 = 0, cov11 = 0;
    for (let i = 0; i < pointCount; i++) {
      cov00 += destinationCentered[i][0] * sourceCentered[i][0];
      cov01 += destinationCentered[i][0] * sourceCentered[i][1];
      cov10 += destinationCentered[i][1] * sourceCentered[i][0];
      cov11 += destinationCentered[i][1] * sourceCentered[i][1];
    }
    cov00 /= pointCount;
    cov01 /= pointCount;
    cov10 /= pointCount;
    cov11 /= pointCount;

    const { U, S, V } = MathUtils.computeSVD2x2(cov00, cov01, cov10, cov11);

    const determinant =
      (U[0][0] * U[1][1] - U[0][1] * U[1][0]) *
      (V[0][0] * V[1][1] - V[0][1] * V[1][0]);
    const reflectionSign = determinant < 0 ? -1 : 1;
    const Vt = [
      [V[0][0], V[1][0]],
      [V[0][1] * reflectionSign, V[1][1] * reflectionSign],
    ];

    const rotation = [
      [U[0][0] * Vt[0][0] + U[0][1] * Vt[1][0], U[0][0] * Vt[0][1] + U[0][1] * Vt[1][1]],
      [U[1][0] * Vt[0][0] + U[1][1] * Vt[1][0], U[1][0] * Vt[0][1] + U[1][1] * Vt[1][1]],
    ];

    const traceS = S[0] + (determinant < 0 ? -S[1] : S[1]);
    const scale = traceS / sourceVariance;

    const translateX = destinationMeanX - scale * (rotation[0][0] * sourceMeanX + rotation[0][1] * sourceMeanY);
    const translateY = destinationMeanY - scale * (rotation[1][0] * sourceMeanX + rotation[1][1] * sourceMeanY);

    return {
      a: scale * rotation[0][0],
      b: scale * rotation[1][0],
      c: scale * rotation[0][1],
      d: scale * rotation[1][1],
      tx: translateX,
      ty: translateY,
    };
  }

  alignFaceToCanvas(sourceCanvas, faceData, outputCanvas) {
    if (!sourceCanvas || !faceData?.landmarks || faceData.landmarks.length < 5 || !outputCanvas) {
      return false;
    }

    outputCanvas.width = this.outputSize;
    outputCanvas.height = this.outputSize;
    const context = outputCanvas.getContext("2d");

    context.fillStyle = "#808080";
    context.fillRect(0, 0, this.outputSize, this.outputSize);

    const sourcePoints = faceData.landmarks.map((point) => [point.x, point.y]);
    const transform = this.computeUmeyamaTransform(sourcePoints, this.referencePoints);
    if (!transform) return false;

    context.save();
    context.setTransform(transform.a, transform.b, transform.c, transform.d, transform.tx, transform.ty);
    context.drawImage(sourceCanvas, 0, 0);
    context.restore();

    return true;
  }

  createAlignedFaceCanvas(sourceCanvas, faceData) {
    const outputCanvas = document.createElement("canvas");
    return this.alignFaceToCanvas(sourceCanvas, faceData, outputCanvas) ? outputCanvas : null;
  }

  drawCroppedFaceWithLandmarks(cropData, faceData, outputCanvas) {
    if (!cropData || !faceData || !outputCanvas) return;

    const [x1, y1, x2, y2] = faceData.bbox;
    const boxWidth = Math.max(1, Math.round(x2 - x1));
    const boxHeight = Math.max(1, Math.round(y2 - y1));

    outputCanvas.width = boxWidth;
    outputCanvas.height = boxHeight;
    const context = outputCanvas.getContext("2d");

    context.clearRect(0, 0, boxWidth, boxHeight);
    context.drawImage(cropData.canvas, x1, y1, boxWidth, boxHeight, 0, 0, boxWidth, boxHeight);

    context.strokeStyle = "lime";
    context.lineWidth = 2;
    context.strokeRect(0, 0, boxWidth, boxHeight);

    context.fillStyle = "red";
    faceData.landmarks.forEach((point) => {
      context.beginPath();
      context.arc(point.x - x1, point.y - y1, 3, 0, Math.PI * 2);
      context.fill();
    });
  }
}

/* ================= SINGLETON ================= */
let alignmentInstance = null;

export function getFaceAlignmentService() {
  if (!alignmentInstance) alignmentInstance = new FaceAlignmentService();
  return alignmentInstance;
}

export default FaceAlignmentService;
