import { createApiService } from '@/services/crud';

import type { Example, ExamplePayload, ExampleStats } from '../types/example';

export const exampleApiService = createApiService<Example>('/example');

// * EXAPLE SPECIFIC API CALLS
export const exampleCustomApiService = {
  // * GET SPECIFIC API
  async getStats(): Promise<{ data: ExampleStats }> {
    return exampleApiService.customGet('/stats');
  },

  // * EXAMPLE RAW JSON BODY (DEFAULT)
  async createRawJsonBodyExample(data: ExamplePayload) {
    return exampleApiService.customPost(`/user`, data);
  },

  async updateRawJsonBodyExample(id: string, data: ExamplePayload) {
    return exampleApiService.customUpdate(`/user`, id, data);
  },

  // * EXAMPLE FORM-DATA BODY
  async createFormDataBodyExample(data: ExamplePayload) {
    const formData = new FormData();
    formData.append('title', data.title);
    formData.append('description', data.description);
    formData.append('username', data.username);
    formData.append('email', data.email);
    formData.append('displayName', data.displayName);
    formData.append('nameSurname', data.nameSurname);
    formData.append('phoneNumber', data.phoneNumber);
    formData.append('role', data.role);
    formData.append('interestedTopic', data.interestedTopic);
    formData.append('note', data.note);
    formData.append('isActive', String(data.isActive));

    return exampleApiService.customPost(`/user`, formData);
  },

  async updateFormDataBodyExample(id: string, data: ExamplePayload) {
    const formData = new FormData();
    formData.append('title', data.title);
    formData.append('description', data.description);
    formData.append('username', data.username);
    formData.append('email', data.email);
    formData.append('displayName', data.displayName);
    formData.append('nameSurname', data.nameSurname);
    formData.append('phoneNumber', data.phoneNumber);
    formData.append('role', data.role);
    formData.append('interestedTopic', data.interestedTopic);
    formData.append('note', data.note);
    formData.append('isActive', String(data.isActive));

    return exampleApiService.customUpdate(`/user`, id, formData);
  },
};
