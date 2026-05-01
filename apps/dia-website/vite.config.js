import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@dia/shared': path.resolve(__dirname, '../../packages/dia-shared/src'),
      '@dia/home': path.resolve(__dirname, '../dia-home/src'),
      '@dia/calendar': path.resolve(__dirname, '../dia-calendar/src'),
      '@dia/map': path.resolve(__dirname, '../dia-map/src'),
    },
    dedupe: ['react', 'react-dom', 'react/jsx-runtime', '@react-oauth/google', 'leaflet'],
  },
});
