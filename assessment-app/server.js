// She's Next Recruits: 60-second assessment (prototype).
// Zero dependencies. Local: `npm run dev` (reads .env). Hosted (Render): `npm start`, keys from environment.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assess, validate, OPTIONS } from './lib/engine.js';
import { searchSchools } from './lib/scorecard.js';
import { searchAthleticSchools, selectSchools, quadConfigured } from './lib/quad.js';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };

function send(res, code, body, type = 'application/json') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

async function readBody(req) {
  let data = '';
  for await (const chunk of req) { data += chunk; if (data.length > 10_000) throw new Error('too large'); }
  return JSON.parse(data || '{}');
}

// Quad (4-year, NCAA/NAIA athletics) + College Scorecard (2-year colleges as junior-college options).
async function findSchools(clean, pathways) {
  const out = { athletics: quadConfigured(), fourYear: [], twoYear: [], radiusMiles: null, twoYearRadiusMiles: 100, anywhere: clean.distance === 'any', errors: [] };
  if (quadConfigured()) {
    try {
      const q = await searchAthleticSchools({ zip: clean.zip, distance: clean.distance });
      out.radiusMiles = q.radiusMiles; out.fourYearTotal = q.items.length;
      out.fourYear = selectSchools(q.items, pathways);
    } catch (e) {
      console.error(e.message);
      if (e.code === 'UNKNOWN_ZIP') { out.unknownZip = true; return out; }
      out.errors.push('Four-year college data is temporarily unavailable.');
    }
  }
  try {
    const twoYearOnly = quadConfigured();
    // Junior-college options: nearby 2-year colleges only (Scorecard can't sort by distance; NJCAA athletics unverified).
    const sc = await searchSchools({ zip: clean.zip, distance: twoYearOnly ? 'near' : clean.distance, perPage: twoYearOnly ? 3 : 8, twoYearOnly });
    if (sc.configured) {
      out.twoYear = twoYearOnly ? sc.results : sc.results.filter(r => r.type === '2-year');
      if (!twoYearOnly) out.fourYear = sc.results.filter(r => r.type === '4-year');
      out.radiusMiles = out.radiusMiles ?? sc.radiusMiles;
    }
  } catch (e) { console.error(e.message); out.errors.push('Two-year college data is temporarily unavailable.'); }
  return out;
}

// Simple in-memory rate limit for the assessment endpoint (protects the Quad / Scorecard daily quotas).
const WINDOW_MS = 10 * 60 * 1000, MAX_PER_WINDOW = 20;
const hits = new Map();
function rateLimited(req) {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS);
  recent.push(now); hits.set(ip, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (now - v[v.length - 1] > WINDOW_MS) hits.delete(k);
  return recent.length > MAX_PER_WINDOW;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'GET' && url.pathname === '/healthz') return send(res, 200, { ok: true });
    if (req.method === 'GET' && url.pathname === '/api/options') return send(res, 200, OPTIONS);
    if (req.method === 'POST' && url.pathname === '/api/assess') {
      if (rateLimited(req)) return send(res, 429, { ok: false, error: 'Too many requests. Please try again in a few minutes.' });
      const answers = await readBody(req);
      const result = assess(answers);
      if (!result.ok) return send(res, 400, result);
      const { clean } = validate(answers);
      const schools = await findSchools(clean, result.pathways);
      return send(res, 200, { ...result, schools });
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
  console.log(`Assessment running on http://localhost:${port}`);
  console.log(`College Scorecard: ${process.env.SCORECARD_API_KEY ? 'configured' : 'NOT configured (set SCORECARD_API_KEY)'}`);
  console.log(`Quad: ${quadConfigured() ? 'configured' : 'NOT configured (set QUAD_API_KEY)'}`);
});
