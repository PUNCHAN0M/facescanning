import { Link, Outlet } from 'react-router';

export default function FaceScanLayout() {
  return (
    <section className='min-h-screen bg-linear-to-br from-slate-900 via-purple-900 to-slate-900'>
      <nav className='glass-dark fixed top-0 right-0 left-0 z-50 border-b border-white/10'>
        <div className='mx-auto flex max-w-7xl items-center justify-between px-8 py-4'>
          <h2 className='bg-linear-to-r from-purple-400 to-pink-400 bg-clip-text text-2xl font-bold text-white'>
            Face Scanning System
          </h2>
          <ul className='flex gap-6'>
            <li>
              <Link
                to='/face-scan'
                className='rounded-lg px-4 py-2 font-medium text-white/80 transition-all hover:bg-white/10 hover:text-white'
              >
                Home
              </Link>
            </li>
            <li>
              <Link
                to='/face-scan/scan'
                className='rounded-lg px-4 py-2 font-medium text-white/80 transition-all hover:bg-white/10 hover:text-white'
              >
                Scan
              </Link>
            </li>
          </ul>
        </div>
      </nav>

      <main className='pt-20'>
        <Outlet />
      </main>
    </section>
  );
}
