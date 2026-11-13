// Quad Data API adapter (https://usequad.app/developers, OpenAPI at /api/v1/openapi.json).
// Auth: Bearer key from the environment (never sent to the browser).
// Athletics come from federal IPEDS reporting: association (NCAA / NAIA), NCAA division, conference,
// and a sports list ("basketball" is not gender-specific). No rosters, staff, or junior colleges.

const BASE = process.env.QUAD_API_BASE || 'https://usequad.app';
export const QUAD_RADII = [25, 50, 100, 200, 300, 500];

export function quadConfigured() { return Boolean(process.env.QUAD_API_KEY); }

export function levelOf(athletics) {
  if (!athletics) return null;
  const assoc = athletics.associations || [];
  if (assoc.includes('ncaa')) return { I: 'D1', II: 'D2', III: 'D3' }[athletics.division] || null;
  if (assoc.includes('naia')) return 'NAIA';
  return null;
}

const rate = v => (v == null ? null : v <= 1 ? v : v / 100);

export function mapSchool(x, rank = 0) {
  const a = x.campus?.athletics || null;
  return {
    id: `q${x.unit_id}`, unitId: String(x.unit_id), name: x.name,
    city: x.location?.city ?? null, state: x.location?.state ?? null,
    control: x.type || null,
    level: levelOf(a),
    conference: a?.conference?.name || null,
    basketballListed: Boolean(a?.sports?.includes('basketball')),
    netPrice: x.cost?.avg_net_price ?? null,
    costOfAttendance: x.cost?.cost_of_attendance ?? null,
    acceptance: rate(x.admissions?.acceptance_rate),
    undergrads: x.demographics?.undergrad_enrollment ?? null,
    grantPct: rate(x.aid?.grant_pct),
    instAidAvg: x.aid?.institutional_avg ?? null,
    accent: x.brand?.accent || null, crest: x.brand?.crest_to || null, onAccent: x.brand?.on_accent || null,
    website: x.links?.website || null, priceCalculator: x.links?.price_calculator || null,
    rank, source: 'quad',
  };
}

async function quadGet(path, params) {
  const res = await fetch(`${BASE}${path}?${new URLSearchParams(params)}`, {
    headers: { Authorization: `Bearer ${process.env.QUAD_API_KEY}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(`Quad ${res.status}`);
    // Quad rejects ZIPs it can't place (e.g. PO-box-only ZIPs) with a 400 that mentions `near`.
    if (res.status === 400 && /near/.test(body?.error?.message || '')) err.code = 'UNKNOWN_ZIP';
    throw err;
  }
  return res.json();
}

// Four-year colleges with NCAA or NAIA athletics within `radius` miles of `zip`, closest first.
export async function searchAthleticSchools({ zip, radius }) {
  if (!quadConfigured()) return { configured: false, items: [] };
  const within = QUAD_RADII.includes(radius) ? radius : 100;
  const j = await quadGet('/api/v1/schools', {
    division: 'I,II,III,naia', limit: '100', near: zip, within: String(within), sort: 'distance', sortDir: 'asc',
    fields: 'location,type,campus,cost,admissions,links,demographics,aid,brand',
  });
  return { configured: true, total: j.total ?? 0, items: (j.items || []).map((x, i) => mapSchool(x, i)).filter(s => s.level) };
}
