module.exports = {
  'client/**/*.{js,ts,jsx,tsx}': ['pnpm lint:client'],
  'server/**/*.{js,ts,jsx,tsx}': ['pnpm lint:server'],
  'ai/**/*.py': ['pnpm format:ai', 'pnpm lint:ai'],
  '*.{js,json,md}': 'prettier -w --ignore-unknown',
};
