import type { AxiosResponse } from 'axios';

import type {
  ApiPaginatedResponse,
  ApiResponse,
  PaginationParams,
} from '@/types';

import { api } from './api';

// * Utility function to create API service instances
export const createApiService = <T>(endpoint: string) =>
  new ApiService<T>(endpoint);

export class ApiService<T> {
  constructor(private endpoint: string) {}

  // * GET /endpoint - List with pagination
  async getAll(params?: PaginationParams): Promise<ApiPaginatedResponse<T>> {
    const response: AxiosResponse<ApiPaginatedResponse<T>> = await api.get(
      this.endpoint,
      { params },
    );
    return response.data;
  }

  // * GET /endpoint/:id - Get by ID
  async getById(id: string): Promise<ApiResponse<T>> {
    const response: AxiosResponse<ApiResponse<T>> = await api.get(
      `${this.endpoint}/${id}`,
    );
    return response.data;
  }

  // * POST /endpoint - Create
  async create(data: T): Promise<ApiResponse<T>> {
    const response: AxiosResponse<ApiResponse<T>> = await api.post(
      this.endpoint,
      data,
    );
    return response.data;
  }

  // * PUT /endpoint/:id - Update
  async update(id: string, data: Partial<T>): Promise<ApiResponse<T>> {
    const response: AxiosResponse<ApiResponse<T>> = await api.put(
      `${this.endpoint}/${id}`,
      data,
    );
    return response.data;
  }

  // * PATCH /endpoint/:id - Partial update
  async patch(id: string, data: Partial<T>): Promise<ApiResponse<T>> {
    const response: AxiosResponse<ApiResponse<T>> = await api.patch(
      `${this.endpoint}/${id}`,
      data,
    );
    return response.data;
  }

  // * DELETE /endpoint/:id - Delete
  async delete(id: string): Promise<ApiResponse<void>> {
    const response: AxiosResponse<ApiResponse<void>> = await api.delete(
      `${this.endpoint}/${id}`,
    );
    return response.data;
  }

  // * POST /endpoint/bulk-delete - Bulk delete
  async bulkDelete(
    ids: string[],
  ): Promise<ApiResponse<{ deleted: number; failed: string[] }>> {
    const response: AxiosResponse<
      ApiResponse<{ deleted: number; failed: string[] }>
    > = await api.post(`${this.endpoint}/bulk-delete`, { ids });
    return response.data;
  }

  // * Custom endpoint methods
  async customGet<R = unknown>(
    path: string,
    params?: Record<string, unknown>,
  ): Promise<ApiResponse<R>> {
    const response: AxiosResponse<ApiResponse<R>> = await api.get(
      `${this.endpoint}/${path}`,
      { params },
    );
    return response.data;
  }

  async customPost<R = unknown, D = unknown>(
    path: string,
    data?: D,
  ): Promise<ApiResponse<R>> {
    const response: AxiosResponse<ApiResponse<R>> = await api.post(
      `${this.endpoint}/${path}`,
      data,
    );
    return response.data;
  }

  async customUpdate<R = unknown, D = unknown>(
    path: string,
    id: string,
    data?: D,
  ): Promise<ApiResponse<R>> {
    const response: AxiosResponse<ApiResponse<R>> = await api.put(
      `${this.endpoint}/${path}/${id}`,
      data,
    );
    return response.data;
  }

  async customPatch<R = unknown, D = unknown>(
    path: string,
    id: string,
    data?: D,
  ): Promise<ApiResponse<R>> {
    const response: AxiosResponse<ApiResponse<R>> = await api.patch(
      `${this.endpoint}/${path}/${id}`,
      data,
    );
    return response.data;
  }

  async customDelete<R = unknown>(
    path: string,
    id: string,
  ): Promise<ApiResponse<R>> {
    const response: AxiosResponse<ApiResponse<R>> = await api.delete(
      `${this.endpoint}/${path}/${id}`,
    );
    return response.data;
  }
}

// Error handling utility
export const handleApiError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null && 'response' in error) {
    const axiosError = error as { response: { data: { message?: string } } };
    return axiosError.response?.data?.message || 'An error occurred';
  }

  return 'Unknown error occurred';
};
