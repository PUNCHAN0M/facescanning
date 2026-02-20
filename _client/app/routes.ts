import {
  index,
  layout,
  route,
  type RouteConfig,
} from '@react-router/dev/routes';

export default [
  index('features/index/pages/IndexPage.tsx'),

  layout('features/_example/layouts/ExampleLayout.tsx', [
    route('example', 'features/_example/pages/ExamplePage.tsx'),
  ]),

  // Face scanning feature
  layout('features/face-scan/layouts/FaceScanLayout.tsx', [
    route('face-scan', 'features/face-scan/pages/FaceDetectionPage.tsx'),
    route('face-scan/scan', 'features/face-scan/pages/FaceScanPage.tsx'),
    route('register', 'features/face-scan/pages/RegistrationPage.tsx'),
  ]),

  // Dashboard
  route('dashboard', 'features/dashboard/pages/DashboardPage.tsx'),
] satisfies RouteConfig;
