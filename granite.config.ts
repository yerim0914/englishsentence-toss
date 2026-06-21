import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'englishsentence',
  brand: {
    displayName: '영어문장암기',
    primaryColor: '#3182f6',
    icon: 'https://static.toss.im/appsintoss/49053/a9b07376-b7e2-40a8-a70d-e644bb31d1e7.png',
  },
  web: {
    host: 'localhost',
    port: 5173,
    commands: {
      dev: 'vite --host 0.0.0.0',
      build: 'vite build',
    },
  },
  navigationBar: {
    withBackButton: true,
    withHomeButton: true,
  },
  permissions: [],
  outdir: 'dist',
});
