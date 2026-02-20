import { useQuery } from '@tanstack/react-query';

import type { PaginationParams } from '@/types';

import { exampleApiService } from '../../services/dev/exampleService-dev';

export const useExampleList = (params?: PaginationParams) => {
  return useQuery({
    queryKey: ['examples-dev', params ?? {}],
    queryFn: () => exampleApiService.getAll(params ?? {}),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useExampleById = (id: string) => {
  return useQuery({
    queryKey: ['examples-dev', id],
    queryFn: () => exampleApiService.getById(id),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};
