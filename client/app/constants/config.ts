import type { AppConfig, SiteConfig } from '~/types';

import { apiUrl, clientUrl } from './env';

export const siteConfig: SiteConfig = {
  name: 'Face Scan',
  title: 'Face Scan',
  description: 'Face Scan',
  url: clientUrl || 'http://localhost:5173',
  ogImage: '/images/og.jpg',
  creator: 'ARTTTT-TTTT',
  keywords: ['face-scan'],
};

export const getOrigin = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return clientUrl || 'http://localhost:5173'; // Fallback for SSR
};

export const appConfig: AppConfig = {
  apiUrl: apiUrl || 'http://localhost:8000/api',
  appUrl: getOrigin(),
  oidcAuth: {
    enabled: import.meta.env.VITE_OIDC_ENABLED === 'true',
    config: {
      authority: import.meta.env.VITE_OIDC_AUTHORITY || '',
      client_id: import.meta.env.VITE_OIDC_CLIENT_ID || '',
      redirect_uri: `${getOrigin()}/auth/callback`,
      post_logout_redirect_uri: getOrigin(),
      scope: import.meta.env.VITE_OIDC_SCOPE || 'openid profile email',
      response_type: 'code',
    },
  },
};
