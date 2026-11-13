import test from 'node:test';
import assert from 'node:assert/strict';
import { assess, gradYear } from '../lib/engine.js';

const now = new Date('2026-11-13');
const min = { grade: 10, positions: ['wing'], zip: '63101', radius: 100 };
const full = { ...min, height: 68, playing: ['hs_varsity', 'aau_local'], gpa: '3.5', interest: ['camp_invite'], interestLevels: ['D2'] };

test('only grade, position and ZIP are required', () => {
  const r = assess(min, now);
  assert.equal(r.ok, true);
  assert.equal(r.profile.height, null);
  assert.equal(r.signal.strength, 'none');
  assert.ok(r.levels.every(l => l.size === null), 'no size context without height');
});

test('graduation year rolls over in August', () => {
  assert.equal(gradYear(10, now), 2029);
  assert.equal(gradYear(12, now), 2027);
});

test('no user-facing text mentions Coach Tay', () => {
  for (const g of [8, 9, 10, 11, 12]) {
    const r = assess({ ...full, grade: g, interest: ['offer'], interestLevels: ['D1'] }, now);
    const visible = JSON.stringify(r, (k, v) => (k === 'src' ? undefined : v));
    assert.doesNotMatch(visible, /Coach Tay/i);
  }
});

test('never states a division classification or probability', () => {
  const r = JSON.stringify(assess({ ...full, height: 76, positions: ['post'], interest: ['offer'], interestLevels: ['D1'] }, now));
  assert.doesNotMatch(r, /\b(she is|she's) (a )?(D1|D2|D3|Division)/i);
  assert.doesNotMatch(r, /\d+\s?% (chance|probability)/i);
});

test('early signals never mark a level "explore first"', () => {
  const r = assess(full, now);
  assert.ok(r.levels.every(l => l.status !== 'explore_first'));
  assert.equal(r.signal.strength, 'early');
});

test('strong signal puts that level first and sets focus', () => {
  const r = assess({ ...full, interest: ['watched'], interestLevels: ['NAIA'] }, now);
  assert.equal(r.levels[0].level, 'NAIA');
  assert.deepEqual(r.focus, ['NAIA']);
});

test('size context uses the best-fitting position group', () => {
  const r = assess({ ...full, height: 70, positions: ['wing', 'four'] }, now);
  const d1 = r.levels.find(l => l.level === 'D1');
  assert.equal(d1.size.rel, 'within');
});

test('actions: 1–4 items, every one sourced; offer comes first', () => {
  for (const g of [8, 9, 10, 11, 12]) {
    const r = assess({ ...full, grade: g }, now);
    assert.ok(r.actions.length >= 1 && r.actions.length <= 4);
    r.actions.forEach(a => assert.ok(a.src, a.id));
  }
  assert.equal(assess({ ...full, grade: 11, interest: ['offer'] }, now).actions[0].id, 'offer-timeline');
});

test('"none" interest is exclusive', () => {
  const r = assess({ ...full, interest: ['none', 'mail'], interestLevels: ['D1'] }, now);
  assert.equal(r.signal.label, 'None yet');
  assert.equal(r.focus, null);
});

test('rejects missing required fields', () => {
  const r = assess({ grade: 7, positions: [], zip: '6310' }, now);
  assert.equal(r.ok, false);
  assert.deepEqual(r.errors.sort(), ['grade', 'positions', 'zip'].sort());
});

test('skill match: evaluator + height in range makes a level "explore first"', () => {
  const r = assess({ ...min, height: 68, evalLevels: ['D2'] }, now);
  const d2 = r.levels.find(l => l.level === 'D2');
  assert.equal(d2.evidence.score, 3);
  assert.equal(d2.status, 'explore_first');
  assert.deepEqual(r.match.levels, ['D2']);
  assert.equal(r.levels[0].level, 'D2');
});

test('skill match: height alone never creates a match', () => {
  const r = assess({ ...min, height: 68 }, now);
  assert.equal(r.match.levels, null);
  assert.ok(r.levels.every(l => l.status === 'open'));
});

test('skill match: evidence labels and confidence', () => {
  const none = assess(min, now);
  assert.equal(none.match.confidence.level, 'Low');
  assert.ok(none.levels.every(l => l.evidence.label === 'None yet'));
  const rich = assess({ ...min, height: 68, role: 'starter', evalLevels: ['D2'], interest: ['watched'], interestLevels: ['D2'] }, now);
  assert.equal(rich.match.confidence.level, 'High');
  assert.equal(rich.levels.find(l => l.level === 'D2').evidence.label, 'Strong');
});

test('skill match: below-range height adds no evidence', () => {
  const r = assess({ ...min, height: 60, positions: ['post'], evalLevels: ['D1'] }, now);
  const d1 = r.levels.find(l => l.level === 'D1');
  assert.equal(d1.size.rel, 'below');
  assert.equal(d1.evidence.score, 2);
});

test('role drives recommendations, not level', () => {
  const r = assess({ ...min, grade: 11, role: 'go_to', interest: ['none'] }, now);
  assert.ok(r.actions.some(a => a.id === 'underexposed'));
  assert.equal(r.match.levels, null);
  const r2 = assess({ ...min, role: 'limited' }, now);
  assert.ok(r2.actions.some(a => a.id === 'earn-role') || r2.actions.length === 4);
});
