import { ArrowLeft, Building2, Camera, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { AnimatedButton } from '@/components/common/AnimatedButton';
import { GlassCard } from '@/components/common/GlassCard';

import { useOnnxModel } from '../hooks/useOnnxModel';
import {
  boxArea,
  cropWithPad,
  nms,
  parseSCRFD,
  parseYOLO,
  pickBestFace,
} from '../utils/detection-utils';
import { preprocessSCRFD, preprocessYOLO } from '../utils/onnx-preprocessing';

const PADDING_PX = 40;

export default function FaceScanPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { session: scrfdSession } = useOnnxModel('/scrfd_2.5g.onnx');
  const { session: yoloSession } = useOnnxModel('/yolov12n-face.onnx');

  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef(performance.now());

  const [running, setRunning] = useState(false);
  const [fps, setFps] = useState(0);
  const [detectedPerson, setDetectedPerson] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number>(0);
  const [showResult, setShowResult] = useState(false);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setRunning(true);
      detectLoop();
    } catch {
      alert('ไม่สามารถเปิดกล้องได้');
    }
  };

  const stopCamera = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
    }
    setRunning(false);
    setShowResult(false);
  };

  async function detectLoop() {
    if (!scrfdSession || !yoloSession || !videoRef.current) return;

    const v = videoRef.current;
    const c = canvasRef.current;
    if (!c) return;

    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext('2d')!;

    const yprep = preprocessYOLO(v);
    let dets = parseYOLO(
      await yoloSession.run({ [yoloSession.inputNames[0]]: yprep.tensor }),
      yprep,
    );

    dets = nms(dets)
      .sort((a, b) => {
        const aBbox = Array.isArray(a.bbox)
          ? a.bbox
          : [a.bbox.x1, a.bbox.y1, a.bbox.x2, a.bbox.y2];
        const bBbox = Array.isArray(b.bbox)
          ? b.bbox
          : [b.bbox.x1, b.bbox.y1, b.bbox.x2, b.bbox.y2];
        return b.conf * boxArea(bBbox) - a.conf * boxArea(aBbox);
      })
      .slice(0, 1);

    ctx.clearRect(0, 0, c.width, c.height);

    if (dets.length > 0) {
      const d = dets[0];
      const dBbox = Array.isArray(d.bbox)
        ? d.bbox
        : [d.bbox.x1, d.bbox.y1, d.bbox.x2, d.bbox.y2];
      const crop = cropWithPad(v, dBbox, PADDING_PX);
      const faces = parseSCRFD(
        await scrfdSession.run({
          [scrfdSession.inputNames[0]]: preprocessSCRFD(crop.canvas),
        }),
        crop.w,
        crop.h,
      );

      const best = pickBestFace(nms(faces));
      if (best) {
        const bestBbox = Array.isArray(best.bbox)
          ? best.bbox
          : [best.bbox.x1, best.bbox.y1, best.bbox.x2, best.bbox.y2];
        const gb = [
          crop.x1 + bestBbox[0],
          crop.y1 + bestBbox[1],
          crop.x1 + bestBbox[2],
          crop.y1 + bestBbox[3],
        ];

        // Draw glowing box
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#00ff88';
        ctx.shadowBlur = 20;
        ctx.strokeRect(gb[0], gb[1], gb[2] - gb[0], gb[3] - gb[1]);
        ctx.shadowBlur = 0;

        // Draw landmarks
        ctx.fillStyle = '#00ff88';
        best.landmarks?.forEach((p) => {
          ctx.beginPath();
          ctx.arc(crop.x1 + p.x, crop.y1 + p.y, 4, 0, Math.PI * 2);
          ctx.fill();
        });

        // Simulate detection (replace with actual API call)
        setDetectedPerson('สมชาย ใจดี');
        setConfidence(95);
        setShowResult(true);
      } else {
        setShowResult(false);
      }
    } else {
      setShowResult(false);
    }

    const now = performance.now();
    setFps(Math.round(1000 / (now - lastTimeRef.current)));
    lastTimeRef.current = now;

    rafRef.current = requestAnimationFrame(detectLoop);
  }

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return (
    <div className='relative min-h-screen overflow-hidden bg-linear-to-br from-slate-900 via-purple-900 to-slate-900'>
      {/* Background effects */}
      <div className='gradient-mesh absolute inset-0 opacity-20' />

      {/* Header */}
      <div className='absolute top-0 right-0 left-0 z-20 p-6'>
        <div className='mx-auto flex max-w-7xl items-center justify-between'>
          <AnimatedButton
            variant='ghost'
            size='sm'
            onClick={() => navigate('/')}
            className='backdrop-blur-md'
          >
            <ArrowLeft className='mr-2 h-5 w-5' />
            กลับหน้าหลัก
          </AnimatedButton>

          <div className='glass-dark rounded-full px-4 py-2'>
            <span className='text-sm font-medium text-white/90'>
              FPS: {fps}
            </span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className='relative z-10 flex min-h-screen items-center justify-center p-6'>
        <div className='w-full max-w-7xl'>
          <div className='grid grid-cols-1 gap-6 lg:grid-cols-3'>
            {/* Camera view */}
            <div className='lg:col-span-2'>
              <GlassCard className='relative overflow-hidden'>
                <div className='relative aspect-video overflow-hidden rounded-xl bg-black'>
                  <video
                    ref={videoRef}
                    muted
                    playsInline
                    className='absolute inset-0 h-full w-full object-cover'
                  />
                  <canvas
                    ref={canvasRef}
                    className='absolute inset-0 h-full w-full'
                  />

                  {/* Scan overlay */}
                  {running && (
                    <div className='pointer-events-none absolute inset-0'>
                      <div className='absolute top-0 right-0 left-0 h-1 animate-pulse bg-linear-to-r from-transparent via-cyan-400 to-transparent' />
                      <div className='absolute right-0 bottom-0 left-0 h-1 animate-pulse bg-linear-to-r from-transparent via-cyan-400 to-transparent' />
                    </div>
                  )}

                  {/* Status indicator */}
                  {!running && (
                    <div className='absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm'>
                      <div className='text-center'>
                        <Camera className='mx-auto mb-4 h-16 w-16 text-white/50' />
                        <p className='text-lg text-white/70'>กล้องยังไม่เปิด</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Controls */}
                <div className='mt-4 flex justify-center'>
                  {!running ? (
                    <AnimatedButton
                      variant='success'
                      size='lg'
                      onClick={startCamera}
                      className='w-full max-w-xs'
                    >
                      <Camera className='mr-2 h-5 w-5' />
                      เริ่มสแกน
                    </AnimatedButton>
                  ) : (
                    <AnimatedButton
                      variant='danger'
                      size='lg'
                      onClick={stopCamera}
                      className='w-full max-w-xs'
                    >
                      หยุดสแกน
                    </AnimatedButton>
                  )}
                </div>
              </GlassCard>
            </div>

            {/* Detection result */}
            <div className='lg:col-span-1'>
              <GlassCard className='h-full'>
                <h3 className='mb-6 flex items-center gap-2 text-2xl font-bold text-white'>
                  <User className='h-6 w-6' />
                  ผลการตรวจจับ
                </h3>

                {showResult && detectedPerson ? (
                  <div className='animate-slide-in-right space-y-6'>
                    {/* Person info */}
                    <div className='rounded-xl border border-green-500/30 bg-linear-to-br from-green-500/20 to-emerald-500/20 p-6'>
                      <div className='mb-4 flex items-center gap-4'>
                        <div className='flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-green-400 to-emerald-500'>
                          <User className='h-8 w-8 text-white' />
                        </div>
                        <div>
                          <p className='text-sm text-white/60'>ตรวจพบ</p>
                          <p className='text-2xl font-bold text-white'>
                            {detectedPerson}
                          </p>
                        </div>
                      </div>

                      {/* Confidence meter */}
                      <div className='space-y-2'>
                        <div className='flex justify-between text-sm'>
                          <span className='text-white/70'>ความมั่นใจ</span>
                          <span className='font-semibold text-white'>
                            {confidence}%
                          </span>
                        </div>
                        <div className='h-3 overflow-hidden rounded-full bg-white/10'>
                          <div
                            className='h-full rounded-full bg-linear-to-r from-green-400 to-emerald-500 transition-all duration-500'
                            style={{ width: `${confidence}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Organization */}
                    <div className='rounded-xl border border-white/10 bg-white/5 p-4'>
                      <div className='flex items-center gap-3'>
                        <Building2 className='h-5 w-5 text-purple-400' />
                        <div>
                          <p className='text-xs text-white/50'>องค์กร</p>
                          <p className='font-medium text-white'>
                            บริษัท ABC จำกัด
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Success indicator */}
                    <div className='text-center'>
                      <div className='inline-flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/20 px-4 py-2'>
                        <div className='h-2 w-2 animate-pulse rounded-full bg-green-400' />
                        <span className='text-sm font-medium text-green-400'>
                          ตรวจจับสำเร็จ
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className='flex h-64 flex-col items-center justify-center text-center'>
                    <div className='mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white/5'>
                      <User className='h-10 w-10 text-white/30' />
                    </div>
                    <p className='text-lg text-white/50'>
                      {running
                        ? 'กำลังรอการตรวจจับ...'
                        : 'เริ่มสแกนเพื่อตรวจจับใบหน้า'}
                    </p>
                  </div>
                )}
              </GlassCard>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
