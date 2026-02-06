import { Camera, LayoutDashboard, ScanFace, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router';

import { AnimatedButton } from '@/components/common/AnimatedButton';
import { GlassCard } from '@/components/common/GlassCard';

import { exampleRoutePaths } from '@/constants';

import type { Route } from './+types/IndexPage';

export function meta(_args: Route.MetaArgs) {
  return [
    { title: 'Face Scan - ระบบจดจำใบหน้าอัจฉริยะ' },
    { name: 'description', content: 'ระบบจดจำใบหน้าด้วย AI สำหรับงานอีเวนต์' },
  ];
}

export default function IndexPage() {
  const navigate = useNavigate();

  const features = [
    {
      icon: ScanFace,
      title: 'สแกนใบหน้า',
      description: 'ตรวจจับและจดจำใบหน้าแบบเรียลไทม์ด้วยเทคโนโลยี AI',
      action: () => navigate('/' + exampleRoutePaths.faceScan),
      color: 'from-blue-500 to-cyan-500',
    },
    {
      icon: Camera,
      title: 'ลงทะเบียน',
      description: 'เพิ่มสมาชิกใหม่และจัดการองค์กรได้อย่างง่ายดาย',
      action: () => navigate('/' + exampleRoutePaths.register),
      color: 'from-purple-500 to-pink-500',
    },
    {
      icon: LayoutDashboard,
      title: 'แดชบอร์ด',
      description: 'ดูสถิติและประวัติการสแกนทั้งหมด',
      action: () => navigate('/' + exampleRoutePaths.dashboard),
      color: 'from-orange-500 to-red-500',
    },
  ];

  return (
    <main className='relative min-h-screen overflow-hidden bg-linear-to-br from-slate-900 via-purple-900 to-slate-900'>
      {/* Animated background mesh */}
      <div className='gradient-mesh absolute inset-0 opacity-30' />

      {/* Floating orbs */}
      <div className='animate-float absolute top-20 left-10 h-72 w-72 rounded-full bg-purple-500 opacity-20 mix-blend-multiply blur-xl filter' />
      <div
        className='animate-float absolute top-40 right-10 h-72 w-72 rounded-full bg-pink-500 opacity-20 mix-blend-multiply blur-xl filter'
        style={{ animationDelay: '2s' }}
      />
      <div
        className='animate-float absolute -bottom-8 left-20 h-72 w-72 rounded-full bg-blue-500 opacity-20 mix-blend-multiply blur-xl filter'
        style={{ animationDelay: '4s' }}
      />

      {/* Content */}
      <div className='relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-12'>
        {/* Hero Section */}
        <div className='animate-slide-in-up mb-16 text-center'>
          <div className='glass-dark mb-6 inline-flex items-center gap-2 rounded-full px-4 py-2'>
            <Sparkles className='h-4 w-4 text-yellow-400' />
            <span className='text-sm text-white/90'>
              Powered by AI Technology
            </span>
          </div>

          <h1 className='mb-6 bg-linear-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-6xl leading-tight font-black text-transparent md:text-8xl'>
            Face Scan
          </h1>

          <p className='mx-auto mb-4 max-w-2xl text-xl font-light text-white/80 md:text-2xl'>
            ระบบจดจำใบหน้าอัจฉริยะ
          </p>

          <p className='mx-auto mb-12 max-w-xl text-base text-white/60 md:text-lg'>
            เทคโนโลยี AI ที่ทันสมัยสำหรับการจดจำใบหน้าแบบเรียลไทม์
            เหมาะสำหรับงานอีเวนต์และการจัดการผู้เข้าร่วม
          </p>

          <div className='flex flex-wrap justify-center gap-4'>
            <AnimatedButton
              variant='primary'
              size='lg'
              onClick={() => navigate('/' + exampleRoutePaths.faceScan)}
              className='group'
            >
              <span className='flex items-center gap-2'>
                <ScanFace className='h-5 w-5 transition-transform group-hover:scale-110' />
                เริ่มสแกนเลย
              </span>
            </AnimatedButton>

            <AnimatedButton
              variant='ghost'
              size='lg'
              onClick={() => navigate('/' + exampleRoutePaths.faceScanIndex)}
            >
              <span className='flex items-center gap-2'>
                <Camera className='h-5 w-5' />
                ลงทะเบียนสมาชิก
              </span>
            </AnimatedButton>
          </div>
        </div>

        {/* Feature Cards */}
        <div className='grid w-full max-w-6xl grid-cols-1 gap-6 md:grid-cols-3'>
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className='animate-slide-in-up'
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <GlassCard
                  hover
                  className='group h-full cursor-pointer'
                  onClick={feature.action}
                >
                  <div
                    className={`h-16 w-16 rounded-2xl bg-linear-to-br ${feature.color} mb-4 flex items-center justify-center transition-transform group-hover:scale-110`}
                  >
                    <Icon className='h-8 w-8 text-white' />
                  </div>

                  <h3 className='mb-3 text-2xl font-bold text-white'>
                    {feature.title}
                  </h3>

                  <p className='leading-relaxed text-white/70'>
                    {feature.description}
                  </p>

                  <div className='mt-4 flex items-center text-white/50 transition-colors group-hover:text-white/90'>
                    <span className='text-sm'>เริ่มใช้งาน</span>
                    <svg
                      className='ml-2 h-4 w-4 transition-transform group-hover:translate-x-2'
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M9 5l7 7-7 7'
                      />
                    </svg>
                  </div>
                </GlassCard>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <footer className='mt-20 text-center text-sm text-white/40'>
          <p>
            © {new Date().getFullYear()} Face Scan System. All rights reserved.
          </p>
        </footer>
      </div>
    </main>
  );
}
