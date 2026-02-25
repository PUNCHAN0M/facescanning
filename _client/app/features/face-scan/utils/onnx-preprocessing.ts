import * as ort from 'onnxruntime-web';

const INPUT_SIZE = 640;
const YOLO_INPUT = 640;

/**
 * Preprocess image for SCRFD model
 */
export function preprocessSCRFD(
  imgSrc: HTMLCanvasElement | HTMLVideoElement,
): ort.Tensor {
  const canvas = document.createElement('canvas');
  canvas.width = INPUT_SIZE;
  canvas.height = INPUT_SIZE;
  const ctx = canvas.getContext('2d')!;
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

  return new ort.Tensor('float32', input, [1, 3, INPUT_SIZE, INPUT_SIZE]);
}

/**
 * Preprocess video for YOLO model
 */
export function preprocessYOLO(video: HTMLVideoElement) {
  const srcW = video.videoWidth;
  const srcH = video.videoHeight;
  const r = Math.min(YOLO_INPUT / srcW, YOLO_INPUT / srcH);
  const newW = Math.round(srcW * r);
  const newH = Math.round(srcH * r);
  const padX = Math.floor((YOLO_INPUT - newW) / 2);
  const padY = Math.floor((YOLO_INPUT - newH) / 2);

  const canvas = document.createElement('canvas');
  canvas.width = YOLO_INPUT;
  canvas.height = YOLO_INPUT;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'black';
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
    tensor: new ort.Tensor('float32', input, [1, 3, YOLO_INPUT, YOLO_INPUT]),
    scale: r,
    padX,
    padY,
    srcW,
    srcH,
  };
}

/**
 * Preprocess image for YOLOv12 face detection (simple version)
 */
export function preprocessImage(video: HTMLVideoElement): ort.Tensor {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  canvas.width = 640;
  canvas.height = 640;

  ctx.drawImage(video, 0, 0, 640, 640);
  const { data } = ctx.getImageData(0, 0, 640, 640);

  const r: number[] = [];
  const g: number[] = [];
  const b: number[] = [];

  for (let i = 0; i < data.length; i += 4) {
    r.push(data[i] / 255);
    g.push(data[i + 1] / 255);
    b.push(data[i + 2] / 255);
  }

  return new ort.Tensor('float32', [...r, ...g, ...b], [1, 3, 640, 640]);
}
