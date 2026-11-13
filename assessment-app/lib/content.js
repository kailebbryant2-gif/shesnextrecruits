// Methodology content used by the engine. Every item carries `src`: the knowledge-base entry IDs
// it comes from (see ../../coach-tay-knowledge-base). User-facing text is neutral and short.
// Do not add guidance here without a source.

export const LEVELS = ['D1', 'D2', 'D3', 'NAIA', 'JUCO'];
export const LEVEL_NAMES = {
  D1: 'NCAA Division I', D2: 'NCAA Division II', D3: 'NCAA Division III', NAIA: 'NAIA', JUCO: 'Junior college',
};

// Typical size ranges by level and position (SIZECHART-F / EVAL-052). Inches; posts are open-ended ("+").
// These are rough ranges with heavy overlap: context only, never a cutoff (R10-T).
export const SIZE_CHART = {
  D1:   { guard: [66, 72], four: [70, 75], post: [74, 79] },
  D2:   { guard: [65, 71], four: [69, 74], post: [72, 78] },
  D3:   { guard: [64, 70], four: [68, 73], post: [71, 77] },
  NAIA: { guard: [64, 71], four: [68, 74], post: [72, 78] },
  JUCO: { guard: [63, 70], four: [67, 73], post: [70, 77] },
};
export const SIZE_CHART_CAVEAT =
  'Typical size ranges overlap a lot between levels, and there’s no height that guarantees or rules out a level. Use this as context only.';

export const STAGES = {
  8:  { short: 'Prep year', headline: 'Not being recruited yet. This is the year to build habits, strength and an AAU home.', src: 'M1.L2, M2.G8, TL-002' },
  9:  { short: 'List begins', headline: 'Early interest may start. Build her college list and start filming games.', src: 'M2.G9, R04-T, EVAL-034' },
  10: { short: 'Prime time', headline: 'Coaches are deciding who’s good enough. Get seen at live events and start outreach.', src: 'M2.G10, R04, TL-006' },
  11: { short: 'Go time', headline: 'Real offers should be coming. Narrow the list, visit with purpose.', src: 'M2.G11, R04-T' },
  12: { short: 'Decision year', headline: 'Commit, or push hard now with film and outreach to every level.', src: 'M2.G12, FIT-036' },
};

export const MONEY = {
  D1:   { tag: 'Athletic aid', text: 'Mostly basketball money. Strong grades still break ties between similar players.', src: 'M3.L1-T, FIT-001' },
  D2:   { tag: 'Athletic + academic', text: 'Partial scholarships that can stack with academic aid for a stronger package.', src: 'M3.L1-T, FIT-002' },
  D3:   { tag: 'Merit & need aid', text: 'No athletic scholarships, but grades can lower the cost a lot through merit aid.', src: 'M3.L1-T, FIT-004' },
  NAIA: { tag: 'Athletic + academic', text: 'Its own eligibility process (PlayNAIA). Academic aid is often part of the package.', src: 'M3.L2-T, FIT-021' },
  JUCO: { tag: 'Low cost · transfer path', text: 'Two years to develop and play, then transfer to a four-year school.', src: 'M3.L2-T, FIT-020' },
};

export const UNKNOWNS = [
  'Whether her game translates to this level. That takes film and coaches seeing her in person.',
  'Whether programs here need her position in her graduation year.',
];
export const FIND_OUT = [
  'Send full-game film and see who responds and follows up.',
  'Notice which coaches come to watch her more than once.',
  'Ask an experienced evaluator: "What level does her game translate to right now?"',
];
