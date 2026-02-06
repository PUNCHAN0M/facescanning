import { useNavigate } from 'react-router';

import { Button } from '@/components/ui/button';

import { exampleRoutePaths } from '@/constants';

import type { Route } from './+types/IndexPage';

export function meta(_args: Route.MetaArgs) {
  return [
    { title: 'React Nest Template' },
    { name: 'description', content: 'Welcome to React Nest Template' },
  ];
}

export default function IndexPage() {
  const navigate = useNavigate();
  return (
    <main className='flex h-screen w-screen flex-col items-center justify-center gap-6'>
      <h1 className='text-4xl font-extrabold tracking-tight text-gray-800'>
        React Nest Template
      </h1>
      <p className='text-lg text-gray-600'>
        Welcome to the React Nest Template System
      </p>
      <Button
        onClick={() => {
          navigate('/' + exampleRoutePaths.exampleIndex);
        }}
      >
        EXAMPLE FOR DESIGN PRACTICE
      </Button>

      <footer className='absolute bottom-4 text-base text-gray-500'>
        © {new Date().getFullYear()} by{' '}
        <a href='/' className='font-medium text-blue-500 hover:underline'>
          ARTTTT-TTTT
        </a>
      </footer>
    </main>
  );
}
