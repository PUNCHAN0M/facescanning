import { useMemo } from 'react';

import { getToken } from './auth.service';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  businessId: string | null;
  iat: number;
  exp: number;
}

function decodeToken(token: string): JwtPayload | null {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload)) as JwtPayload;
  } catch {
    return null;
  }
}

export function useAuth() {
  const token = getToken();

  const payload = useMemo(() => {
    if (!token) return null;
    const decoded = decodeToken(token);
    if (!decoded) return null;
    if (decoded.exp * 1000 < new Date().getTime()) return null;
    return decoded;
  }, [token]);

  return {
    isLoggedIn: payload !== null,
    role: payload?.role ?? null,
    userId: payload?.sub ?? null,
    email: payload?.email ?? null,
    businessId: payload?.businessId ?? null,
  };
}
