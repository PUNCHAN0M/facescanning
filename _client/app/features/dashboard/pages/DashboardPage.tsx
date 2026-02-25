import { ArrowLeft, Building2, Clock, TrendingUp, Users } from 'lucide-react';
import { useNavigate } from 'react-router';

import { AnimatedButton } from '@/components/common/AnimatedButton';
import { GlassCard } from '@/components/common/GlassCard';

export default function DashboardPage() {
  const navigate = useNavigate();

  // Mock data
  const stats = [
    {
      label: 'องค์กรทั้งหมด',
      value: '12',
      icon: Building2,
      color: 'from-blue-500 to-cyan-500',
    },
    {
      label: 'สมาชิกทั้งหมด',
      value: '248',
      icon: Users,
      color: 'from-purple-500 to-pink-500',
    },
    {
      label: 'สแกนวันนี้',
      value: '45',
      icon: TrendingUp,
      color: 'from-orange-500 to-red-500',
    },
  ];

  const organizations = [
    { name: 'บริษัท ABC จำกัด', members: 45, scans: 120 },
    { name: 'บริษัท XYZ จำกัด', members: 32, scans: 89 },
    { name: 'มหาวิทยาลัย DEF', members: 156, scans: 340 },
  ];

  const recentScans = [
    {
      name: 'สมชาย ใจดี',
      org: 'บริษัท ABC จำกัด',
      time: '10:30',
      confidence: 95,
    },
    {
      name: 'สมหญิง รักดี',
      org: 'บริษัท XYZ จำกัด',
      time: '10:28',
      confidence: 92,
    },
    {
      name: 'สมศักดิ์ มีสุข',
      org: 'มหาวิทยาลัย DEF',
      time: '10:25',
      confidence: 98,
    },
    {
      name: 'สมหมาย ดีงาม',
      org: 'บริษัท ABC จำกัด',
      time: '10:22',
      confidence: 90,
    },
  ];

  return (
    <div className='relative min-h-screen overflow-hidden bg-linear-to-br from-slate-900 via-purple-900 to-slate-900'>
      <div className='gradient-mesh absolute inset-0 opacity-20' />

      {/* Header */}
      <div className='glass-dark absolute top-0 right-0 left-0 z-20 p-6'>
        <div className='mx-auto flex max-w-7xl items-center justify-between'>
          <AnimatedButton
            variant='ghost'
            size='sm'
            onClick={() => navigate('/')}
          >
            <ArrowLeft className='mr-2 h-5 w-5' />
            กลับหน้าหลัก
          </AnimatedButton>

          <div className='flex items-center gap-2'>
            <Clock className='h-5 w-5 text-white/70' />
            <span className='text-sm text-white/90'>
              {new Date().toLocaleDateString('th-TH', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className='relative z-10 p-6 pt-24'>
        <div className='mx-auto max-w-7xl'>
          <div className='animate-slide-in-up mb-8'>
            <h1 className='mb-2 text-5xl font-black text-white'>แดชบอร์ด</h1>
            <p className='text-lg text-white/70'>ภาพรวมและสถิติการใช้งาน</p>
          </div>

          {/* Stats */}
          <div className='mb-8 grid grid-cols-1 gap-6 md:grid-cols-3'>
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className='animate-slide-in-up'
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <GlassCard hover>
                    <div className='flex items-center gap-4'>
                      <div
                        className={`h-16 w-16 rounded-2xl bg-linear-to-br ${stat.color} flex items-center justify-center`}
                      >
                        <Icon className='h-8 w-8 text-white' />
                      </div>
                      <div>
                        <p className='text-sm text-white/60'>{stat.label}</p>
                        <p className='text-4xl font-black text-white'>
                          {stat.value}
                        </p>
                      </div>
                    </div>
                  </GlassCard>
                </div>
              );
            })}
          </div>

          <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
            {/* Organizations */}
            <GlassCard className='animate-slide-in-up'>
              <h2 className='mb-6 flex items-center gap-2 text-2xl font-bold text-white'>
                <Building2 className='h-6 w-6' />
                องค์กร
              </h2>

              <div className='space-y-4'>
                {organizations.map((org) => (
                  <div
                    key={org.name}
                    className='group cursor-pointer rounded-xl border border-white/10 bg-white/5 p-4 transition-all hover:bg-white/10'
                  >
                    <div className='mb-2 flex items-center justify-between'>
                      <h3 className='font-semibold text-white transition-colors group-hover:text-purple-300'>
                        {org.name}
                      </h3>
                    </div>
                    <div className='flex items-center gap-4 text-sm text-white/60'>
                      <span className='flex items-center gap-1'>
                        <Users className='h-4 w-4' />
                        {org.members} สมาชิก
                      </span>
                      <span className='flex items-center gap-1'>
                        <TrendingUp className='h-4 w-4' />
                        {org.scans} สแกน
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>

            {/* Recent Scans */}
            <GlassCard
              className='animate-slide-in-up'
              style={{ animationDelay: '0.1s' }}
            >
              <h2 className='mb-6 flex items-center gap-2 text-2xl font-bold text-white'>
                <Clock className='h-6 w-6' />
                การสแกนล่าสุด
              </h2>

              <div className='space-y-3'>
                {recentScans.map((scan, _index) => (
                  <div
                    key={_index}
                    className='group cursor-pointer rounded-xl border border-white/10 bg-white/5 p-4 transition-all hover:bg-white/10'
                  >
                    <div className='mb-2 flex items-center justify-between'>
                      <div className='flex items-center gap-3'>
                        <div className='flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-br from-green-400 to-emerald-500'>
                          <Users className='h-5 w-5 text-white' />
                        </div>
                        <div>
                          <p className='font-medium text-white transition-colors group-hover:text-purple-300'>
                            {scan.name}
                          </p>
                          <p className='text-xs text-white/50'>{scan.org}</p>
                        </div>
                      </div>
                      <div className='text-right'>
                        <p className='text-sm text-white/70'>{scan.time}</p>
                        <p className='text-xs font-semibold text-green-400'>
                          {scan.confidence}%
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
    </div>
  );
}
