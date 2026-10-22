import http from 'node:http';
import { readFile } from 'node:fs/promises';
const assets = { '/demo.js': ['demo.js', 'text/javascript; charset=utf-8'], '/demo.css': ['demo.css', 'text/css; charset=utf-8'], '/demo-patients.js': ['../extension/demo-patients.js', 'text/javascript; charset=utf-8'] };
export const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
  const asset = assets[pathname] || (/^\/(?:|tasks|search|appointments|patients|reports|patient\/[^/]+)$/.test(pathname) ? ['index.html', 'text/html; charset=utf-8'] : null);
  if (!asset) { res.writeHead(404, { 'X-Content-Type-Options': 'nosniff' }); res.end('Not found'); return; }
  try { const data = await readFile(new URL(`../demo/${asset[0]}`, import.meta.url)); res.writeHead(200, { 'Content-Type': asset[1], 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'" }); res.end(data); } catch { res.writeHead(500); res.end('Demo server error'); }
});
const port = Number(process.env.DEMO_PORT || 4174);
server.listen(port, '127.0.0.1', () => console.log(`演示 HIS：http://127.0.0.1:${port}/ （仅本机，虚构数据）`));
