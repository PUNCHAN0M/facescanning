import {
  useBulkDeleteEntity,
  useCreateEntity,
  useCustomMutation,
  useCustomQuery,
  useDeleteEntity,
  useEntityById,
  useEntityList,
  useUpdateEntity,
} from '@/hooks';
import type { PaginationParams } from '@/types';

import {
  exampleApiService,
  exampleCustomApiService,
} from '../services/exampleService';
import type { ExamplePayload } from '../types/example';

// * EXAMPLE CRUD
export const useExampleList = (params?: PaginationParams) => {
  return useEntityList('examples', exampleApiService, params);
};

export const useExampleById = (id: string) => {
  return useEntityById('examples', exampleApiService, id);
};

export const useCreateExample = () => {
  return useCreateEntity('examples', exampleApiService);
};

export const useUpdateExample = () => {
  return useUpdateEntity('examples', exampleApiService);
};

export const useDeleteExample = () => {
  return useDeleteEntity('examples', exampleApiService);
};

export const useBulkDeleteExample = () => {
  return useBulkDeleteEntity('examples', exampleApiService);
};

// * EXAMPLE CUSTOM
export const useExampleStats = () => {
  return useCustomQuery(['stats'], exampleCustomApiService.getStats);
};

export const useCreateRawJsonBodyExample = () => {
  return useCustomMutation(
    (data: ExamplePayload) =>
      exampleCustomApiService.createRawJsonBodyExample(data),
    {
      queryKey: ['users'],
    },
  );
};

export const useUpdateRawJsonBodyExample = () => {
  return useCustomMutation(
    (data: { id: string } & ExamplePayload) =>
      exampleCustomApiService.updateRawJsonBodyExample(data.id, data),
    {
      queryKey: ['users'],
    },
  );
};
