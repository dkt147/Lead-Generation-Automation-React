import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve, join } from 'path';
import { pathToFileURL } from 'url';
import dotenv from 'dotenv';

dotenv.config();

// Plugin that serves api/ functions locally during dev
function apiPlugin() {
  return {
    name: 'api-serverless',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/api/')) return next();

        // Map URL to file: /api/monday/columns -> api/monday/columns.js
        const route = req.url.replace(/^\/api\//, '').split('?')[0];
        const filePath = resolve(`api/${route}.js`);

        try {
          // Read body for POST
          let body = '';
          if (req.method === 'POST') {
            body = await new Promise((r) => {
              let d = '';
              req.on('data', (c) => (d += c));
              req.on('end', () => r(d));
            });
          }

          // Build fake Vercel req/res
          const fakeReq = {
            method: req.method,
            headers: req.headers,
            body: body ? JSON.parse(body) : undefined,
            query: Object.fromEntries(new URL(req.url, 'http://localhost').searchParams),
          };

          const fakeRes = {
            statusCode: 200,
            _headers: {},
            setHeader(k, v) { this._headers[k] = v; },
            status(code) { this.statusCode = code; return this; },
            json(data) {
              res.writeHead(this.statusCode, { 'Content-Type': 'application/json', ...this._headers });
              res.end(JSON.stringify(data));
            },
            end() { res.writeHead(this.statusCode, this._headers); res.end(); },
          };

          // Dynamic import the handler (with cache bust for HMR)
          const fileUrl = pathToFileURL(filePath).href + `?t=${Date.now()}`;
          const mod = await import(fileUrl);
          await mod.default(fakeReq, fakeRes);
        } catch (err) {
          if (err.code === 'ERR_MODULE_NOT_FOUND') {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `API route not found: /api/${route}` }));
          } else {
            console.error(`API error [${route}]:`, err.message);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), apiPlugin()],
});
