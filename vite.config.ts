import { defineConfig, type Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

/** dev-only: POST /__shot?name=xyz (PNG body) -> game/out/xyz.png  (used by ?shot=xyz in the page) */
function shots(): Plugin {
  return {
    name: 'dev-shots',
    configureServer(server) {
      server.middlewares.use('/__shot', (req, res) => {
        const name = new URL(req.url ?? '', 'http://x').searchParams.get('name')?.replace(/[^\w.-]/g, '') || 'shot';
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          const dir = path.resolve(__dirname, 'out');
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(path.join(dir, `${name}.png`), Buffer.concat(chunks));
          res.end('ok');
        });
      });
    },
  };
}

export default defineConfig({
  publicDir: 'assets',
  server: { port: 5180, strictPort: true },
  plugins: [shots()],
});
