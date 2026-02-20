import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

import { queryClient as defaultQueryClient } from '@/lib/react-query';

import { isLocal } from '@/constants';

interface ReactQueryProviderProps {
  children: React.ReactNode;
  client?: QueryClient;
}

export function ReactQueryProvider({
  children,
  client = defaultQueryClient,
}: ReactQueryProviderProps) {
  return (
    <QueryClientProvider client={client}>
      {children}
      {isLocal && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
