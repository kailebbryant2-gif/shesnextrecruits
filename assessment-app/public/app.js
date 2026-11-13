// She's Next Recruits: 60-second check (step-by-step UI).
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};
const fmtHeight = i => i >= 80 ? '6\'8"+' : `${Math.floor(i / 12)}'${i % 12}"`;
function gradYear(grade, now = new Date()) {
  const spring = now.getMonth() >= 7 ? now.getFullYear() + 1 : now.getFullYear();
  return spring + (12 - grade);
}

const state = { grade: null, height: 66, positions: [], playing: [], gpa: null, interest: [], interestLevels: [], zip: '', distance: null };

// ---------- Step definitions ----------
const STEPS = [
  { key: 'grade', title: 'What grade is she in <em>right now?</em>', sub: 'This sets her place on the recruiting timeline.', type: 'tiles',
    options: () => [8, 9, 10, 11, 12].map(g => ({ v: g, t: `${g}th`, d: `Class of ${gradYear(g)}` })),
    why: '"Every grade level could be working on everything. It just looks a little bit different." Coach Tay', valid: s => s.grade != null },
  { key: 'height', title: 'How <em>tall</em> is she?', sub: 'Your best estimate is fine.', type: 'height',
    why: 'Height can’t be taught, so it matters. But Coach Tay is clear: "There isn’t a magic height where Division I starts." We use it as context, never a verdict.', valid: () => true },
  { key: 'positions', title: 'Which positions <em>can</em> she play?', sub: 'Select all that apply.', type: 'multi',
    options: () => [
      { v: 'pg', t: 'Point guard', d: 'Runs the offense, handles pressure' },
      { v: 'wing', t: 'Wing / 2–3 guard', d: 'Perimeter scorer, shooter, defender' },
      { v: 'four', t: 'Forward / 4', d: 'In-between size, plays inside and out' },
      { v: 'post', t: 'Post / 5', d: 'Plays with her back to the basket' },
    ], why: '"Coaches LOVE options." A player who’s capable at more than one position gives a coach more reasons to recruit her.', valid: s => s.positions.length > 0 },
  { key: 'playing', title: 'Where does she <em>play</em> right now?', sub: 'Select all that apply.', type: 'multi',
    options: () => [
      { v: 'hs_varsity_starter', t: 'High school varsity, starter' },
      { v: 'hs_varsity_bench', t: 'High school varsity, off the bench' },
      { v: 'hs_jv', t: 'High school JV' },
      { v: 'middle_school', t: 'Middle school team' },
      { v: 'aau_exposure', t: 'AAU, plays exposure / live-period events', d: 'Big events where college coaches attend' },
      { v: 'aau_local', t: 'AAU, plays local events' },
      { v: 'no_aau', t: 'No AAU right now' },
    ], why: '"Being at the tournament is not the same thing as being evaluated." Where she plays tells us whether college coaches can actually see her.', valid: s => s.playing.length > 0 },
  { key: 'gpa', title: 'What’s her approximate <em>GPA?</em>', sub: 'Unweighted or weighted, your best estimate.', type: 'single', cols: 2,
    options: () => [['lt2', 'Below 2.0'], ['2.0', '2.0–2.4'], ['2.5', '2.5–2.9'], ['3.0', '3.0–3.4'], ['3.5', '3.5–3.9'], ['4.0', '4.0+'], ['unsure', 'Not sure']].map(([v, t]) => ({ v, t })),
    why: '"Your daughter is not just being recruited as a basketball player. She’s being recruited as a student-athlete." Grades affect eligibility, cost, and how coaches see her.', valid: s => s.gpa != null },
  { key: 'interest', title: 'What recruiting interest has she <em>received?</em>', sub: 'Select all that apply.', type: 'interest',
    options: () => [
      { v: 'none', t: 'None yet', d: 'Totally normal for younger players' },
      { v: 'mail', t: 'Mail, questionnaires or follows', d: 'A "foot in the door"' },
      { v: 'camp_invite', t: 'Camp invitations' },
      { v: 'contacted', t: 'A college coach contacted her or her coaches' },
      { v: 'watched', t: 'A college coach watched her play' },
      { v: 'visit', t: 'An unofficial visit' },
      { v: 'offer', t: 'An offer', d: '"We are offering you a scholarship."' },
    ], why: '"What level is actively showing us that they value her?" Coach Tay’s best evidence of level is what coaches actually do. "Interest is interest. An offer is an offer."', valid: s => s.interest.length > 0 },
  { key: 'location', title: 'Where would she like to <em>go to school?</em>', sub: 'Your home ZIP code helps us find colleges near you.', type: 'location',
    options: () => [
      { v: 'near', t: 'Within about 2 hours', d: 'Coach Tay’s "sweet spot" for being seen' },
      { v: 'day', t: 'Within a day’s drive' },
      { v: 'any', t: 'Open to anywhere' },
    ], why: 'Distance matters for her happiness and for being seen. Coaches nearby can watch her play much more easily.', valid: s => /^\d{5}$/.test(s.zip) && s.distance != null },
];

let step = 0;

function optButton({ v, t, d }, pressed, multi, tile) {
  return `<button type="button" class="opt${tile ? ' tile' : ''}" data-v="${esc(v)}" aria-pressed="${pressed}"${multi ? ' data-multi' : ''}>
    <span class="t">${esc(t)}</span>${d ? `<span class="d">${esc(d)}</span>` : ''}</button>`;
}

function renderStep(dir = 1) {
  const s = STEPS[step];
  const stage = $('#stage');
  let body = '';
  if (s.type === 'tiles') {
    body = `<div class="options cols-5">${s.options().map(o => optButton(o, state.grade === o.v, false, true)).join('')}</div>`;
  } else if (s.type === 'height') {
    body = `<div class="height"><div class="height-read" id="hRead">${fmtHeight(state.height)}</div>
      <div class="height-row"><button class="round" type="button" id="hMinus" aria-label="Shorter">−</button>
      <input type="range" id="hRange" min="58" max="80" step="1" value="${state.height}" aria-label="Height" aria-valuetext="${fmtHeight(state.height)}">
      <button class="round" type="button" id="hPlus" aria-label="Taller">+</button></div></div>`;
  } else if (s.type === 'single') {
    body = `<div class="options ${s.cols === 2 ? 'cols-2' : ''}">${s.options().map(o => optButton(o, state[s.key] === o.v, false)).join('')}</div>`;
  } else if (s.type === 'multi') {
    body = `<div class="options">${s.options().map(o => optButton(o, state[s.key].includes(o.v), true)).join('')}</div>`;
  } else if (s.type === 'interest') {
    body = `<div class="options">${s.options().map(o => optButton(o, state.interest.includes(o.v), true)).join('')}</div><div id="levelsSlot"></div>`;
  } else if (s.type === 'location') {
    body = `<input class="zip-in" id="zipIn" inputmode="numeric" autocomplete="postal-code" maxlength="5" placeholder="ZIP code" value="${esc(state.zip)}" aria-label="Home ZIP code">
      <div class="options">${s.options().map(o => optButton(o, state.distance === o.v, false)).join('')}</div>`;
  }
  stage.innerHTML = `<div class="step ${dir < 0 ? 'out-back' : ''}">
    <p class="eyebrow">Question ${step + 1} of ${STEPS.length}</p>
    <h2>${s.title}</h2><p class="sub">${s.sub}</p>${body}
    <details class="why"><summary>Why Coach Tay asks</summary><p>${esc(s.why)}</p></details></div>`;
  wireStep(s);
  updateChrome();
  window.scrollTo(0, 0);
  // Move focus for keyboard/screen-reader users without popping the phone keyboard on the ZIP field.
  const first = $('.opt, #hRange', stage);
  if (first && dir !== 0) first.focus({ preventScroll: true });
}

function wireStep(s) {
  if (s.type === 'height') {
    const r = $('#hRange'), set = v => { state.height = Math.max(58, Math.min(80, v)); r.value = state.height; $('#hRead').textContent = fmtHeight(state.height); r.setAttribute('aria-valuetext', fmtHeight(state.height)); };
    r.addEventListener('input', () => set(Number(r.value)));
    $('#hMinus').addEventListener('click', () => set(state.height - 1));
    $('#hPlus').addEventListener('click', () => set(state.height + 1));
  }
  if (s.type === 'location') {
    $('#zipIn').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 5); state.zip = e.target.value; updateChrome(); });
  }
  if (s.type === 'interest') renderLevels();
  $$('.opt', $('#stage')).forEach(b => b.addEventListener('click', () => choose(s, b)));
}

function choose(s, b) {
  const raw = b.dataset.v;
  const v = s.key === 'grade' ? Number(raw) : raw;
  if (s.type === 'tiles' || s.type === 'single' || s.type === 'location') {
    const key = s.type === 'location' ? 'distance' : s.key;
    state[key] = v;
    $$('.opt', $('#stage')).forEach(x => x.setAttribute('aria-pressed', String(x.dataset.v === raw)));
    updateChrome();
    if (s.type !== 'location') setTimeout(() => { if (STEPS[step] === s) next(); }, 280); // auto-advance single choices
    return;
  }
  const key = s.type === 'interest' ? 'interest' : s.key;
  let arr = state[key];
  if (key === 'interest') {
    if (v === 'none') arr = arr.includes('none') ? [] : ['none'];
    else arr = arr.includes(v) ? arr.filter(x => x !== v) : [...arr.filter(x => x !== 'none'), v];
    if (arr.includes('none') || !arr.length) state.interestLevels = [];
  } else arr = arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];
  state[key] = arr;
  $$('.opt', $('#stage')).forEach(x => x.setAttribute('aria-pressed', String(arr.includes(x.dataset.v))));
  if (key === 'interest') renderLevels();
  updateChrome();
}

function renderLevels() {
  const slot = $('#levelsSlot');
  if (!slot) return;
  const show = state.interest.length && !state.interest.includes('none');
  slot.innerHTML = show ? `<div class="levels"><p>From which levels? <span style="font-weight:500;color:var(--muted)">Optional</span></p><div class="chips">
    ${['D1', 'D2', 'D3', 'NAIA', 'JUCO'].map(l => `<button type="button" class="chip" data-l="${l}" aria-pressed="${state.interestLevels.includes(l)}">${l}</button>`).join('')}</div></div>` : '';
  $$('.chip', slot).forEach(c => c.addEventListener('click', () => {
    const l = c.dataset.l;
    state.interestLevels = state.interestLevels.includes(l) ? state.interestLevels.filter(x => x !== l) : [...state.interestLevels, l];
    c.setAttribute('aria-pressed', String(state.interestLevels.includes(l)));
  }));
}

function updateChrome() {
  const s = STEPS[step];
  const pct = ((step + (s.valid(state) ? 1 : 0.4)) / STEPS.length) * 100;
  $('#progressBar').style.width = pct + '%';
  $('#progress').setAttribute('aria-valuenow', String(step + 1));
  $('#stepCount').textContent = `${step + 1} / ${STEPS.length}`;
  $('#backBtn').disabled = false;
  const nb = $('#nextBtn');
  nb.disabled = !s.valid(state);
  nb.innerHTML = step === STEPS.length - 1 ? 'See her recruiting profile <span aria-hidden="true">→</span>' : 'Continue <span aria-hidden="true">→</span>';
  $('#stepError').hidden = true;
}

function show(id) { $$('.screen').forEach(el => { el.hidden = el.id !== id; }); window.scrollTo(0, 0); }

function next() {
  const s = STEPS[step];
  if (!s.valid(state)) {
    const e = $('#stepError'); e.textContent = s.type === 'location' ? 'Enter a 5-digit ZIP code and choose a distance.' : 'Choose an answer to continue.'; e.hidden = false; return;
  }
  if (step < STEPS.length - 1) { step++; renderStep(1); } else submit();
}
function back() { if (step === 0) { show('intro'); return; } step--; renderStep(-1); }

// ---------- Submit + loading ----------
async function submit() {
  show('loading');
  const items = $$('#loadSteps li'); items.forEach(li => li.classList.remove('done'));
  const tick = (async () => { for (const li of items) { await sleep(420); li.classList.add('done'); } })();
  let data;
  try {
    const res = await fetch('/api/assess', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state) });
    data = await res.json();
    if (res.status === 429) throw new Error(data.error);
    if (!data.ok) throw new Error('Please check your answers and try again.');
  } catch (e) {
    await tick; show('quiz'); renderStep(0);
    const err = $('#stepError'); err.textContent = e.message || 'Something went wrong. Please try again.'; err.hidden = false; return;
  }
  await tick;
  renderResults(data);
  show('results');
}

// ---------- Results ----------
const LEVEL_LABEL = { D1: 'NCAA Division I', D2: 'NCAA Division II', D3: 'NCAA Division III', NAIA: 'NAIA', JUCO: 'Junior college' };
const STAGE_SHORT = { 8: ['Preparation', 'year'], 9: ['The list', 'begins'], 10: ['Prime', 'time'], 11: ['Go', 'time'], 12: ['Commitment', 'year'] };
const TL = [[8, 'Prepare'], [9, 'Chatter'], [10, 'Prime time'], [11, 'Go time'], [12, 'Commit']];
const BADGE = { supported: 'Supported', research: 'Worth researching', unknown: 'Can’t tell yet' };
const badge = l => `<span class="badge ${l}">${BADGE[l]}</span>`;
const src = s => s ? `<span class="src">Source: ${esc(s)}</span>` : '';
const money = n => n == null ? '—' : '$' + Math.round(n).toLocaleString();

function strongestSignal(p) {
  const order = ['Offer', 'Unofficial visit', 'A college coach has watched her play', 'A college coach has contacted her or her coaches', 'Camp invitations', 'Mail / questionnaires / follows', 'None yet'];
  const short = { 'Offer': 'Offer', 'Unofficial visit': 'Visit', 'A college coach has watched her play': 'Coach watched', 'A college coach has contacted her or her coaches': 'Coach contact', 'Camp invitations': 'Camp invites', 'Mail / questionnaires / follows': 'Mail / follows', 'None yet': 'None yet' };
  const top = order.find(o => p.interest.includes(o)) || 'None yet';
  return short[top];
}

function renderResults(d) {
  const p = d.profile;
  const [a, b] = STAGE_SHORT[p.grade];
  const sections = [['overview', 'Overview'], ['pathways', 'Pathways'], ['schools', 'Schools'], ['plan', 'Game plan'], ['steps', 'Next steps']];
  $('#results').innerHTML = `
  <header class="r-hero"><div class="r-hero-in">
    <p class="eyebrow">Her recruiting profile · Class of ${p.gradYear}</p>
    <h1>${esc(a)} <em>${esc(b)}.</em></h1>
    <div class="stats">
      <div class="stat"><b>${esc(p.height)}</b><span>Height</span></div>
      <div class="stat"><b>${p.positions.length}</b><span>Position${p.positions.length > 1 ? 's' : ''}</span></div>
      <div class="stat"><b>${esc(p.gpa)}</b><span>GPA</span></div>
      <div class="stat"><b>${esc(strongestSignal(p))}</b><span>Top signal</span></div>
    </div>
    <div class="timeline" aria-label="Recruiting timeline"><div class="tl-track">
      ${TL.map(([g, l]) => `<div class="tl-step ${g < p.grade ? 'past' : g === p.grade ? 'now' : ''}"><i>${g}</i>${esc(l)}</div>`).join('')}
    </div></div>
    <div class="stage-note"><strong>${esc(p.stage.name)}</strong>${esc(p.stage.text)}${src(p.stage.src)}</div>
  </div></header>

  <nav class="tabs" aria-label="Results sections"><div class="tabs-in">
    ${sections.map(([id, l], i) => `<button type="button" class="tab${i ? '' : ' on'}" data-go="${id}">${l}</button>`).join('')}
  </div></nav>

  <div class="r-body">
    <section class="r-sec" id="overview">
      <p class="eyebrow">Overview</p><h2>What we <em>can</em> and can't tell</h2>
      <p class="intro-p">${esc(p.positions.join(' · '))} · ${esc(p.playing.join(' · '))}</p>
      <div class="card"><ul class="read-list">${p.readiness.map(r => `<li>${badge(r.label)}<span>${esc(r.text)}</span>${src(r.src)}</li>`).join('')}</ul></div>
    </section>

    <section class="r-sec" id="pathways">
      <p class="eyebrow">Section 2</p><h2>Potential <em>pathways</em></h2>
      <p class="intro-p">Every level is real college basketball. "The goal is not the division. The goal is the right opportunity." Tap a level to see what we know and what we don't.</p>
      <div class="levels-grid">${d.pathways.map((l, i) => levelCard(l, i)).join('')}</div>
      <div class="card" style="margin-top:14px"><p class="eyebrow">Height in context</p><h3 style="font-size:22px">Coach Tay's size chart</h3>
        ${heightChart(d.heightContext, p.height)}
        <p class="caveat">${esc(d.heightContext.caveat)}</p>${src(d.heightContext.src)}</div>
    </section>

    <section class="r-sec" id="schools">
      <p class="eyebrow">Section 3</p><h2>Schools worth <em>researching</em></h2>
      ${schoolsHtml(d)}
    </section>

    <section class="r-sec" id="plan">
      <p class="eyebrow">Section 4</p><h2>Coach Tay's <em>game plan</em></h2>
      <p class="intro-p">Chosen for her grade and her answers.</p>
      ${d.recommendations.map((r, i) => `<div class="card rec"><div class="num">${i + 1}</div><div><h3>${esc(r.title)}</h3><p>${esc(r.text)}</p>${src(r.src)}</div></div>`).join('')}
    </section>

    <section class="r-sec" id="steps">
      <p class="eyebrow">Section 5</p><h2>Next <em>steps</em></h2>
      <div class="card">
        <div class="check-head"><div class="ring" id="ring"><b id="ringTxt">0%</b></div><div><strong>${p.grade}th-grade checklist</strong><br><span style="color:var(--muted);font-size:14px">Your progress saves in this browser.</span></div></div>
        <ul class="checks">${d.checklist.map((c, i) => `<li><label><input type="checkbox" data-i="${i}"><span>${esc(c.text)}${src(c.src)}</span></label></li>`).join('')}</ul>
      </div>
      <div class="closing">
        <p class="eyebrow" style="color:#f2a99f">Want Coach Tay's eyes on her recruiting?</p>
        <h2>Take the next step toward her <em style="color:#f2a99f">college basketball future.</em></h2>
        <p>Join Coach Tay's free live training for parents.</p>
        <a class="cta" href="https://shesnextrecruits.com/" target="_blank" rel="noopener">Save my free spot <span aria-hidden="true">→</span></a>
      </div>
      <p class="disclaimer">${esc(d.disclaimer)}</p>
      <div class="actions"><button class="ghost" type="button" id="restart">Start over</button><button class="ghost" type="button" id="print">Save as PDF</button></div>
    </section>
  </div>`;
  wireResults(d);
}

function levelCard(l, i) {
  const first = l.status === 'explore_first';
  return `<div class="lvl${first ? ' first open' : ''}" data-l="${l.level}">
    <button type="button" aria-expanded="${first}"><span><span class="badge ${first ? 'first' : 'research'}">${first ? 'Explore first' : 'Worth exploring'}</span><br><span class="name">${esc(l.name)}</span></span><span class="chev" aria-hidden="true">⌄</span></button>
    <div class="lvl-body">
      ${l.why.map(w => `<p>${esc(w.text)}${src(w.src)}</p>`).join('')}
      <h4>Height</h4><p>${esc(l.height.text)}${src(l.height.src)}</p>
      <h4>Academics &amp; money</h4><p>${esc(l.academics.text)}${src(l.academics.src)}</p>
      <h4>What we can't tell yet</h4><ul>${l.unknown.map(u => `<li>${esc(u)}</li>`).join('')}</ul>
      <h4>How you'll find out</h4><ul>${l.findOut.map(u => `<li>${esc(u)}</li>`).join('')}</ul>
    </div></div>`;
}

function heightChart(hc, herLabel) {
  const MIN = 58, MAX = 82, pos = i => ((i - MIN) / (MAX - MIN)) * 100;
  const toIn = s => { const m = /(\d)'(\d+)"/.exec(s); return m ? Number(m[1]) * 12 + Number(m[2]) : null; };
  const her = toIn(herLabel) ?? 80;
  return hc.groups.map(g => `<p style="margin:14px 0 2px;font-weight:700">${esc(g.group)}</p><div class="hchart">
    ${g.rows.map((r, i) => { const [lo, hiRaw] = r.range.split('–'); const a = toIn(lo), b = toIn(hiRaw), plus = /\+$/.test(hiRaw);
      return `<div class="hrow"><span>${esc(r.level)}</span><div class="htrack" title="${esc(r.range)}">
        <div class="hband${plus ? ' plus' : ''}" style="left:${pos(a)}%;width:${pos(plus ? MAX : b) - pos(a)}%"></div>
        <div class="hmark" style="left:${pos(Math.min(her, MAX))}%" ${i === 0 ? `data-l="Her: ${esc(herLabel)}"` : ''}></div></div></div>`; }).join('')}
    </div><div class="hscale"><span>4'10"</span><span>5'6"</span><span>6'2"</span><span>6'10"</span></div>`).join('');
}

function schoolsHtml(d) {
  const s = d.schools;
  if (s.unknownZip) return '<p class="notice"><strong>We couldn’t place that ZIP code.</strong> Some ZIP codes are only for PO boxes. Start over and try your home ZIP code to see schools near you.</p>';
  const all = [...s.fourYear, ...s.twoYear];
  const errs = (s.errors || []).map(e => `<p class="notice">${esc(e)}</p>`).join('');
  if (!all.length) return errs || '<p class="intro-p">No colleges found in that range. Try a wider distance.</p>';
  const levels = [...new Set(all.map(c => c.level || 'JUCO'))];
  const radius = s.radiusMiles ? `within about ${s.radiusMiles} miles of ${esc(d.profile.zip)}` : 'near you';
  return `<p class="intro-p">Colleges ${radius}, closest first, across several levels. ${s.anywhere ? 'She’s open to anywhere, so we start close to home, where coaches can see her play most easily.' : ''}</p>
    <p class="notice"><strong>These match your preferences, not her athletic fit.</strong> Nothing here means a program needs her or that her level fits. That takes film, coach interest and research.</p>${errs}
    <div class="filters" role="group" aria-label="Filter by level"><button type="button" class="chip" data-f="all" aria-pressed="true">All (${all.length})</button>
      ${['D1', 'D2', 'D3', 'NAIA', 'JUCO'].filter(l => levels.includes(l)).map(l => `<button type="button" class="chip" data-f="${l}" aria-pressed="false">${l}</button>`).join('')}</div>
    <div id="schoolList">${all.map(c => schoolCard(c, d.pathways)).join('')}</div>
    <p class="src">College data: Quad Data API (athletics from federal IPEDS data) and U.S. Department of Education College Scorecard. Distances are approximate.</p>`;
}

function schoolCard(c, pathways) {
  const lvl = c.level || 'JUCO';
  const path = pathways.find(p => p.level === c.level);
  const first = path && path.status === 'explore_first';
  const url = u => esc(/^https?:\/\//.test(u) ? u : 'https://' + u);
  const site = c.website || c.url;
  const ar = c.acceptanceRate == null ? '—' : Math.round(c.acceptanceRate * (c.acceptanceRate <= 1 ? 100 : 1)) + '%';
  return `<article class="card school" data-level="${lvl}">
    <div class="school-top"><div><h3>${esc(c.name)}</h3><p class="loc">${esc(c.city)}, ${esc(c.state)}${c.conference ? ' · ' + esc(c.conference) : ''}</p></div>
      <span class="lvl-tag${c.level ? '' : ' na'}">${c.level ? esc(c.level) : '2-yr'}</span></div>
    ${first ? '<span class="badge first">Explore first</span>' : ''}
    ${c.level ? `<p style="margin:8px 0 0;font-size:14px;color:var(--ink-2)">${esc(LEVEL_LABEL[c.level])} school-wide athletic membership. ${c.basketballListed ? 'Basketball is listed, but men’s and women’s aren’t specified.' : 'Basketball isn’t listed in federal data.'}</p>`
      : '<p style="margin:8px 0 0;font-size:14px;color:var(--ink-2)">A possible junior-college option. Athletics aren’t verified: our data doesn’t cover NJCAA programs.</p>'}
    <div class="facts">
      <div class="fact"><b>${money(c.avgNetPrice)}</b><span>Avg. net price / yr</span></div>
      <div class="fact"><b>${ar}</b><span>Acceptance rate</span></div>
    </div>
    <details><summary>What's not verified &amp; your to-dos</summary>
      <p><strong>Not yet verified:</strong> ${c.level ? 'whether there’s a women’s basketball program; ' : ''}roster need at her position for her class; whether her level fits; coach interest.</p>
      <p><strong>Your to-dos:</strong> watch one full game; check the roster for players graduating at her position in her class year; find the head coach and an assistant’s email. Ask about the "total financial package," not just basketball money.</p>
      <p>${site ? `<a href="${url(site)}" target="_blank" rel="noopener">School website</a>` : ''}${c.priceCalculator ? ` · <a href="${url(c.priceCalculator)}" target="_blank" rel="noopener">Net price calculator</a>` : ''}</p>
    </details></article>`;
}

function wireResults(d) {
  // Tabs: jump + scroll-spy
  $$('.tab').forEach(t => t.addEventListener('click', () => $('#' + t.dataset.go).scrollIntoView({ behavior: 'smooth' })));
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) $$('.tab').forEach(t => t.classList.toggle('on', t.dataset.go === e.target.id));
  }), { rootMargin: '-40% 0px -55% 0px' });
  $$('.r-sec').forEach(s => io.observe(s));
  // Level accordions
  $$('.lvl > button').forEach(b => b.addEventListener('click', () => {
    const card = b.parentElement; const open = !card.classList.contains('open');
    card.classList.toggle('open', open); b.setAttribute('aria-expanded', String(open));
  }));
  // School filters
  $$('.filters .chip').forEach(c => c.addEventListener('click', () => {
    const f = c.dataset.f;
    $$('.filters .chip').forEach(x => x.setAttribute('aria-pressed', String(x === c)));
    $$('#schoolList .school').forEach(s => { s.hidden = f !== 'all' && s.dataset.level !== f; });
  }));
  // Checklist with saved progress
  const key = `snr-check-${d.profile.grade}`;
  const saved = store.get(key) || [];
  const boxes = $$('.checks input');
  const paint = () => {
    const done = boxes.filter(b => b.checked).length, pct = Math.round((done / boxes.length) * 100);
    $('#ring').style.setProperty('--p', pct); $('#ringTxt').textContent = pct + '%';
  };
  boxes.forEach(b => { b.checked = saved.includes(Number(b.dataset.i)); b.addEventListener('change', () => { store.set(key, boxes.filter(x => x.checked).map(x => Number(x.dataset.i))); paint(); }); });
  paint();
  $('#restart').addEventListener('click', () => { step = 0; show('intro'); });
  $('#print').addEventListener('click', () => window.print());
}

// ---------- Init ----------
$('#startBtn').addEventListener('click', () => { step = 0; show('quiz'); renderStep(1); });
$('#nextBtn').addEventListener('click', next);
$('#backBtn').addEventListener('click', back);
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !$('#quiz').hidden && !e.target.closest('.opt, .chip, summary, button')) { e.preventDefault(); next(); }
});
