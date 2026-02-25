import axios, { type AxiosInstance } from 'axios';
import Cookies from 'js-cookie';

import { apiUrl, isProd } from '~/constants';
import { logger } from '~/lib';

const TOKEN_KEY = 'access_token';

export const api: AxiosInstance = axios.create({
  baseURL: apiUrl,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = Cookies.get(TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      Cookies.remove(TOKEN_KEY);
      window.location.href = '/login';
    }

    return Promise.reject(error);
  },
);

if (!isProd) {
  api.interceptors.request.use((config) => {
    logger(`🔵 API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  });

  api.interceptors.response.use(
    (response) => {
      logger(`🟢 API Response: ${response.status} ${response.config.url}`);
      return response;
    },
    (error) => {
      logger(`🔴 API Error: ${error.response?.status} ${error.config?.url}`);
      return Promise.reject(error);
    },
  );
}
