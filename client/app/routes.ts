import { index, route, type RouteConfig } from '@react-router/dev/routes';

export default [
  index('features/index/pages/IndexPage.tsx'),
  route('login', 'features/auth/pages/LoginPage.tsx'),
] satisfies RouteConfig;
