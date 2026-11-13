// Coach Tay methodology content used by the engine.
// Every item carries `src`: the knowledge-base entry IDs / source files it comes from
// (see /home/user/coach-tay-knowledge-base). Do not add guidance here without a source.

export const LEVELS = ['D1', 'D2', 'D3', 'NAIA', 'JUCO'];
export const LEVEL_NAMES = {
  D1: 'NCAA Division I', D2: 'NCAA Division II', D3: 'NCAA Division III', NAIA: 'NAIA', JUCO: 'Junior college (NJCAA)'
};

// Coach Tay's size chart (SIZECHART-F / EVAL-052). Inches. Upper bound for posts is "+".
// Her own framing: "rough estimates… HOW MUCH THEY OVERLAP… no magic height" (R10-T).
export const SIZE_CHART = {
  D1:   { guard: [66, 72], four: [70, 75], post: [74, 79] },
  D2:   { guard: [65, 71], four: [69, 74], post: [72, 78] },
  D3:   { guard: [64, 70], four: [68, 73], post: [71, 77] },
  NAIA: { guard: [64, 71], four: [68, 74], post: [72, 78] },
  JUCO: { guard: [63, 70], four: [67, 73], post: [70, 77] },
};
export const SIZE_CHART_CAVEAT =
  'Coach Tay’s chart shows rough estimates of typical size ranges, and they overlap a lot. "There isn’t a magic height where Division I starts." Height is context, never a verdict.';

export const STAGES = {
  8:  { name: '8th grade: preparing to be recruited', text: 'Coach Tay is clear that 8th graders are not being recruited yet. This is the year to prepare: get into a weight room for technique, lock in an AAU team, practice on her own 4–5 times a week, and have parents learn the process. "8th grade is like your last year to really relax."', src: 'M1.L2, M2.G8, TL-002' },
  9:  { name: '9th grade: chatter starts, the list begins', text: 'Some interest and "chatter" may start, but freshman year is mostly evaluation and projection. Start her school list, start filming every game, raise workout intensity, and use elite camps for experience. "Freshman year, you need to learn and understand absolutely everything."', src: 'M2.G9, R04-T, EVAL-034' },
  10: { name: '10th grade: "prime time"', text: 'Coach Tay calls sophomore year prime time. Coaches are deciding who is good enough. Go to live events only, start doing her own outreach, narrow the list, and consider unofficial visits. The summer between sophomore and junior year is "the biggest summer."', src: 'M2.G10, R04, TL-006' },
  11: { name: '11th grade: "go time"', text: 'Junior year is go time. Real offers should be coming. Sort schools into yes, no and maybe, take visits with purpose, and train like a college athlete. "Nothing just because."', src: 'M2.G11, R04-T, MTH-012' },
  12: { name: '12th grade: commitment and preparation', text: 'Coach Tay recommends committing around the summer before senior year, or by fall at the latest. If there are no offers yet, everything has to be done the right way: "flood with film, flood with stats," and a lot of outreach, with her coaches’ help.', src: 'M2.G12, FIT-036' },
};

export const LEVEL_ACADEMIC_NOTES = {
  D1: 'At D1, money is mostly basketball money. Since 2025, schools that opt into the House-settlement model use roster limits. Academics still act as a tiebreaker between similar players. (Rules change: verify current details.)',
  D2: 'D2 uses partial scholarships. Coaches can combine basketball money with academic aid: "Basketball money + academic money = a much stronger financial package."',
  D3: 'D3 has no athletic scholarships, but merit-based and need-based aid mean "your daughter’s academic profile can play a major role in what the family ultimately pays."',
  NAIA: 'NAIA has its own eligibility center (PlayNAIA). Academic aid can be an important part of the package. "There are excellent NAIA schools."',
  JUCO: 'Junior college can be a development and transfer path: "Junior college does not mean your basketball career is over." The NJCAA has three divisions with different aid structures.',
};
export const LEVEL_ACADEMIC_SRC = { D1: 'M3.L1-T, FIT-001', D2: 'M3.L1-T, FIT-002', D3: 'M3.L1-T, FIT-004', NAIA: 'M3.L2-T, FIT-021', JUCO: 'M3.L2-T, FIT-020' };

export const UNKNOWNS_ALWAYS = [
  'Whether her game translates to this level. Coach Tay says that takes film and in-person viewings by coaches (usually more than one).',
  'Whether programs at this level have a roster need at her position in her graduation year.',
];
export const HOW_TO_FIND_OUT = [
  'Send full-game film and see whether coaches at this level respond and follow up.',
  'Watch whether coaches come to watch her more than once, especially during live periods.',
  'Get an honest outside opinion: "What level does her game currently translate to?" and "What is keeping her from the next level?"',
];
