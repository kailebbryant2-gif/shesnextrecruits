import test from 'node:test';
import assert from 'node:assert/strict';
import { levelOf, selectSchools, mapSchool } from '../lib/quad.js';

test('levelOf maps IPEDS athletics to our levels', () => {
  assert.equal(levelOf({ associations: ['ncaa'], division: 'II' }), 'D2');
  assert.equal(levelOf({ associations: ['ncaa', 'nccaa'], division: 'III' }), 'D3');
  assert.equal(levelOf({ associations: ['naia'], division: null }), 'NAIA');
  assert.equal(levelOf({ associations: [], division: null }), null);
  assert.equal(levelOf(null), null);
});

test('mapSchool keeps conference and basketball listing', () => {
  const s = mapSchool({ unit_id: 147013, name: 'McKendree University', location: { city: 'Lebanon', state: 'IL' },
    campus: { athletics: { associations: ['ncaa'], division: 'II', conference: { name: 'Great Lakes Valley Conference' }, sports: ['basketball'] } } });
  assert.equal(s.level, 'D2'); assert.equal(s.conference, 'Great Lakes Valley Conference'); assert.equal(s.basketballListed, true);
});

const mk = (n, level) => ({ name: n, level });
const items = [mk('a1', 'D1'), mk('a2', 'D1'), mk('b1', 'D2'), mk('b2', 'D2'), mk('b3', 'D2'), mk('b4', 'D2'), mk('c1', 'D3'), mk('c2', 'D3'), mk('c3', 'D3'), mk('n1', 'NAIA')];
const paths = l => ['D1', 'D2', 'D3', 'NAIA', 'JUCO'].map(x => ({ level: x, status: x === l ? 'explore_first' : 'research' }));

test('selectSchools gives explore-first level more slots and leads with it', () => {
  const r = selectSchools(items, paths('D2'));
  assert.equal(r[0].level, 'D2');
  assert.equal(r.filter(s => s.level === 'D2').length, 3);
  assert.equal(r.filter(s => s.level === 'D3').length, 2);
  assert.ok(new Set(r.map(s => s.level)).size >= 3, 'shows a mix of levels');
});

test('selectSchools with no signals spreads evenly and caps at max', () => {
  const r = selectSchools(items, paths(null), { max: 6 });
  assert.equal(r.length, 6);
  assert.ok(r.filter(s => s.level === 'D2').length <= 2);
});
