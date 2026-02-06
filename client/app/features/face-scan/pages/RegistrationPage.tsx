import {
  ArrowLeft,
  Building2,
  Camera,
  Check,
  Upload,
  User,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { AnimatedButton } from '@/components/common/AnimatedButton';
import { GlassCard } from '@/components/common/GlassCard';

export default function RegistrationPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [organization, setOrganization] = useState('');
  const [memberName, setMemberName] = useState('');
  const [_capturedImages, _setCapturedImages] = useState<string[]>([]);

  const handleComplete = () => {
    // Simulate registration
    setTimeout(() => {
      alert('ลงทะเบียนสำเร็จ!');
      navigate('/');
    }, 500);
  };

  return (
    <div className='relative min-h-screen overflow-hidden bg-linear-to-br from-slate-900 via-purple-900 to-slate-900'>
      <div className='gradient-mesh absolute inset-0 opacity-20' />

      {/* Header */}
      <div className='absolute top-0 right-0 left-0 z-20 p-6'>
        <div className='mx-auto max-w-4xl'>
          <AnimatedButton
            variant='ghost'
            size='sm'
            onClick={() => navigate('/')}
            className='backdrop-blur-md'
          >
            <ArrowLeft className='mr-2 h-5 w-5' />
            กลับหน้าหลัก
          </AnimatedButton>
        </div>
      </div>

      {/* Content */}
      <div className='relative z-10 flex min-h-screen items-center justify-center p-6 pt-24'>
        <div className='w-full max-w-4xl'>
          <div className='animate-slide-in-up mb-8 text-center'>
            <h1 className='mb-4 text-5xl font-black text-white'>
              ลงทะเบียนสมาชิก
            </h1>
            <p className='text-lg text-white/70'>เพิ่มสมาชิกใหม่เข้าสู่ระบบ</p>
          </div>

          {/* Progress indicator */}
          <div className='mb-8 flex justify-center'>
            <div className='flex items-center gap-4'>
              {[1, 2, 3].map((s) => (
                <div key={s} className='flex items-center gap-2'>
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full font-bold transition-all ${
                      s === step
                        ? 'scale-110 bg-linear-to-br from-purple-500 to-pink-500 text-white'
                        : s < step
                          ? 'bg-green-500 text-white'
                          : 'bg-white/10 text-white/50'
                    }`}
                  >
                    {s < step ? <Check className='h-5 w-5' /> : s}
                  </div>
                  {s < 3 && (
                    <div
                      className={`h-1 w-12 rounded ${s < step ? 'bg-green-500' : 'bg-white/10'}`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <GlassCard className='animate-slide-in-up'>
            {/* Step 1: Organization */}
            {step === 1 && (
              <div className='space-y-6'>
                <div className='mb-6 flex items-center gap-3'>
                  <div className='flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-blue-500 to-cyan-500'>
                    <Building2 className='h-6 w-6 text-white' />
                  </div>
                  <div>
                    <h2 className='text-2xl font-bold text-white'>
                      เลือกองค์กร
                    </h2>
                    <p className='text-white/60'>เลือกหรือสร้างองค์กรใหม่</p>
                  </div>
                </div>

                <div>
                  <label className='mb-2 block font-medium text-white/80'>
                    ชื่อองค์กร
                  </label>
                  <input
                    type='text'
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    placeholder='กรอกชื่อองค์กร'
                    className='w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-white/40 transition-all focus:ring-2 focus:ring-purple-500 focus:outline-none'
                  />
                </div>

                <div className='flex justify-end'>
                  <AnimatedButton
                    variant='primary'
                    onClick={() => organization && setStep(2)}
                    disabled={!organization}
                  >
                    ถัดไป
                  </AnimatedButton>
                </div>
              </div>
            )}

            {/* Step 2: Member Info */}
            {step === 2 && (
              <div className='space-y-6'>
                <div className='mb-6 flex items-center gap-3'>
                  <div className='flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-purple-500 to-pink-500'>
                    <User className='h-6 w-6 text-white' />
                  </div>
                  <div>
                    <h2 className='text-2xl font-bold text-white'>
                      ข้อมูลสมาชิก
                    </h2>
                    <p className='text-white/60'>กรอกข้อมูลของสมาชิก</p>
                  </div>
                </div>

                <div>
                  <label className='mb-2 block font-medium text-white/80'>
                    ชื่อ-นามสกุล
                  </label>
                  <input
                    type='text'
                    value={memberName}
                    onChange={(e) => setMemberName(e.target.value)}
                    placeholder='กรอกชื่อ-นามสกุล'
                    className='w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-white/40 transition-all focus:ring-2 focus:ring-purple-500 focus:outline-none'
                  />
                </div>

                <div className='rounded-xl border border-blue-500/20 bg-blue-500/10 p-4'>
                  <p className='text-sm text-blue-300'>
                    <strong>องค์กร:</strong> {organization}
                  </p>
                </div>

                <div className='flex justify-between'>
                  <AnimatedButton variant='ghost' onClick={() => setStep(1)}>
                    ย้อนกลับ
                  </AnimatedButton>
                  <AnimatedButton
                    variant='primary'
                    onClick={() => memberName && setStep(3)}
                    disabled={!memberName}
                  >
                    ถัดไป
                  </AnimatedButton>
                </div>
              </div>
            )}

            {/* Step 3: Capture Photo */}
            {step === 3 && (
              <div className='space-y-6'>
                <div className='mb-6 flex items-center gap-3'>
                  <div className='flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-orange-500 to-red-500'>
                    <Camera className='h-6 w-6 text-white' />
                  </div>
                  <div>
                    <h2 className='text-2xl font-bold text-white'>
                      ถ่ายรูปใบหน้า
                    </h2>
                    <p className='text-white/60'>ถ่ายหรืออัปโหลดรูปภาพ</p>
                  </div>
                </div>

                <div className='grid grid-cols-2 gap-4'>
                  <button className='group rounded-xl border-2 border-dashed border-white/20 bg-white/5 p-8 transition-all hover:border-purple-500/50 hover:bg-white/10'>
                    <Camera className='mx-auto mb-3 h-12 w-12 text-white/50 transition-colors group-hover:text-purple-400' />
                    <p className='text-white/70 transition-colors group-hover:text-white'>
                      เปิดกล้อง
                    </p>
                  </button>

                  <button className='group rounded-xl border-2 border-dashed border-white/20 bg-white/5 p-8 transition-all hover:border-purple-500/50 hover:bg-white/10'>
                    <Upload className='mx-auto mb-3 h-12 w-12 text-white/50 transition-colors group-hover:text-purple-400' />
                    <p className='text-white/70 transition-colors group-hover:text-white'>
                      อัปโหลดรูป
                    </p>
                  </button>
                </div>

                {_capturedImages.length > 0 && (
                  <div className='rounded-xl border border-green-500/20 bg-green-500/10 p-4'>
                    <p className='text-sm text-green-300'>
                      ✓ ถ่ายรูปแล้ว {_capturedImages.length} รูป
                    </p>
                  </div>
                )}

                <div className='flex justify-between'>
                  <AnimatedButton variant='ghost' onClick={() => setStep(2)}>
                    ย้อนกลับ
                  </AnimatedButton>
                  <AnimatedButton variant='success' onClick={handleComplete}>
                    <Check className='mr-2 h-5 w-5' />
                    ลงทะเบียน
                  </AnimatedButton>
                </div>
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
