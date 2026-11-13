// She's Next Recruits: 60-second assessment (prototype).
// Zero dependencies (Node 18+). Run: node --env-file=.env server.js
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
    } catch (e) { console.error(e.message); out.errors.push('Four-year college data is temporarily unavailable.'); }
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

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'GET' && url.pathname === '/api/options') return send(res, 200, OPTIONS);
    if (req.method === 'POST' && url.pathname === '/api/assess') {
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
