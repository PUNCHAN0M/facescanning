import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import type { ApiResponse, PaginationParams } from '@/types';

import { ApiService, handleApiError } from '@/services/crud';

// * GENERIC CRUD HOOKS
export function useEntityList<T>(
  queryKey: string,
  service: ApiService<T>,
  params?: PaginationParams,
  options?: {
    enabled?: boolean;
    staleTime?: number;
    cacheTime?: number;
  },
) {
  return useQuery({
    queryKey: [queryKey, 'list', params],
    queryFn: () => service.getAll(params),
    staleTime: options?.staleTime ?? 5 * 60 * 1000, // 5 minutes
    gcTime: options?.cacheTime ?? 10 * 60 * 1000, // 10 minutes
    enabled: options?.enabled ?? true,
  });
}

export function useEntityById<T>(
  queryKey: string,
  service: ApiService<T>,
  id: string,
  options?: {
    enabled?: boolean;
    staleTime?: number;
  },
) {
  return useQuery({
    queryKey: [queryKey, 'detail', id],
    queryFn: () => service.getById(id),
    enabled: (options?.enabled ?? true) && !!id,
    staleTime: options?.staleTime ?? 5 * 60 * 1000,
  });
}

export function useCreateEntity<T>(
  queryKey: string,
  service: ApiService<T>,
  options?: {
    onSuccess?: (data: ApiResponse<T>) => void;
    onError?: (error: unknown) => void;
    showSuccessToast?: boolean;
    showErrorToast?: boolean;
    successMessage?: string;
  },
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ data }: { data: T }) => service.create(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [queryKey, 'list'] });

      if (options?.showSuccessToast !== false) {
        toast.success(options?.successMessage ?? 'Created successfully');
      }

      options?.onSuccess?.(data);
    },
    onError: (error) => {
      if (options?.showErrorToast !== false) {
        toast.error(handleApiError(error));
      }

      options?.onError?.(error);
    },
  });
}

export function useUpdateEntity<T>(
  queryKey: string,
  service: ApiService<T>,
  options?: {
    onSuccess?: (data: ApiResponse<T>) => void;
    onError?: (error: unknown) => void;
    showSuccessToast?: boolean;
    showErrorToast?: boolean;
    successMessage?: string;
  },
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<T> }) =>
      service.update(id, data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: [queryKey, 'list'] });
      queryClient.invalidateQueries({
        queryKey: [queryKey, 'detail', variables.id],
      });

      if (options?.showSuccessToast !== false) {
        toast.success(options?.successMessage ?? 'Updated successfully');
      }

      options?.onSuccess?.(data);
    },
    onError: (error) => {
      if (options?.showErrorToast !== false) {
        toast.error(handleApiError(error));
      }

      options?.onError?.(error);
    },
  });
}

export function useDeleteEntity<T>(
  queryKey: string,
  service: ApiService<T>,
  options?: {
    onSuccess?: () => void;
    onError?: (error: unknown) => void;
    showSuccessToast?: boolean;
    showErrorToast?: boolean;
    successMessage?: string;
  },
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }: { id: string }) => service.delete(id),
    onSuccess: (_, variables) => {
      queryClient.removeQueries({
        queryKey: [queryKey, 'detail', variables.id],
      });
      queryClient.invalidateQueries({ queryKey: [queryKey, 'list'] });

      if (options?.showSuccessToast !== false) {
        toast.success(options?.successMessage ?? 'Deleted successfully');
      }

      options?.onSuccess?.();
    },
    onError: (error) => {
      if (options?.showErrorToast !== false) {
        toast.error(handleApiError(error));
      }

      options?.onError?.(error);
    },
  });
}

export function useBulkDeleteEntity<T>(
  queryKey: string,
  service: ApiService<T> & {
    bulkDelete?: (
      ids: string[],
    ) => Promise<ApiResponse<{ deleted: number; failed: string[] }>>;
  },
  options?: {
    onSuccess?: (
      data: ApiResponse<{ deleted: number; failed: string[] }>,
    ) => void;
    onError?: (error: unknown) => void;
    showSuccessToast?: boolean;
    showErrorToast?: boolean;
    successMessage?: string;
  },
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ids }: { ids: string[] }) => {
      if (!service.bulkDelete) {
        throw new Error('Bulk delete not supported by this service');
      }
      return service.bulkDelete(ids);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [queryKey, 'list'] });

      if (options?.showSuccessToast !== false) {
        const deletedCount = data.data?.deleted ?? 'selected';
        const message =
          options?.successMessage ??
          `Successfully deleted ${deletedCount} items`;
        toast.success(message);
      }

      options?.onSuccess?.(data);
    },
    onError: (error) => {
      if (options?.showErrorToast !== false) {
        toast.error(handleApiError(error));
      }

      options?.onError?.(error);
    },
  });
}

// * CUSTOM QUERY HOOK FOR COMPLEX QUERIES
export function useCustomQuery<T = unknown>(
  queryKey: (string | number | object)[],
  queryFn: () => Promise<T>,
  options?: {
    enabled?: boolean;
    staleTime?: number;
    cacheTime?: number;
    retry?: boolean | number;
  },
) {
  return useQuery({
    queryKey,
    queryFn,
    enabled: options?.enabled ?? true,
    staleTime: options?.staleTime ?? 5 * 60 * 1000,
    gcTime: options?.cacheTime ?? 10 * 60 * 1000,
    retry: options?.retry ?? 3,
  });
}

// * CUSTOM MUTATION HOOK FOR COMPLEX MUTATIONS
export function useCustomMutation<TData = unknown, TVariables = unknown>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: {
    queryKey?: (string | number | object)[];
    onSuccess?: (data: TData, variables: TVariables) => void;
    onError?: (error: unknown, variables: TVariables) => void;
    showSuccessToast?: boolean;
    showErrorToast?: boolean;
    successMessage?: string;
  },
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: (data, variables) => {
      if (options?.queryKey) {
        queryClient.invalidateQueries({ queryKey: options.queryKey });
      }

      if (options?.showSuccessToast !== false) {
        toast.success(options?.successMessage ?? 'Operation successful');
      }

      options?.onSuccess?.(data, variables);
    },
    onError: (error, variables) => {
      if (options?.showErrorToast !== false) {
        toast.error(handleApiError(error));
      }

      options?.onError?.(error, variables);
    },
  });
}
