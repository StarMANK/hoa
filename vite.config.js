import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// This repo lives on a Windows mount (/mnt/...), where inotify events do not
// reach WSL. Polling keeps hot reload honest there.
export default defineConfig({
  plugins: [react()],
  server: {
    watch: { usePolling: true, interval: 300 },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
  },
});
