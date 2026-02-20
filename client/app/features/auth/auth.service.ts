import Cookies from 'js-cookie';

import { api } from '@/services/api';

const TOKEN_KEY = 'access_token';
const TOKEN_EXPIRES = 7; // days

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  businessId: string | null;
  business?: {
    id: string;
    name: string;
    description: string | null;
  } | null;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export async function loginUser(payload: LoginPayload): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/login', payload);
  Cookies.set(TOKEN_KEY, data.accessToken, {
    expires: TOKEN_EXPIRES,
    sameSite: 'strict',
  });
  return data;
}

export function logoutUser(): void {
  Cookies.remove(TOKEN_KEY);
}

export function getToken(): string | undefined {
  return Cookies.get(TOKEN_KEY);
}
