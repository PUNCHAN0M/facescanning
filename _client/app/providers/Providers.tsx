import { Toaster } from '@/components/ui/sonner';

import { ReactQueryProvider } from './ReactQueryProvider';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ReactQueryProvider>
      {children}
      <Toaster position='top-right' />
    </ReactQueryProvider>
  );
}
