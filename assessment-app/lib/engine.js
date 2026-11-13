// Assessment engine for She's Next College Finder AI.
// Implements the documented recruiting methodology (knowledge base IDs in `src`).
// Labels: "supported" (follows from the method + inputs), "research" (worth checking),
// "unknown" (needs film / in-person evaluation). Never assigns a division, probability or benchmark.
//
// Skill matching: the methodology treats three things as evidence of level:
//   1. Coach interest from a level (strongest)       LEVEL-T S4-S5, EVAL-053, FIT-026/027
//   2. An experienced outside evaluator's opinion    LEVEL-T S10, EVAL-053
//   3. Height vs. typical range for her position     EVAL-052 (context only)
// The point weights below are a product design choice to combine that evidence. They are NOT
// published benchmarks and should be reviewed with the methodology owner (see questions file Q-070+).
import { LEVELS, LEVEL_NAMES, SIZE_CHART, SIZE_CHART_CAVEAT, STAGES, MONEY, UNKNOWNS, FIND_OUT } from './content.js';

export const WEIGHTS = { strongInterest: 3, earlyInterest: 1, evaluator: 2, sizeFit: 1 };

const POSITIONS = { pg: 'Point guard', wing: 'Wing', four: 'Forward', post: 'Post' };
const PLAYING = {
  hs_varsity: 'HS varsity', hs_jv: 'HS JV', middle_school: 'Middle school',
  aau_exposure: 'AAU · exposure events', aau_local: 'AAU · local events',
};
const ROLES = { go_to: 'Go-to player', starter: 'Starter', rotation: 'Rotation player', limited: 'Limited minutes' };
const GPA = { lt2: 'Below 2.0', '2.0': '2.0–2.4', '2.5': '2.5–2.9', '3.0': '3.0–3.4', '3.5': '3.5–3.9', '4.0': '4.0+', unsure: 'Not sure' };
const INTEREST = {
  none: 'None yet', mail: 'Mail or follows', camp_invite: 'Camp invites', contacted: 'Coach contact',
  watched: 'Coach watched', visit: 'Campus visit', offer: 'Offer',
};
const STRONG = ['contacted', 'watched', 'visit', 'offer'];
const SIGNAL_ORDER = ['offer', 'visit', 'watched', 'contacted', 'camp_invite', 'mail', 'none'];
export const RADII = [25, 50, 100, 200, 300, 500];

export function gradYear(grade, now = new Date()) {
  const spring = now.getMonth() >= 7 ? now.getFullYear() + 1 : now.getFullYear();
  return spring + (12 - grade);
}
export function fmtHeight(i) { return i >= 80 ? '6\'8"+' : `${Math.floor(i / 12)}'${i % 12}"`; }

export function validate(a = {}) {
  const errs = [];
  const grade = Number(a.grade);
  if (![8, 9, 10, 11, 12].includes(grade)) errs.push('grade');
  const positions = [].concat(a.positions || []).filter(p => POSITIONS[p]);
  if (!positions.length) errs.push('positions');
  const zip = String(a.zip ?? '');
  if (!/^\d{5}$/.test(zip)) errs.push('zip');
  const radius = RADII.includes(Number(a.radius)) ? Number(a.radius) : 100;
  const h = a.height == null || a.height === '' ? null : Number(a.height);
  const height = h != null && h >= 58 && h <= 80 ? h : null;
  const gpa = GPA[a.gpa] ? a.gpa : 'unsure';
  const playing = [].concat(a.playing || []).filter(p => PLAYING[p]);
  const role = ROLES[a.role] ? a.role : null;
  let evalLevels = [].concat(a.evalLevels || []).filter(l => LEVELS.includes(l));
  let interest = [].concat(a.interest || []).filter(p => INTEREST[p]);
  if (!interest.length || interest.includes('none')) interest = ['none'];
  const interestLevels = interest.includes('none') ? [] : [].concat(a.interestLevels || []).filter(l => LEVELS.includes(l));
  return { errs, clean: { grade, positions, zip, radius, height, gpa, playing, role, evalLevels, interest, interestLevels } };
}

const group = p => (p === 'four' ? 'four' : p === 'post' ? 'post' : 'guard');
function sizeFor(level, height, positions) {
  if (height == null) return null;
  const rels = [...new Set(positions.map(group))].map(g => {
    const [lo, hi] = SIZE_CHART[level][g];
    return { g, lo, hi, rel: height < lo ? 'below' : height > hi && g !== 'post' ? 'above' : 'within' };
  });
  const best = rels.find(r => r.rel === 'within') || rels.find(r => r.rel === 'above') || rels[0];
  return { rel: best.rel, range: `${fmtHeight(best.lo)}–${fmtHeight(best.hi)}${best.g === 'post' ? '+' : ''}` };
}

function signal(c) {
  const top = SIGNAL_ORDER.find(s => c.interest.includes(s)) || 'none';
  const strength = STRONG.includes(top) ? 'strong' : top === 'none' ? 'none' : 'early';
  const note = { strong: 'Real coach activity: the best evidence of where she fits.', early: 'Early interest: a foot in the door, not a commitment.', none: c.grade <= 9 ? 'No interest yet, which is normal at her stage.' : 'No interest yet. Getting seen is the priority.' }[strength];
  return { label: INTEREST[top], strength, note, src: 'FIT-026, FIT-027, LEVEL-T S4' };
}

const EVIDENCE_LABEL = s => (s >= 4 ? 'Strong' : s >= 2 ? 'Some' : s >= 1 ? 'Limited' : 'None yet');

// Evidence that her game fits each level, from the three sources the methodology recognizes.
function evidenceFor(level, c, size) {
  const parts = [];
  let score = 0;
  if (c.interestLevels.includes(level)) {
    if (c.interest.some(i => STRONG.includes(i))) { score += WEIGHTS.strongInterest; parts.push('Coaches at this level are showing real interest'); }
    else { score += WEIGHTS.earlyInterest; parts.push('Early interest from this level'); }
  }
  if (c.evalLevels.includes(level)) { score += WEIGHTS.evaluator; parts.push('An experienced evaluator named this level'); }
  if (size && size.rel !== 'below') { score += WEIGHTS.sizeFit; parts.push(size.rel === 'within' ? 'Height in the typical range' : 'Taller than the typical range'); }
  return { score, label: EVIDENCE_LABEL(score), parts };
}

function levels(c) {
  return LEVELS.map(l => {
    const size = sizeFor(l, c.height, c.positions);
    const evidence = evidenceFor(l, c, size);
    const strongInterest = c.interestLevels.includes(l) && c.interest.some(i => STRONG.includes(i));
    const status = strongInterest || evidence.score >= 3 ? 'explore_first' : 'open';
    const reason = evidence.parts.length ? evidence.parts.join(' · ') + '.' : 'No evidence yet either way. Every level is real college basketball.';
    return { level: l, name: LEVEL_NAMES[l], status, reason, evidence, size, money: MONEY[l], unknowns: UNKNOWNS, findOut: FIND_OUT, src: 'EVAL-053, LEVEL-T S4-S10, EVAL-052' };
  }).sort((a, b) => b.evidence.score - a.evidence.score || LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level));
}

function confidence(c) {
  // How much real evidence of level we have. Not a probability.
  let n = 0;
  if (c.interest.some(i => STRONG.includes(i)) && c.interestLevels.length) n += 2;
  else if (c.interestLevels.length) n += 1;
  if (c.evalLevels.length) n += 2;
  if (c.height != null) n += 1;
  if (c.role) n += 1;
  const level = n >= 5 ? 'High' : n >= 3 ? 'Medium' : 'Low';
  const missing = [];
  if (!c.evalLevels.length) missing.push('an experienced evaluator’s opinion');
  if (!(c.interest.some(i => STRONG.includes(i)) && c.interestLevels.length)) missing.push('real coach interest by level');
  if (c.height == null) missing.push('her height');
  return { level, missing, src: 'EVAL-053, LEVEL-T S10' };
}

// Action rules: when(c) -> boolean, p = priority (lower first). Short, neutral copy.
const RULES = [
  { id: 'offer-timeline', p: 1, when: c => c.interest.includes('offer'),
    title: 'Ask each offer’s timeline', text: 'Offers don’t hold forever. Know the deadline, and don’t pass on a school that made her a priority to wait on one that hasn’t.', src: 'WAITING-T, FIT-036' },
  { id: 'senior-push', p: 1, when: c => c.grade === 12 && !c.interest.includes('offer'),
    title: 'Send film and reach out now', text: 'Email full-game film to programs at every level, and ask her high school and AAU coaches to reach out too.', src: 'M2.G12, LEVEL-T S7' },
  { id: 'late-start', p: 2, when: c => c.grade >= 11 && c.interest.includes('none'),
    title: 'Catch up fast', text: 'Build her list, film and outreach plan this month. Every step from earlier grades still applies.', src: 'M2.intro-T, M2.G11' },
  { id: 'get-evaluated', p: 2, when: c => c.grade >= 9 && !c.evalLevels.length,
    title: 'Get an honest level evaluation', text: 'Ask someone who knows college basketball: "What level does her game translate to right now, and what’s keeping her from the next one?"', src: 'LEVEL-T S10, EVAL-053' },
  { id: 'where-stand', p: 2, when: c => c.grade >= 10 && c.interest.some(i => STRONG.includes(i)) && !c.interest.includes('offer'),
    title: 'Ask where she stands', text: '"Where does she currently stand in your recruiting class?" Then watch what coaches do, not just what they say.', src: 'R04-T, FIT-027, SIGNALS-F' },
  { id: 'underexposed', p: 2, when: c => c.grade >= 10 && ['go_to', 'starter'].includes(c.role) && c.interest.includes('none'),
    title: 'She may be under-seen, not under-skilled', text: 'A key player with no interest yet usually needs exposure: film out to coaches and events where they actually evaluate.', src: 'R11-T, R20-T, EVAL-024' },
  { id: 'prep', p: 2, when: c => c.grade === 8,
    title: 'Prepare, don’t chase exposure', text: 'Weight-room technique, practice on her own 4–5 times a week, and great teammate habits. Coaches notice these later.', src: 'M1.L2, M2.G7, M2.G8, MTH-015' },
  { id: 'earn-role', p: 3, when: c => ['rotation', 'limited'].includes(c.role),
    title: 'Grow her role with a "superpower"', text: 'Find the one thing she does that coaches can’t ignore (defense, shooting, energy), build it, and add a fallback skill.', src: 'R09-T, EVAL-021, BOXSCORE-T' },
  { id: 'get-seen', p: 3, when: c => c.grade >= 9 && !c.playing.includes('aau_exposure'),
    title: 'Get seen where coaches evaluate', text: 'Line up her schedule with NCAA live periods, or target holiday high school tournaments near nearby colleges.', src: 'R11-T, D1CAL-F, R18-T, RADIUS-T' },
  { id: 'counselor', p: 3, when: c => ['lt2', '2.0', '2.5'].includes(c.gpa),
    title: 'Check NCAA core courses', text: 'Meet her counselor now. Core-course GPA can differ from report-card GPA, and not every class counts.', src: 'R01-T, FIT-019' },
  { id: 'aau-home', p: 3, when: c => c.grade <= 9 && c.playing.length > 0 && !c.playing.some(p => p.startsWith('aau')),
    title: 'Find an AAU team to stay with', text: 'Pick a program that develops players and gets them evaluated, then stay put so coaches can follow her.', src: 'M2.G8, R14-T' },
  { id: 'versatile-guard', p: 4, when: c => c.positions.length === 1 && c.positions[0] === 'wing',
    title: 'Add a second skill set', text: 'Wings are the biggest recruiting pool. Being able to run point too makes her easier to recruit.', src: 'R09-T, R07-T, EVAL-021' },
  { id: 'versatile-post', p: 4, when: c => c.positions.includes('post') && !c.positions.some(p => p === 'wing' || p === 'pg'),
    title: 'Build perimeter skills', text: 'Bigs who can handle, pass and defend outside give coaches more ways to use them.', src: 'R06-T, EVAL-017' },
  { id: 'film', p: 5, when: c => c.grade >= 9,
    title: 'Start a full-game film library', text: 'Full games first, highlights second. Organize them in one folder with clear labels.', src: 'R20-T, FILMORG-T, STR-042' },
  { id: 'money', p: 5, when: c => ['3.5', '4.0'].includes(c.gpa),
    title: 'Ask about the total package', text: 'Her grades can unlock academic aid at D2, D3 and NAIA schools. Compare total cost, not just athletic money.', src: 'M3.L1-T, FIT-017' },
  { id: 'wants', p: 6, when: () => true,
    title: 'Write down what she wants', text: 'Size, distance, academics, playing time. List must-haves before coaches start pitching.', src: 'WANTS-T, FIT-033' },
];

const CHECKLIST = {
  8: ['Pick an AAU team she can stay with', 'Start supervised strength training', 'Practice on her own 4–5x a week', 'Parents: learn the recruiting timeline'],
  9: ['Start a college list', 'Film every game', 'Meet the counselor about NCAA core courses', 'Create a recruiting info doc'],
  10: ['Match her schedule to live periods', 'Narrow the list and find coach emails', 'Send intro emails with film', 'Track every coach contact'],
  11: ['Sort schools: yes / maybe / no', 'Ask coaches where she stands', 'Plan campus visits', 'Keep transcripts and NCAA account current'],
  12: ['Get each offer’s timeline', 'Do the four-year cost math', 'Request NCAA final certification', 'Send film widely if no offers yet'],
};
const CHECKLIST_SRC = { 8: 'M2.G8, R14-T', 9: 'M2.G9, R01-T, RECINFO-T', 10: 'M2.G10, R12, TRACKER-T', 11: 'M2.G11, R04-T, VISITS-T', 12: 'WAITING-T, NARROW-T, R01-T, M2.G12' };

export function assess(answers, now = new Date()) {
  const { errs, clean: c } = validate(answers);
  if (errs.length) return { ok: false, errors: errs };
  const sig = signal(c);
  const lv = levels(c);
  const top = lv[0].evidence.score;
  const matchLevels = top >= 2 ? lv.filter(l => l.evidence.score === top).map(l => l.level) : null;
  const conf = confidence(c);
  const readiness = [{ label: 'unknown', text: 'Skill match is based on what you shared. Film, in-person viewings and real coach interest confirm it.', src: 'EVAL-053, R31' }];
  if (sig.strength === 'early') readiness.unshift({ label: 'research', text: 'Mail and camp invites are a start, not a commitment. Watch for calls, visits to her games, and role talk.', src: 'FIT-028, SIGNALS-F' });
  if (c.grade >= 10 && sig.strength === 'none') readiness.unshift({ label: 'supported', text: 'At her grade, getting film out and getting seen is urgent.', src: 'R04-T, M2.G10' });
  if (c.playing.length && !c.playing.includes('aau_exposure') && !c.playing.includes('hs_varsity') && c.grade >= 9) readiness.unshift({ label: 'supported', text: 'Her current teams may not put her in front of college coaches. That’s an exposure gap, not a talent judgment.', src: 'R11-T, EVAL-024' });

  return {
    ok: true,
    profile: {
      grade: c.grade, gradYear: gradYear(c.grade, now), height: c.height == null ? null : fmtHeight(c.height), heightIn: c.height,
      positions: c.positions.map(p => POSITIONS[p]), playing: c.playing.map(p => PLAYING[p]), role: c.role ? ROLES[c.role] : null,
      gpa: GPA[c.gpa], zip: c.zip, radius: c.radius,
    },
    stage: { ...STAGES[c.grade] },
    signal: sig,
    match: { levels: matchLevels, confidence: conf },
    focus: lv.filter(l => l.status === 'explore_first').map(l => l.level).length ? lv.filter(l => l.status === 'explore_first').map(l => l.level) : null,
    levels: lv,
    readiness,
    actions: RULES.filter(r => r.when(c)).sort((a, b) => a.p - b.p).slice(0, 4).map(({ id, title, text, src }) => ({ id, title, text, src })),
    checklist: { items: CHECKLIST[c.grade], src: CHECKLIST_SRC[c.grade] },
    sizeCaveat: SIZE_CHART_CAVEAT,
    disclaimer: 'Initial guidance, not a scouting evaluation. Skill match reflects the information you provided. Eligibility, calendar and visit rules change; confirm with the NCAA, NAIA, NJCAA and each school.',
  };
}

export const OPTIONS = { POSITIONS, PLAYING, ROLES, GPA, INTEREST, LEVELS, LEVEL_NAMES, RADII };
