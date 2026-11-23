import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  base: '/console/',
  plugins: [react()],
  build: { target: 'es2022', manifest: true },
  server: {
    port: 18090,
    strictPort: true,
    host: '127.0.0.1',
    proxy: {
      '/v1/': { target: 'http://localhost:18080', ws: true },
      '/v2-beta': { target: 'http://localhost:18080', ws: true },
      '/oidc': {
        target: 'http://localhost:18080',
        configure(proxy) {
          proxy.on('proxyRes', (response) => {
            const destination = response.headers.location;
            if (destination?.startsWith('/login'))
              response.headers.location = destination.replace('/login', '/console/login');
          });
        },
      },
      '/v1-catalog': 'http://localhost:18080',
      '/v1-webhooks': 'http://localhost:18080',
      '/v1-auth': 'http://localhost:18080',
      '/r': { target: 'http://localhost:18080', ws: true },
    },
  },
});
