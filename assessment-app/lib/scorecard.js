// College Scorecard adapter (U.S. Dept. of Education, via api.data.gov).
// The key is read from the environment and sent as a header, never to the browser.
const BASE = 'https://api.data.gov/ed/collegescorecard/v1/schools.json';

const FIELDS = [
  'id', 'school.name', 'school.city', 'school.state', 'school.school_url', 'school.ownership',
  'school.degrees_awarded.predominant', 'latest.student.size',
  'latest.cost.avg_net_price.public', 'latest.cost.avg_net_price.private',
  'latest.admissions.admission_rate.overall', 'location.lat', 'location.lon',
].join(',');

const OWNERSHIP = { 1: 'Public', 2: 'Private nonprofit', 3: 'Private for-profit' };

export async function searchSchools({ zip, radius = 100, page = 0, perPage = 6, twoYearOnly = true }) {
  const key = process.env.SCORECARD_API_KEY;
  if (!key) return { configured: false, results: [], total: 0 };
  const p = new URLSearchParams({
    'school.operating': '1',
    'school.degrees_awarded.predominant': twoYearOnly ? '2' : '2,3', // 2 = associate (JUCO candidates), 3 = bachelor's
    'school.ownership': '1,2',                    // public + private nonprofit
    'latest.student.size__range': '300..',        // filter out very small / non-traditional
    fields: FIELDS, per_page: String(perPage), page: String(page), sort: 'latest.student.size:desc',
  });
  const miles = Math.min(radius, 100); // junior-college options stay local
  p.set('zip', zip); p.set('distance', `${miles}mi`);
  const res = await fetch(`${BASE}?${p}`, { headers: { 'X-Api-Key': key } });
  if (!res.ok) throw new Error(`Scorecard ${res.status}`);
  const j = await res.json();
  return {
    configured: true,
    total: j.metadata?.total ?? 0,
    radiusMiles: miles,
    results: (j.results || []).map(r => ({
      id: `s${r.id}`, scorecardId: r.id, unitId: String(r.id), level: 'JUCO', twoYear: true, source: 'scorecard',
      name: r['school.name'], city: r['school.city'], state: r['school.state'],
      url: r['school.school_url'],
      type: r['school.degrees_awarded.predominant'] === 2 ? '2-year' : '4-year',
      ownership: OWNERSHIP[r['school.ownership']] || null,
      students: r['latest.student.size'],
      netPrice: r['latest.cost.avg_net_price.public'] ?? r['latest.cost.avg_net_price.private'] ?? null,
      acceptance: r['latest.admissions.admission_rate.overall'] ?? null,
      undergrads: r['latest.student.size'] ?? null,
      control: { Public: 'public', 'Private nonprofit': 'private-nonprofit' }[OWNERSHIP[r['school.ownership']]] || null,
      website: r['school.school_url'] || null,
    })),
  };
}
