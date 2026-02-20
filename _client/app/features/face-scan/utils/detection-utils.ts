/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FaceDetection } from '../types/face-detection';

const INPUT_SIZE = 640;
const CONF_THRESH = 0.6;
const NMS_THRESH = 0.4;
const STRIDES = [8, 16, 32];

/**
 * Sigmoid activation function
 */
export const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));

/**
 * Calculate Intersection over Union (IoU) between two bounding boxes
 */
export function iou(a: number[], b: number[]): number {
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

/**
 * Non-Maximum Suppression (NMS)
 */
export function nms(
  faces: FaceDetection[],
  threshold = NMS_THRESH,
): FaceDetection[] {
  const sorted = [...faces].sort((a, b) => b.conf - a.conf);
  const kept: FaceDetection[] = [];

  for (const f of sorted) {
    let ok = true;
    const fBbox = Array.isArray(f.bbox)
      ? f.bbox
      : [f.bbox.x1, f.bbox.y1, f.bbox.x2, f.bbox.y2];

    for (const k of kept) {
      const kBbox = Array.isArray(k.bbox)
        ? k.bbox
        : [k.bbox.x1, k.bbox.y1, k.bbox.x2, k.bbox.y2];
      if (iou(fBbox, kBbox) > threshold) {
        ok = false;
        break;
      }
    }
    if (ok) kept.push(f);
  }
  return kept;
}

/**
 * Calculate bounding box area
 */
export function boxArea(b: number[]): number {
  return Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]);
}

/**
 * Pick the best face from detections
 */
export function pickBestFace(faces: FaceDetection[]): FaceDetection | null {
  if (!faces.length) return null;

  let best = faces[0];
  for (const f of faces.slice(1)) {
    const fBbox = Array.isArray(f.bbox)
      ? f.bbox
      : [f.bbox.x1, f.bbox.y1, f.bbox.x2, f.bbox.y2];
    const bestBbox = Array.isArray(best.bbox)
      ? best.bbox
      : [best.bbox.x1, best.bbox.y1, best.bbox.x2, best.bbox.y2];

    if (
      f.conf > best.conf ||
      (Math.abs(f.conf - best.conf) < 1e-6 &&
        boxArea(fBbox) > boxArea(bestBbox))
    ) {
      best = f;
    }
  }
  return best;
}

/**
 * Parse SCRFD model output
 */
export function parseSCRFD(
  outputs: any,
  imgW: number,
  imgH: number,
): FaceDetection[] {
  const faces: FaceDetection[] = [];
  const o = Object.values(outputs) as any[];
  const maps: Record<number, any> = {
    8: { s: o[0].data, b: o[1].data, k: o[2].data },
    16: { s: o[3].data, b: o[4].data, k: o[5].data },
    32: { s: o[6].data, b: o[7].data, k: o[8].data },
  };

  STRIDES.forEach((stride) => {
    const { s, b, k } = maps[stride];
    const fm = INPUT_SIZE / stride;
    const anchors = Math.max(1, Math.round(b.length / (fm * fm * 4)));
    const sPerAnchor = Math.max(1, Math.round(s.length / (fm * fm * anchors)));

    const total = fm * fm * anchors;
    for (let i = 0; i < total; i++) {
      const sIdx = i * sPerAnchor + (sPerAnchor - 1);
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
        ((cx - l) * imgW) / INPUT_SIZE,
        ((cy - t) * imgH) / INPUT_SIZE,
        ((cx + r) * imgW) / INPUT_SIZE,
        ((cy + bb) * imgH) / INPUT_SIZE,
      ];

      const landmarks = [];
      for (let j = 0; j < 5; j++) {
        const base10 = i * 10 + j * 2;
        landmarks.push({
          x: ((cx + k[base10] * stride) * imgW) / INPUT_SIZE,
          y: ((cy + k[base10 + 1] * stride) * imgH) / INPUT_SIZE,
        });
      }

      faces.push({ bbox, landmarks, conf });
    }
  });

  return faces;
}

/**
 * Parse YOLO model output
 */
export function parseYOLO(outputs: any, lb: any): FaceDetection[] {
  const out = Object.values(outputs)[0] as any;
  const data = out.data;
  const rows = data.length / 6;
  const boxes: FaceDetection[] = [];

  for (let i = 0; i < rows; i++) {
    const off = i * 6;
    const conf = data[off + 4];
    if (conf < 0.5) continue;

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
        Math.min(lb.srcH, y2),
      ],
      conf,
    });
  }
  return boxes;
}

/**
 * Crop image with padding
 */
export function cropWithPad(
  video: HTMLVideoElement,
  bbox: number[],
  pad: number,
): { canvas: HTMLCanvasElement; x1: number; y1: number; w: number; h: number } {
  const x1 = Math.max(0, bbox[0] - pad);
  const y1 = Math.max(0, bbox[1] - pad);
  const x2 = Math.min(video.videoWidth, bbox[2] + pad);
  const y2 = Math.min(video.videoHeight, bbox[3] + pad);
  const w = x2 - x1;
  const h = y2 - y1;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(video, x1, y1, w, h, 0, 0, w, h);
  return { canvas, x1, y1, w, h };
}
