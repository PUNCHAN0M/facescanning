import type { PaginationParams } from '@/types';
import type { ApiPaginatedResponse, ApiResponse } from '@/types/api';

import exampleDetailData from '../../__mock__/example-detail.json';
import exampleListData from '../../__mock__/example-list.json';
import type { Example } from '../../types/example';

export const exampleApiService = {
  async getAll(
    params?: PaginationParams,
  ): Promise<ApiPaginatedResponse<Example>> {
    const queryParams: Record<string, unknown> = { ...(params ?? {}) };

    const all = (exampleListData.data ?? []) as Example[];

    const search = (queryParams.search as string) ?? '';

    // TITLE AND DESCRIPTIONS SEARCH
    const searchPredicate = (e: Example) =>
      !search
        ? true
        : (e.title ?? '').toLowerCase().includes(search.toLowerCase()) ||
          (e.description ?? '').toLowerCase().includes(search.toLowerCase());

    const filtered = all.filter((e) => searchPredicate(e));

    // Pagination applies to top-level items
    const page = Number(queryParams.page ?? 1);
    const limit = Number((queryParams.limit ?? filtered.length) || 5);
    const total = filtered.length;
    const totalPages = limit > 0 ? Math.max(1, Math.ceil(total / limit)) : 1;

    const start = (page - 1) * limit;
    const paged = filtered.slice(start, start + limit);

    return Promise.resolve({
      data: paged,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
      message: exampleListData.message,
      success: exampleListData.success,
    });
  },

  async getById(id: string): Promise<ApiResponse<Example | null>> {
    if (exampleDetailData.data.id === id) {
      return Promise.resolve(exampleDetailData as ApiResponse<Example>);
    }
    return {
      data: null,
      success: false,
      message: 'ไม่พบข้อมูล',
    };
  },
};
