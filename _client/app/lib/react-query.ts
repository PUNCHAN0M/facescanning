import { QueryClient } from '@tanstack/react-query';

import { isProd } from '@/constants';
/**
 * Create and configure QueryClient for TanStack Query
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale time - data remains fresh for 5 minutes
      staleTime: 1000 * 60 * 5,
      // Cache time - keep inactive queries for 10 minutes
      gcTime: 1000 * 60 * 10,
      // Retry failed requests 3 times (except in development)
      retry: isProd ? 3 : 1,
      // Don't refetch on window focus in development
      refetchOnWindowFocus: isProd,
      // Refetch on mount if data is stale
      refetchOnMount: true,
      // Don't refetch on reconnect in development
      refetchOnReconnect: isProd,
    },
    mutations: {
      // Retry failed mutations once
      retry: 1,
    },
  },
});

/**
 * Query Keys Factory - Centralized query key management
 */
export const queryKeys = {
  // Auth queries
  auth: {
    all: ['auth'] as const,
    profile: () => [...queryKeys.auth.all, 'profile'] as const,
    verify: () => [...queryKeys.auth.all, 'verify'] as const,
  },

  // Future: User queries
  users: {
    all: ['users'] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.users.all, 'list', filters] as const,
    detail: (id: string) => [...queryKeys.users.all, 'detail', id] as const,
  },

  // Future: Admin queries
  admin: {
    all: ['admin'] as const,
    stats: () => [...queryKeys.admin.all, 'stats'] as const,
    settings: () => [...queryKeys.admin.all, 'settings'] as const,
  },
} as const;
