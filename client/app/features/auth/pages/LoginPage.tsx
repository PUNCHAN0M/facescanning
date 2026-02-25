import { Eye, EyeOff, ScanFace, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { AnimatedButton } from '@/components/ui/AnimatedButton';
import { GlassCard } from '@/components/ui/GlassCard';

import type { Route } from './+types/LoginPage';
import { loginUser } from '../auth.service';

export function meta(_args: Route.MetaArgs) {
  return [
    { title: 'เข้าสู่ระบบ - Face Scan' },
    { name: 'description', content: 'เข้าสู่ระบบระบบจดจำใบหน้า' },
  ];
}

export default function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await loginUser({ email, password });
      navigate('/');
    } catch (err: unknown) {
      const axiosError = err as {
        response?: { data?: { message?: string } };
      };
      const msg =
        axiosError?.response?.data?.message ?? 'เกิดข้อผิดพลาด กรุณาลองใหม่';
      setError(
        typeof msg === 'string' ? msg : 'ข้อมูลการเข้าสู่ระบบไม่ถูกต้อง',
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className='bg-linear-to-br relative min-h-screen overflow-hidden from-slate-900 via-purple-900 to-slate-900'>
      {/* Animated background mesh */}
      <div className='gradient-mesh absolute inset-0 opacity-30' />

      {/* Floating orbs */}
      <div className='animate-float absolute left-10 top-20 h-72 w-72 rounded-full bg-purple-500 opacity-20 mix-blend-multiply blur-xl filter' />
      <div
        className='animate-float absolute right-10 top-40 h-72 w-72 rounded-full bg-pink-500 opacity-20 mix-blend-multiply blur-xl filter'
        style={{ animationDelay: '2s' }}
      />
      <div
        className='animate-float absolute -bottom-8 left-20 h-72 w-72 rounded-full bg-blue-500 opacity-20 mix-blend-multiply blur-xl filter'
        style={{ animationDelay: '4s' }}
      />

      {/* Content */}
      <div className='relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-12'>
        {/* Header */}
        <div className='animate-slide-in-up mb-10 text-center'>
          <div className='glass-dark mb-5 inline-flex items-center gap-2 rounded-full px-4 py-2'>
            <Sparkles className='h-4 w-4 text-yellow-400' />
            <span className='text-sm text-white/90'>Face Scan System</span>
          </div>

          <div className='mb-2 flex items-center justify-center gap-3'>
            <ScanFace className='h-10 w-10 text-purple-300' />
            <h1 className='bg-linear-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-4xl font-black text-transparent md:text-5xl'>
              เข้าสู่ระบบ
            </h1>
          </div>
          <p className='text-white/60'>กรุณากรอกข้อมูลเพื่อเข้าใช้งาน</p>
        </div>

        {/* Form Card */}
        <div className='animate-slide-in-up w-full max-w-md'>
          <GlassCard className='w-full'>
            <form onSubmit={handleSubmit} className='flex flex-col gap-5'>
              {/* Error Banner */}
              {error && (
                <div className='rounded-xl border border-red-500/30 bg-red-500/20 px-4 py-3 text-sm text-red-200'>
                  {error}
                </div>
              )}

              {/* Email */}
              <div className='flex flex-col gap-1.5'>
                <label
                  htmlFor='email'
                  className='text-sm font-medium text-white/80'
                >
                  อีเมล
                </label>
                <input
                  id='email'
                  type='email'
                  autoComplete='email'
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder='example@email.com'
                  className='w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-white/30 outline-none transition-all focus:border-purple-400/60 focus:bg-white/15 focus:ring-2 focus:ring-purple-400/20'
                />
              </div>

              {/* Password */}
              <div className='flex flex-col gap-1.5'>
                <label
                  htmlFor='password'
                  className='text-sm font-medium text-white/80'
                >
                  รหัสผ่าน
                </label>
                <div className='relative'>
                  <input
                    id='password'
                    type={showPassword ? 'text' : 'password'}
                    autoComplete='current-password'
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder='••••••••'
                    className='w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 pr-12 text-white placeholder-white/30 outline-none transition-all focus:border-purple-400/60 focus:bg-white/15 focus:ring-2 focus:ring-purple-400/20'
                  />
                  <button
                    type='button'
                    onClick={() => setShowPassword((v) => !v)}
                    className='absolute right-3 top-1/2 -translate-y-1/2 text-white/40 transition-colors hover:text-white/80'
                    aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                  >
                    {showPassword ? (
                      <EyeOff className='h-5 w-5' />
                    ) : (
                      <Eye className='h-5 w-5' />
                    )}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <AnimatedButton
                type='submit'
                variant='primary'
                size='lg'
                className='mt-2 w-full'
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className='flex items-center justify-center gap-2'>
                    <svg
                      className='h-4 w-4 animate-spin'
                      viewBox='0 0 24 24'
                      fill='none'
                    >
                      <circle
                        className='opacity-25'
                        cx='12'
                        cy='12'
                        r='10'
                        stroke='currentColor'
                        strokeWidth='4'
                      />
                      <path
                        className='opacity-75'
                        fill='currentColor'
                        d='M4 12a8 8 0 018-8v8z'
                      />
                    </svg>
                    กำลังเข้าสู่ระบบ...
                  </span>
                ) : (
                  'เข้าสู่ระบบ'
                )}
              </AnimatedButton>
            </form>
          </GlassCard>
        </div>

        {/* Back to home */}
        <button
          onClick={() => navigate('/')}
          className='mt-6 text-sm text-white/40 underline-offset-4 transition-colors hover:text-white/70 hover:underline'
        >
          ← กลับหน้าหลัก
        </button>

        <footer className='mt-12 text-center text-xs text-white/30'>
          © {new Date().getFullYear()} Face Scan System. All rights reserved.
        </footer>
      </div>
    </main>
  );
}
