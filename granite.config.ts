import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'english-sentence',
  brand: {
    displayName: '영어 문장 암기',
    primaryColor: '#3182f6',
    icon: '',
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
