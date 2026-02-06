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
] satisfies RouteConfig;
