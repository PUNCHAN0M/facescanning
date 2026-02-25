import { Link, Outlet } from 'react-router';

import { cn } from '@/lib/utils';

interface ExampleLayoutProps {
  className?: string;
}

export default function ExampleLayout({ className }: ExampleLayoutProps) {
  return (
    <main className={cn('h-screen', className)}>
      <header className='mx-auto flex h-16 items-center justify-between border-b px-4 shadow-sm'>
        <h1 className='text-xl font-semibold text-gray-900'>📊 Example</h1>

        <nav className='flex space-x-4'>
          <Link
            to='/'
            className='rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          >
            Home
          </Link>
          <Link
            to='/example'
            className='rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-900'
          >
            Example
          </Link>
        </nav>
      </header>

      {/* Main Content */}
      <main className='p-4'>
        <Outlet />
      </main>
    </main>
  );
}
