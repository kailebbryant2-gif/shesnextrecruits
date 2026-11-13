import test from 'node:test';
import assert from 'node:assert/strict';
import { levelOf, mapSchool, searchAthleticSchools } from '../lib/quad.js';

test('levelOf maps IPEDS athletics to levels', () => {
  assert.equal(levelOf({ associations: ['ncaa'], division: 'II' }), 'D2');
  assert.equal(levelOf({ associations: ['ncaa', 'nccaa'], division: 'III' }), 'D3');
  assert.equal(levelOf({ associations: ['naia'], division: null }), 'NAIA');
  assert.equal(levelOf({ associations: [] }), null);
  assert.equal(levelOf(null), null);
});

test('mapSchool keeps athletics, size, aid and brand color', () => {
  const s = mapSchool({ unit_id: 147013, name: 'McKendree University', location: { city: 'Lebanon', state: 'IL' },
    campus: { athletics: { associations: ['ncaa'], division: 'II', conference: { name: 'Great Lakes Valley Conference' }, sports: ['basketball'] } },
    admissions: { acceptance_rate: 0.63 }, demographics: { undergrad_enrollment: 1752 }, aid: { grant_pct: 0.94 }, brand: { accent: '#470A68' } });
  assert.equal(s.level, 'D2'); assert.equal(s.conference, 'Great Lakes Valley Conference');
  assert.equal(s.basketballListed, true); assert.equal(s.undergrads, 1752); assert.equal(s.acceptance, 0.63); assert.equal(s.accent, '#470A68');
});

test('unknown ZIP from Quad is flagged', async () => {
  process.env.QUAD_API_KEY = 'test';
  const orig = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { code: 'bad_request', message: 'near: use a five-digit ZIP code the site knows' } }), { status: 400 });
  try { await assert.rejects(searchAthleticSchools({ zip: '30301', radius: 100 }), e => e.code === 'UNKNOWN_ZIP'); }
  finally { globalThis.fetch = orig; delete process.env.QUAD_API_KEY; }
});
