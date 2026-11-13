// She's Next College Finder AI: server.
// Zero dependencies. Local: `npm run dev` (reads .env). Hosted (Render): `npm start`, keys from environment.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assess, OPTIONS, RADII } from './lib/engine.js';
import { searchSchools } from './lib/scorecard.js';
import { searchAthleticSchools, quadConfigured } from './lib/quad.js';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };

function send(res, code, body, type = 'application/json') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
async function readBody(req) {
  let data = '';
  for await (const chunk of req) { data += chunk; if (data.length > 10_000) throw new Error('too large'); }
  return JSON.parse(data || '{}');
}

// Per-visitor rate limits (protect the Quad / Scorecard daily quotas).
function limiter(max, windowMs) {
  const hits = new Map();
  return req => {
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    const now = Date.now();
    const recent = (hits.get(ip) || []).filter(t => now - t < windowMs);
    recent.push(now); hits.set(ip, recent);
    if (hits.size > 5000) for (const [k, v] of hits) if (now - v[v.length - 1] > windowMs) hits.delete(k);
    return recent.length > max;
  };
}
const assessLimited = limiter(240, 10 * 60 * 1000);
const schoolsLimited = limiter(40, 10 * 60 * 1000);

// School results depend only on ZIP + radius, so cache them (1 hour) to save API calls.
const cache = new Map();
const TTL = 60 * 60 * 1000;
async function findSchools(zip, radius) {
  const key = `${zip}:${radius}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  const out = { zip, radius, fourYear: [], twoYear: [], athletics: quadConfigured(), errors: [] };
  const [q, s] = await Promise.allSettled([
    searchAthleticSchools({ zip, radius }),
    searchSchools({ zip, radius }),
  ]);
  if (q.status === 'fulfilled') out.fourYear = q.value.items;
  else if (q.reason?.code === 'UNKNOWN_ZIP') out.unknownZip = true;
  else { console.error(q.reason?.message); out.errors.push('Four-year college data is temporarily unavailable.'); }
  if (s.status === 'fulfilled') out.twoYear = s.value.results || [];
  else { console.error(s.reason?.message); out.errors.push('Two-year college data is temporarily unavailable.'); }
  if (!out.errors.length) {
    cache.set(key, { at: Date.now(), value: out });
    if (cache.size > 2000) cache.delete(cache.keys().next().value);
  }
  return out;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'GET' && url.pathname === '/healthz') return send(res, 200, { ok: true });
    if (req.method === 'GET' && url.pathname === '/api/options') return send(res, 200, OPTIONS);
    if (req.method === 'POST' && url.pathname === '/api/assess') {
      if (assessLimited(req)) return send(res, 429, { ok: false, error: 'Too many requests. Please try again in a few minutes.' });
      const result = assess(await readBody(req));
      return send(res, result.ok ? 200 : 400, result);
    }
    if (req.method === 'GET' && url.pathname === '/api/schools') {
      const zip = url.searchParams.get('zip') || '';
      const radius = Number(url.searchParams.get('radius'));
      if (!/^\d{5}$/.test(zip) || !RADII.includes(radius)) return send(res, 400, { ok: false, error: 'Enter a 5-digit ZIP and a radius.' });
      if (schoolsLimited(req)) return send(res, 429, { ok: false, error: 'Too many searches. Please try again in a few minutes.' });
      return send(res, 200, { ok: true, ...(await findSchools(zip, radius)) });
    }
    if (req.method === 'GET') {
      const path = normalize(url.pathname === '/' ? '/index.html' : url.pathname).replace(/^(\.\.[/\\])+/, '');
      const file = join(ROOT, path);
      if (!file.startsWith(ROOT)) return send(res, 403, 'Forbidden', 'text/plain');
      const buf = await readFile(file).catch(() => null);
      if (!buf) return send(res, 404, 'Not found', 'text/plain');
      return send(res, 200, buf, TYPES[extname(file)] || 'application/octet-stream');
    }
    send(res, 405, 'Method not allowed', 'text/plain');
  } catch (e) {
    console.error(e);
    send(res, 500, { ok: false, error: 'Server error' });
  }
});

const port = Number(process.env.PORT) || 3000;
server.listen(port, () => {
  console.log(`She's Next College Finder AI on http://localhost:${port}`);
  console.log(`College Scorecard: ${process.env.SCORECARD_API_KEY ? 'configured' : 'NOT configured (set SCORECARD_API_KEY)'}`);
  console.log(`Quad: ${quadConfigured() ? 'configured' : 'NOT configured (set QUAD_API_KEY)'}`);
});
