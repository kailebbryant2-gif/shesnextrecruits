// Rules engine for the 60-second assessment.
// Implements the Phase 2 framework: outputs are labeled
//   "supported"  - follows directly from Coach Tay's teaching + the inputs
//   "research"   - a possibility worth researching; needs evidence
//   "unknown"    - cannot be determined without film / in-person evaluation
// It never assigns a division, probability, or benchmark.
import {
  LEVELS, LEVEL_NAMES, SIZE_CHART, SIZE_CHART_CAVEAT, STAGES,
  LEVEL_ACADEMIC_NOTES, LEVEL_ACADEMIC_SRC, UNKNOWNS_ALWAYS, HOW_TO_FIND_OUT,
} from './content.js';

const POSITIONS = { pg: 'Point guard', wing: 'Wing / 2–3 guard', four: 'Forward / 4', post: 'Post / 5' };
const PLAYING = {
  hs_varsity_starter: 'HS varsity starter', hs_varsity_bench: 'HS varsity (off the bench)', hs_jv: 'HS JV',
  middle_school: 'Middle school', aau_exposure: 'AAU team that plays exposure / live-period events',
  aau_local: 'AAU team that plays local events', no_aau: 'No AAU right now',
};
const GPA = { lt2: 'Below 2.0', '2.0': '2.0–2.4', '2.5': '2.5–2.9', '3.0': '3.0–3.4', '3.5': '3.5–3.9', '4.0': '4.0+', unsure: 'Not sure' };
const INTEREST = {
  none: 'None yet', mail: 'Mail / questionnaires / follows', camp_invite: 'Camp invitations',
  contacted: 'A college coach has contacted her or her coaches', watched: 'A college coach has watched her play',
  visit: 'Unofficial visit', offer: 'Offer',
};
const STRONG_SIGNALS = ['contacted', 'watched', 'visit', 'offer'];
const DISTANCE = { near: 'Within about 2 hours', day: 'Within a day’s drive', any: 'Open to anywhere' };

export function gradYear(grade, now = new Date()) {
  // School year rolls over in August. 12th graders graduate next spring.
  const springYear = now.getMonth() >= 7 ? now.getFullYear() + 1 : now.getFullYear();
  return springYear + (12 - grade);
}

export function fmtHeight(inches) {
  if (inches >= 80) return '6\'8"+';
  return `${Math.floor(inches / 12)}'${inches % 12}"`;
}

export function validate(a) {
  const errs = [];
  const grade = Number(a.grade);
  if (![8, 9, 10, 11, 12].includes(grade)) errs.push('grade');
  const h = Number(a.height);
  if (!(h >= 58 && h <= 80)) errs.push('height');
  const positions = [].concat(a.positions || []).filter(p => POSITIONS[p]);
  if (!positions.length) errs.push('positions');
  const playing = [].concat(a.playing || []).filter(p => PLAYING[p]);
  if (!playing.length) errs.push('playing');
  if (!GPA[a.gpa]) errs.push('gpa');
  const interest = [].concat(a.interest || []).filter(p => INTEREST[p]);
  if (!interest.length) errs.push('interest');
  const interestLevels = [].concat(a.interestLevels || []).filter(l => LEVELS.includes(l));
  if (!/^\d{5}$/.test(String(a.zip || ''))) errs.push('zip');
  if (!DISTANCE[a.distance]) errs.push('distance');
  return { errs, clean: { grade, height: h, positions, playing, gpa: a.gpa, interest: interest.includes('none') ? ['none'] : interest, interestLevels, zip: String(a.zip), distance: a.distance } };
}

function chartKey(pos) { return pos === 'four' ? 'four' : pos === 'post' ? 'post' : 'guard'; }

function heightContext(height, positions) {
  // Compare height to each level's chart range for each selected position group. Context only.
  const groups = [...new Set(positions.map(chartKey))];
  return groups.map(g => {
    const rows = LEVELS.map(l => {
      const [lo, hi] = SIZE_CHART[l][g];
      const plus = g === 'post';
      let rel = height < lo ? 'below' : (height > hi && !plus) ? 'above' : 'within';
      return { level: l, range: `${fmtHeight(lo)}–${fmtHeight(hi)}${plus ? '+' : ''}`, rel };
    });
    return { group: g === 'guard' ? 'Guards / 1–3' : g === 'four' ? '4 players' : '5 / post players', rows };
  });
}

function hasStrongSignal(c) { return c.interest.some(i => STRONG_SIGNALS.includes(i)); }
function onlyWeakSignals(c) { return !c.interest.includes('none') && !hasStrongSignal(c); }

function pathways(c, hctx) {
  const strong = hasStrongSignal(c);
  return LEVELS.map(l => {
    const fromLevel = c.interestLevels.includes(l);
    let status = 'research';
    let why = [];
    if (fromLevel && strong) {
      status = 'explore_first';
      why.push({ text: 'You reported real recruiting activity (contact, a coach watching, a visit or an offer) from this level. Coach Tay: "What level is actively showing us that they value her?"', src: 'LEVEL-T S4, EVAL-053' });
    } else if (fromLevel) {
      why.push({ text: 'You reported early interest (mail, follows or camp invites) from this level. Coach Tay counts that as interest, not commitment. Camp invitations can simply be camp marketing.', src: 'R03-T, R13-T, FIT-026, FIT-028' });
    }
    const hrel = hctx.flatMap(g => g.rows.filter(r => r.level === l).map(r => ({ g: g.group, ...r })));
    const hnote = hrel.map(r => `${r.g}: her height is ${r.rel} the rough range on Coach Tay’s chart (${r.range}).`).join(' ');
    return {
      level: l, name: LEVEL_NAMES[l], status,
      why,
      height: { text: hnote, label: 'research', src: 'SIZECHART-F, EVAL-052' },
      academics: { text: LEVEL_ACADEMIC_NOTES[l], src: LEVEL_ACADEMIC_SRC[l] },
      unknown: UNKNOWNS_ALWAYS,
      findOut: HOW_TO_FIND_OUT,
    };
  }).sort((a, b) => (a.status === 'explore_first' ? -1 : 0) - (b.status === 'explore_first' ? -1 : 0));
}

// Recommendation rules. Each: when(c) -> boolean, priority (lower = first), text, src.
const RULES = [
  { id: 'offer-timeline', p: 1, when: c => c.interest.includes('offer'),
    title: 'Ask every school with an offer: "What is the timeline on this offer?"',
    text: 'An offer doesn’t freeze the recruiting board. "The first player to say yes fills the need." Don’t turn down a school that made her a priority to chase one that hasn’t. That doesn’t mean rush: get the information, then decide.', src: 'WAITING-T, FIT-036' },
  { id: 'senior-flood', p: 1, when: c => c.grade === 12 && !c.interest.includes('offer'),
    title: 'Senior year with no offer: flood coaches with film and outreach now',
    text: 'Coach Tay: "flood with film, flood with stats," and ask her high school and AAU coaches directly to send information for her. Look at every level, including D2, D3, NAIA and JUCO, which she calls "college basketball," not consolation prizes.', src: 'M2.G12, LEVEL-T S7' },
  { id: 'late-catchup', p: 2, when: c => c.grade >= 11 && c.interest.includes('none'),
    title: 'Starting late? Catch up on the earlier grades, then move fast',
    text: '"Go back to previous grade levels and get caught up. DO NOT SKIP them." Then be intentional: "Nothing can be just because." Build her list, film, and outreach plan this month.', src: 'M2.intro-T, M2.G11' },
  { id: 'where-stand', p: 2, when: c => c.grade >= 10 && hasStrongSignal(c) && !c.interest.includes('offer'),
    title: 'Ask coaches showing interest: "Where does she currently stand in your recruiting class?"',
    text: 'Interest isn’t an offer. Watch what coaches do, not just what they say: how often they call, whether they come to watch her, whether they push for a visit and talk about her role. "Don’t count contact. Count commitment."', src: 'R04-T, FIT-027, SIGNALS-F, MTH-026' },
  { id: 'live-periods', p: 3, when: c => c.grade >= 9 && !c.playing.includes('aau_exposure'),
    title: 'Get her where coaches are actually evaluating',
    text: '"Being at the tournament is not the same thing as being evaluated." Check the current NCAA recruiting calendar against her AAU schedule. In 2026–27, the D1 women’s basketball live windows for AAU are Apr 23–25, May 14–16, Jul 9–12 and Jul 23–26 (verify each year). If AAU exposure isn’t realistic, use the high school strategy: holiday tournaments and schools within about 2 hours.', src: 'R11-T, D1CAL-F, R18-T, RADIUS-T' },
  { id: 'aau-lock', p: 3, when: c => c.grade <= 9 && c.playing.includes('no_aau'),
    title: 'Find the right AAU fit and plan to stay',
    text: 'Coach Tay wants the AAU team locked in around 7th–8th grade, with freshman year "the team." Constant switching makes her "difficult to follow." Choose a coach who cares more about her development and getting evaluated than winning the next game.', src: 'M2.G7, M2.G8, R14-T' },
  { id: 'versatility-guard', p: 4, when: c => c.positions.length === 1 && c.positions[0] === 'wing',
    title: 'Find her "superpower," and a fallback, and become capable at point guard',
    text: '2/3 guards are "the biggest pool," so coaches can be selective and often recruit them later. "What is her superpower?" Then build a fallback for when it isn’t working. Being capable of giving a coach "10 minutes at point guard" makes her more marketable.', src: 'R09-T, R07-T, EVAL-021, EVAL-039' },
  { id: 'versatility-post', p: 4, when: c => c.positions.includes('post') && !c.positions.some(p => p === 'wing' || p === 'pg'),
    title: 'Stay a post, but become capable on the perimeter',
    text: 'Posts are recruited first because "you can’t teach height," but coaches love options. A post who can handle, pass and defend on the perimeter can play against small lineups. "The more ways I can use you, the more reasons I have to recruit you."', src: 'R06-T, EVAL-017, MTH-028' },
  { id: 'pigeonhole-young', p: 4, when: c => c.grade <= 9 && c.positions.length === 1,
    title: 'Don’t lock her into one position yet',
    text: 'Coach Tay recommends working on every part of the game "through at least freshman year." "Position is not the same thing as skill set." "Don’t train for the player she is today. Train for the player she could become."', src: 'R05-T, EVAL-014, EVAL-038' },
  { id: 'academics-low', p: 3, when: c => ['lt2', '2.0', '2.5'].includes(c.gpa),
    title: 'Talk to her school counselor about NCAA core courses now',
    text: 'Her NCAA core-course GPA can differ from her report-card GPA, and not every class counts. Coach Tay: "Don’t wait until senior year to find out she took the wrong classes." NAIA and NJCAA have their own standards. Verify current rules with the governing body and the school.', src: 'R01-T, M3.L2-T, FIT-019, FIT-023' },
  { id: 'academics-strong', p: 5, when: c => ['3.5', '4.0'].includes(c.gpa),
    title: 'Use her academics: ask about the total financial package',
    text: 'Don’t only ask "How much basketball scholarship money can we get?" Ask "What is the total financial package this school could put together?" At D2, D3 and NAIA, academic aid can change what a family actually pays. Grades also break ties between similar players.', src: 'M3.L1-T, FIT-017, EVAL-033' },
  { id: 'film-start', p: 4, when: c => c.grade >= 9,
    title: 'Build full-game film first, then highlights',
    text: '"FULL GAME FILM FIRST. ALWAYS." Coaches need to see how she plays without the ball, defends, communicates and responds to mistakes. Store it in one organized Google Drive folder, labeled with name, graduation year, opponent and date, and test every link.', src: 'R20-T, FILMORG-T, STR-042, STR-043' },
  { id: 'wants-list', p: 5, when: c => c.grade >= 9,
    title: 'Start (or update) her "what I want" list',
    text: 'Before coaches start selling, write down what matters: basketball, coaching, role, school, location, academics, finances, lifestyle. Mark each Must have / Really want / Would be nice. "Decide what you want before someone starts selling you what they have."', src: 'WANTS-T, FIT-033' },
  { id: 'prep-8', p: 2, when: c => c.grade === 8,
    title: 'Prepare, don’t chase exposure',
    text: 'She isn’t being recruited yet, and that’s normal. Focus on the weight room (technique, not maxes), practicing on her own 4–5 times a week, and the habits coaches remember later: hard work, energy, effort, attitude, being a great teammate. Parents: learn the process now.', src: 'M1.L2, M2.G7, M2.G8, MTH-015, THREEMISTAKES-T' },
  { id: 'intangibles', p: 6, when: () => true,
    title: 'Make the things outside the box score her habit',
    text: 'Coach Tay’s top tier: sprinting the floor, communication, taking charges. Bottom tier: talking to refs, blaming teammates. "The box score is information. It is not your entire evaluation." Coaches watch warmups and the bench too.', src: 'R28, EVAL-090, BOXSCORE-T, ALWAYSEVAL-T' },
];

const CHECKLISTS = {
  8: [
    ['Parents: learn the recruiting timeline and how the process works', 'THREEMISTAKES-T M1'],
    ['Choose an AAU team you can stay with', 'M2.G8, R14-T'],
    ['Start supervised weight-room training (technique, not maxes)', 'M2.G8'],
    ['Individual practice 4–5 times a week (team practice doesn’t count)', 'M2.G7'],
    ['Learn about NCAA Eligibility Center accounts (registration around 8th grade or before freshman year)', 'R01'],
  ],
  9: [
    ['Start her "what I want" list and a basic school list', 'WANTS-T, M2.G9'],
    ['Film every high school and AAU game; set up the film folder', 'M2.G9, FILMORG-T'],
    ['Meet the school counselor about NCAA-approved core courses', 'R01-T'],
    ['Create a recruiting information document (no passwords)', 'RECINFO-T'],
    ['Pick 1–2 elite camps for experience, not offers', 'R13-T'],
  ],
  10: [
    ['Check the current NCAA calendar against her AAU schedule (live periods only)', 'M2.G10, R12'],
    ['Narrow the school list; find staff contacts (head coach + assistant)', 'M2.G10, RADIUS-T'],
    ['Start her own outreach emails with schedule and full-game film', 'M2.G10, EMAILTEMPLATE-F'],
    ['Give her HS/AAU coach a school list and a drafted intro email', 'R16-T, R19-T'],
    ['Set up a Coach Contact Tracker spreadsheet', 'TRACKER-T'],
    ['Do a social media audit "like a college coach"', 'SOCIAL-T'],
  ],
  11: [
    ['Sort schools: definite no / maybe / yes', 'M2.G11'],
    ['Ask coaches: "Where does she currently stand in your recruiting class?"', 'R04-T'],
    ['Plan visits with your question list; "go look for normal"', 'VISITS-T, CONVO-F'],
    ['Track offers and visits on a second tab', 'OFFERTRACK-T'],
    ['Keep the Eligibility Center account and transcripts current', 'R01-T, R17-T'],
  ],
  12: [
    ['If she has offers: ask each offer’s timeline and compare against her list', 'WAITING-T, FIT-033'],
    ['If no offers yet: send full-game film widely, and have her coaches reach out too', 'M2.G12'],
    ['Do the four-year cost math for each serious option', 'NARROW-T N16'],
    ['Request NCAA final certification; send final transcript and proof of graduation', 'R01-T S9'],
    ['After committing: learn the new team’s film, plays and teammates', 'M2.G12'],
  ],
};

export function assess(answers, now = new Date()) {
  const { errs, clean: c } = validate(answers);
  if (errs.length) return { ok: false, errors: errs };
  const hctx = heightContext(c.height, c.positions);
  const recs = RULES.filter(r => r.when(c)).sort((a, b) => a.p - b.p).slice(0, 5)
    .map(({ id, title, text, src }) => ({ id, title, text, src }));
  const readiness = [];
  if (c.grade >= 10 && c.interest.includes('none')) readiness.push({ label: 'supported', text: 'No recruiting interest reported yet. For a ' + c.grade + 'th grader, Coach Tay would treat outreach, film and getting evaluated as urgent.', src: 'R04-T TL1, M2.G10–G12' });
  if (c.grade <= 9 && c.interest.includes('none')) readiness.push({ label: 'supported', text: 'No recruiting interest yet is normal at this stage. "Don’t panic if freshman year isn’t full of offers."', src: 'R04-T FR, EVAL-034' });
  if (onlyWeakSignals(c)) readiness.push({ label: 'research', text: 'Mail, follows and camp invitations are a "foot in the door," not proof of interest. Look for coaches calling, watching her play, and talking about a role.', src: 'M2.G8, FIT-028, SIGNALS-F' });
  if (c.grade >= 9 && !c.playing.includes('aau_exposure') && !c.playing.includes('hs_varsity_starter')) readiness.push({ label: 'supported', text: 'Her current playing situation may not be putting her in front of college coaches. That’s an exposure gap, not a judgment of her ability.', src: 'R11-T, EVAL-024' });
  readiness.push({ label: 'unknown', text: 'Her athletic level can’t be determined from a questionnaire. Coach Tay’s method relies on film, repeated in-person viewings, and what coaches actually do.', src: 'EVAL-053, R31, LEVEL-T' });

  return {
    ok: true,
    profile: {
      gradYear: gradYear(c.grade, now), grade: c.grade, height: fmtHeight(c.height),
      positions: c.positions.map(p => POSITIONS[p]), playing: c.playing.map(p => PLAYING[p]),
      gpa: GPA[c.gpa], interest: c.interest.map(i => INTEREST[i]), interestLevels: c.interestLevels,
      zip: c.zip, distance: DISTANCE[c.distance], stage: STAGES[c.grade], readiness,
    },
    heightContext: { groups: hctx, caveat: SIZE_CHART_CAVEAT, src: 'SIZECHART-F, R10-T' },
    pathways: pathways(c, hctx),
    recommendations: recs,
    checklist: CHECKLISTS[c.grade].map(([text, src]) => ({ text, src })),
    disclaimer: 'Initial guidance based on Coach Tay’s documented methodology, not a scouting evaluation. Rules on eligibility, calendars and visits change; verify with the NCAA, NAIA, NJCAA and each school’s compliance office.',
  };
}

export const OPTIONS = { POSITIONS, PLAYING, GPA, INTEREST, DISTANCE, LEVELS, LEVEL_NAMES };
