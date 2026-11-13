import test from 'node:test';
import assert from 'node:assert/strict';
import { assess, gradYear } from '../lib/engine.js';

const base = { grade: 10, height: 68, positions: ['wing'], playing: ['hs_varsity_starter', 'aau_local'], gpa: '3.5', interest: ['camp_invite'], interestLevels: ['D2'], zip: '63101', distance: 'near' };
const now = new Date('2026-11-13');

test('valid input produces all five sections', () => {
  const r = assess(base, now);
  assert.equal(r.ok, true);
  for (const k of ['profile', 'pathways', 'recommendations', 'checklist']) assert.ok(r[k]);
  assert.equal(r.pathways.length, 5);
  assert.ok(r.recommendations.length >= 3 && r.recommendations.length <= 5);
});

test('graduation year: 10th grader in Nov 2026 is class of 2029', () => {
  assert.equal(gradYear(10, now), 2029);
  assert.equal(gradYear(12, now), 2027);
});

test('never states a division classification or probability', () => {
  const r = JSON.stringify(assess({ ...base, height: 76, positions: ['post'], interest: ['offer'], interestLevels: ['D1'] }, now));
  assert.doesNotMatch(r, /\b(is|she's|she is) (a )?(D1|D2|D3|Division I+)\b(?! (offer|interest))/i);
  assert.doesNotMatch(r, /\d+\s?% (chance|probability)/i);
});

test('weak signals (mail/camp invites) never put a level in "explore first"', () => {
  const r = assess(base, now);
  assert.ok(r.pathways.every(p => p.status !== 'explore_first'));
});

test('strong signal from a level puts that level first', () => {
  const r = assess({ ...base, interest: ['watched'], interestLevels: ['NAIA'] }, now);
  assert.equal(r.pathways[0].level, 'NAIA');
  assert.equal(r.pathways[0].status, 'explore_first');
});

test('every recommendation and checklist item cites a source', () => {
  for (const g of [8, 9, 10, 11, 12]) {
    const r = assess({ ...base, grade: g }, now);
    r.recommendations.forEach(x => assert.ok(x.src, x.id));
    r.checklist.forEach(x => assert.ok(x.src));
  }
});

test('offer triggers the timeline recommendation first', () => {
  const r = assess({ ...base, grade: 11, interest: ['offer'], interestLevels: ['D2'] }, now);
  assert.equal(r.recommendations[0].id, 'offer-timeline');
});

test('"none" interest is exclusive and senior with none gets urgent outreach', () => {
  const r = assess({ ...base, grade: 12, interest: ['none', 'mail'] }, now);
  assert.deepEqual(r.profile.interest, ['None yet']);
  assert.equal(r.recommendations[0].id, 'senior-flood');
});

test('rejects bad input', () => {
  const r = assess({ ...base, zip: '6310', grade: 7, positions: [] }, now);
  assert.equal(r.ok, false);
  assert.deepEqual(r.errors.sort(), ['grade', 'positions', 'zip'].sort());
});
