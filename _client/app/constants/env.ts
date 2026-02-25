export const clientUrl = import.meta.env.VITE_CLIENT_URL;

export const apiUrl = import.meta.env.VITE_API_URL;
export const isProd = import.meta.env.PROD;
export const isLocal = import.meta.env.DEV;
export const mode = import.meta.env.MODE;

export const showLogger = isLocal
  ? true
  : import.meta.env.VITE_SHOW_LOGGER === 'true';
