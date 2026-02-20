/* eslint-disable @typescript-eslint/no-namespace */
import { z } from 'zod';

const envVariables = z.object({
  NEXT_PUBLIC_SHOW_LOGGER: z.enum(['true', 'false']).optional(),
});

// Safely choose env source depending on runtime (Node SSR vs browser/Vite).
const rawEnv: Record<string, unknown> = (() => {
  // Node / SSR: process.env exists
  if (typeof process !== 'undefined') {
    const maybeEnv = process as unknown as { env?: Record<string, unknown> };
    if (maybeEnv.env && typeof maybeEnv.env === 'object') return maybeEnv.env;
  }

  // Browser build (Vite): import.meta.env is available
  const meta: unknown = import.meta as unknown;
  if (
    meta &&
    typeof meta === 'object' &&
    'env' in (meta as Record<string, unknown>)
  ) {
    const envCandidate = (meta as Record<string, unknown>)['env'] as
      | Record<string, unknown>
      | undefined;
    if (envCandidate && typeof envCandidate === 'object') return envCandidate;
  }

  return {};
})();

envVariables.parse(rawEnv);

declare global {
  namespace NodeJS {
    interface ProcessEnv extends z.infer<typeof envVariables> {
      // Add at least one property to avoid empty interface
      NODE_ENV: string;
    }
  }
}
