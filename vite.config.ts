import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';

function apiPlugin(): Plugin {
  return {
    name: 'schemaforge-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith('/api/gemini/')) {
          if (req.method === 'POST') {
            try {
              let bodyStr = '';
              req.on('data', chunk => {
                bodyStr += chunk;
              });
              req.on('end', async () => {
                try {
                  const body = bodyStr ? JSON.parse(bodyStr) : {};
                  const { handleGeminiApi } = await server.ssrLoadModule('/src/server/geminiHandler.ts');
                  const result = await handleGeminiApi(req.url!, body);
                  res.setHeader('Content-Type', 'application/json');
                  res.statusCode = 200;
                  res.end(JSON.stringify(result));
                } catch (err: any) {
                  res.setHeader('Content-Type', 'application/json');
                  res.statusCode = 500;
                  res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
                }
              });
              return;
            } catch (err: any) {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
              return;
            }
          }
        }
        next();
      });
    }
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), apiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
