import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En GitHub Pages la web cuelga de /<repo>/; en local, de /
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE ?? '/',
  server: { fs: { allow: ['.'] } },
});
