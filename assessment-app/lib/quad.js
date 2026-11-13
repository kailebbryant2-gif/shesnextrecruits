// Quad Data API adapter (https://usequad.app/developers, OpenAPI at /api/v1/openapi.json).
// Auth: Bearer key from the environment (never sent to the browser).
// Quad's athletics data comes from federal IPEDS reporting: the school's athletic association
// (NCAA / NAIA), NCAA division, conference, and a sports list ("basketball" is not gender-specific).
// It does NOT confirm a women's basketball program, rosters, or staff, and it has no junior colleges.

const BASE = process.env.QUAD_API_BASE || 'https://usequad.app';
// Quad's allowed radii are 25, 50, 100, 200, 300, 500 miles. Drive-time preferences map to:
// "Open to anywhere" still searches outward from home (Quad's 500-mile maximum), closest first.
export const QUAD_RADIUS = { near: 100, day: 500, any: 500 };

export function quadConfigured() { return Boolean(process.env.QUAD_API_KEY); }

export function levelOf(athletics) {
  if (!athletics) return null;
  const assoc = athletics.associations || [];
  if (assoc.includes('ncaa')) return { I: 'D1', II: 'D2', III: 'D3' }[athletics.division] || null;
  if (assoc.includes('naia')) return 'NAIA';
  return null;
}

export function mapSchool(x) {
  const a = x.campus?.athletics || null;
  const level = levelOf(a);
  return {
    unitId: String(x.unit_id), name: x.name,
    city: x.location?.city, state: x.location?.state,
    control: x.type || null,
    level,
    association: a?.associations || [],
    conference: a?.conference?.name || null,
    basketballListed: Boolean(a?.sports?.includes('basketball')),
    avgNetPrice: x.cost?.avg_net_price ?? null,
    costOfAttendance: x.cost?.cost_of_attendance ?? null,
    acceptanceRate: x.admissions?.acceptance_rate ?? null,
    website: x.links?.website || null,
    priceCalculator: x.links?.price_calculator || null,
    source: 'quad',
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

// Four-year colleges with NCAA or NAIA athletics, closest first when a radius applies.
export async function searchAthleticSchools({ zip, distance }) {
  if (!quadConfigured()) return { configured: false, items: [], total: 0 };
  const params = { division: 'I,II,III,naia', limit: '100', fields: 'location,type,campus,cost,admissions,links' };
  const miles = QUAD_RADIUS[distance];
  if (miles) Object.assign(params, { near: zip, within: String(miles), sort: 'distance', sortDir: 'asc' });
  const j = await quadGet('/api/v1/schools', params);
  return { configured: true, total: j.total ?? 0, radiusMiles: miles, items: (j.items || []).map(mapSchool).filter(s => s.level) };
}

// Pick a varied, preference-ordered list: Coach Tay says every level is real college basketball,
// so show several levels; "explore first" levels (from the parent's reported interest) get more slots.
// Order within a level stays as returned (closest first). Nothing here reflects athletic fit.
export function selectSchools(items, pathways, { perFirst = 3, perOther = 2, max = 10 } = {}) {
  const firstLevels = pathways.filter(p => p.status === 'explore_first').map(p => p.level);
  const order = [...firstLevels, ...pathways.map(p => p.level).filter(l => !firstLevels.includes(l) && l !== 'JUCO')];
  const byLevel = Object.fromEntries(order.map(l => [l, items.filter(s => s.level === l)]));
  const quota = l => (firstLevels.includes(l) ? perFirst : perOther);
  const picked = [];
  for (let round = 0; round < perFirst && picked.length < max; round++) {
    for (const l of order) {
      if (round < quota(l) && byLevel[l]?.[round] && picked.length < max) picked.push(byLevel[l][round]);
    }
  }
  return picked;
}
