// She's Next College Finder AI: client
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const store = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};
const fmtH = i => (i == null ? null : i >= 80 ? '6\'8"+' : `${Math.floor(i / 12)}'${i % 12}"`);
const money = n => (n == null ? '—' : n >= 1000 ? '$' + (n / 1000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, '') + 'K' : '$' + n);
const pct = v => (v == null ? '—' : Math.round(v * 100) + '%');
const num = n => (n == null ? '—' : n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K' : String(n));

const OPTS = {
  grade: [[8, '8'], [9, '9'], [10, '10'], [11, '11'], [12, '12']],
  positions: [['pg', 'Point guard'], ['wing', 'Wing'], ['four', 'Forward'], ['post', 'Post']],
  radius: [[25, '25 mi'], [50, '50 mi'], [100, '100 mi'], [200, '200 mi'], [300, '300 mi'], [500, '500 mi']],
  role: [['go_to', 'Go-to player'], ['starter', 'Starter'], ['rotation', 'Rotation'], ['limited', 'Limited minutes']],
  evalLevels: [['D1', 'D1'], ['D2', 'D2'], ['D3', 'D3'], ['NAIA', 'NAIA'], ['JUCO', 'JUCO'], ['none', 'No one yet']],
  interest: [['none', 'None yet'], ['mail', 'Mail / follows'], ['camp_invite', 'Camp invites'], ['contacted', 'Coach contact'], ['watched', 'Coach watched'], ['visit', 'Campus visit'], ['offer', 'Offer']],
  interestLevels: [['D1', 'D1'], ['D2', 'D2'], ['D3', 'D3'], ['NAIA', 'NAIA'], ['JUCO', 'JUCO']],
  gpa: [['lt2', '<2.0'], ['2.0', '2.0–2.4'], ['2.5', '2.5–2.9'], ['3.0', '3.0–3.4'], ['3.5', '3.5–3.9'], ['4.0', '4.0+']],
  playing: [['hs_varsity', 'HS varsity'], ['hs_jv', 'HS JV'], ['middle_school', 'Middle school'], ['aau_exposure', 'AAU · exposure events'], ['aau_local', 'AAU · local']],
};
const EXCLUSIVE = { interest: 'none', evalLevels: 'none' };
const DEFAULTS = { grade: null, positions: [], zip: '', radius: 100, height: null, role: null, evalLevels: [], interest: [], interestLevels: [], gpa: null, playing: [] };
const state = { ...DEFAULTS, ...store.get('snr-profile', {}) };
const ui = { view: 'cards', sort: 'match', filter: 'all', q: '', shown: 10, saved: new Set(store.get('snr-saved', [])) };
let assessData = null, schoolsData = null, lastRunKey = '';

// ---------- Profile controls ----------
function renderControls() {
  $$('[data-key]').forEach(box => {
    const key = box.dataset.key, single = box.hasAttribute('data-single');
    box.innerHTML = OPTS[key].map(([v, t]) => {
      const on = single ? state[key] === v : state[key].includes(v);
      return `<button type="button" class="${box.classList.contains('seg') ? '' : 'chip'}" data-v="${esc(v)}" aria-pressed="${on}">${esc(t)}</button>`;
    }).join('');
    $$('button', box).forEach(b => b.addEventListener('click', () => {
      const raw = b.dataset.v, v = typeof OPTS[key][0][0] === 'number' ? Number(raw) : raw;
      if (single) state[key] = state[key] === v && !['grade', 'radius'].includes(key) ? null : v;
      else if (EXCLUSIVE[key]) {
        const x = EXCLUSIVE[key];
        if (v === x) state[key] = state[key].includes(x) ? [] : [x];
        else state[key] = state[key].includes(v) ? state[key].filter(y => y !== v) : [...state[key].filter(y => y !== x), v];
        if (key === 'interest' && (!state.interest.length || state.interest.includes('none'))) state.interestLevels = [];
      } else state[key] = state[key].includes(v) ? state[key].filter(x => x !== v) : [...state[key], v];
      changed();
    }));
  });
  $('#zip').value = state.zip;
  $('#hOut').textContent = fmtH(state.height) || 'Add';
  $('#hClear').hidden = state.height == null;
  $('#levelsWrap').hidden = !state.interest.length || state.interest.includes('none');
  updateGo();
}
function changed() { store.set('snr-profile', state); renderControls(); }

$('#zip').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 5); state.zip = e.target.value; store.set('snr-profile', state); updateGo(); });
$('#hMinus').addEventListener('click', () => { state.height = Math.max(58, (state.height ?? 69) - 1); changed(); });
$('#hPlus').addEventListener('click', () => { state.height = Math.min(80, (state.height ?? 67) + 1); changed(); });
$('#hClear').addEventListener('click', () => { state.height = null; changed(); });

const ready = () => state.grade != null && state.positions.length > 0 && /^\d{5}$/.test(state.zip);
const runKey = () => JSON.stringify(state);

function updateGo() {
  const btn = $('#go'), hint = $('#goHint');
  const missing = [state.grade == null && 'grade', !state.positions.length && 'position', !/^\d{5}$/.test(state.zip) && 'ZIP'].filter(Boolean);
  btn.disabled = !ready();
  const stale = assessData && runKey() !== lastRunKey;
  btn.classList.toggle('stale', Boolean(stale));
  btn.innerHTML = stale ? 'Update results <span aria-hidden="true">↻</span>' : 'Find her colleges <span aria-hidden="true">✦</span>';
  const skillCount = [state.height != null, state.role, state.evalLevels.length, state.interest.length].filter(Boolean).length;
  hint.textContent = missing.length ? `Add ${missing.join(', ')} to start`
    : skillCount < 2 ? 'Tip: answer the skill questions for a sharper match' : 'Ready when you are';
  const bar = $('#staleBar'); if (bar) bar.hidden = !stale;
}

// ---------- Run ----------
$('#go').addEventListener('click', find);
async function find() {
  if (!ready()) return;
  const key = runKey();
  const btn = $('#go'); btn.disabled = true;
  renderAnalyzing();
  if (innerWidth < 1024) $('#main').scrollIntoView({ behavior: 'smooth' });
  const steps = $$('.a-steps li');
  const anim = (async () => { for (const li of steps) { await sleep(380); li.classList.add('done'); } })();
  const body = { ...state, gpa: state.gpa ?? 'unsure', evalLevels: state.evalLevels.filter(x => x !== 'none') };
  try {
    const [a, s] = await Promise.all([
      fetch('/api/assess', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()),
      fetch(`/api/schools?zip=${state.zip}&radius=${state.radius}`).then(r => r.json()),
    ]);
    await anim;
    if (!a.ok) throw new Error(a.error || 'Please check her profile and try again.');
    assessData = a; schoolsData = s; lastRunKey = key; ui.shown = 10; ui.filter = 'all';
    renderResults();
  } catch (e) {
    await anim;
    $('#main').innerHTML = `<section class="panel empty"><h2>Something went wrong</h2><p class="notice">${esc(e.message || 'Please try again.')}</p></section>`;
  } finally { updateGo(); }
}

// ---------- Empty + analyzing ----------
function renderEmpty() {
  $('#main').innerHTML = `<section class="panel empty">
    <div class="orb" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 2l2.2 6.3L20.5 10l-6.3 2.2L12 18.5l-2.2-6.3L3.5 10l6.3-1.7z" fill="currentColor"/></svg></div>
    <h2>Her college matches will show here</h2>
    <p class="muted">Fill in the basics, add her skill level for a sharper match, then tap <b>Find her colleges</b>.</p>
    <div class="steps3"><span>1 · The basics</span><span>2 · Her skill level</span><span>3 · Find her colleges</span></div>
  </section>`;
}
function renderAnalyzing() {
  $('#main').innerHTML = `<section class="panel analyzing"><div class="ring-spin" aria-hidden="true"></div>
    <h2>Analyzing her profile…</h2>
    <ul class="a-steps"><li>Placing her on the recruiting timeline</li><li>Weighing her skill-level evidence</li><li>Finding college programs near you</li><li>Building her next moves</li></ul></section>`;
}

// ---------- Results ----------
const LV_ORDER = ['D1', 'D2', 'D3', 'NAIA', 'JUCO'];
const LV_SHORT = { D1: 'D1', D2: 'D2', D3: 'D3', NAIA: 'NAIA', JUCO: 'JUCO' };
const meter = label => { const n = { 'None yet': 0, Limited: 1, Some: 2, Strong: 4 }[label] ?? 0; return `<span class="meter l${n}" aria-hidden="true"><i></i><i></i><i></i><i></i></span>`; };
const levelInfo = lv => assessData.levels.find(l => l.level === lv);

function renderResults() {
  const a = assessData, p = a.profile, m = a.match;
  const pool = schoolsPool();
  $('#main').innerHTML = `
  <div class="stale-bar" id="staleBar" hidden><span>You changed her profile.</span><button type="button" id="staleGo">Update results</button></div>
  <section class="panel summary">
    <div class="sum-top"><div class="avatar">’${String(p.gradYear).slice(2)}</div>
      <div><p class="eyebrow">Class of ${p.gradYear} · Grade ${p.grade}</p><p class="stage">${esc(a.stage.short)}</p></div></div>
    <p class="headline">${esc(a.stage.headline)}</p>
    <div class="kpis">
      <div class="kpi"><div class="v">${m.levels ? esc(m.levels.join(' · ')) : '—'}</div><div class="k">${m.levels ? 'Best skill match' : 'Not enough to match yet'}</div></div>
      <div class="kpi"><div class="v">${esc(m.confidence.level)}</div><div class="k">Match confidence</div></div>
      <div class="kpi"><div class="v"><span class="sig ${a.signal.strength}"></span>${esc(a.signal.label)}</div><div class="k">College interest</div></div>
      <div class="kpi"><div class="v">${pool ? pool.length : '—'}</div><div class="k">Colleges within ${p.radius} mi</div></div>
    </div>
    ${m.confidence.missing.length ? `<div class="conf"><div><b>Sharpen her match</b><br><span>Add ${esc(m.confidence.missing.join(', '))}.</span></div></div>` : ''}
    <div class="notes">${a.readiness.map(r => `<div class="note"><i class="${r.label}">${{ supported: 'KEY', research: 'CHECK', unknown: 'NOTE' }[r.label]}</i><span>${esc(r.text)}</span></div>`).join('')}</div>
  </section>

  <section class="panel">
    <div class="sec-head"><h2>Skill match by level</h2><p>Based on coach interest, evaluator input and height</p></div>
    <div>${a.levels.map(levelRow).join('')}</div>
    ${p.height ? `<p class="caveat">${esc(a.sizeCaveat)}</p>` : ''}
  </section>

  <section class="panel" id="colleges">
    <div class="sec-head"><h2>Colleges to research</h2><p>Sorted by skill match, then distance</p></div>
    ${collegesHtml()}
  </section>

  <section class="panel">
    <div class="sec-head"><h2>Next moves</h2><p>Picked for grade ${p.grade} and her answers</p></div>
    <div class="actions">${a.actions.map((x, i) => `<div class="act"><div class="n">${i + 1}</div><div><h3>${esc(x.title)}</h3><p>${esc(x.text)}</p></div></div>`).join('')}</div>
    <div class="checks" id="checks">${a.checklist.items.map((t, i) => `<button type="button" class="check" data-i="${i}" aria-pressed="false"><span class="box"></span>${esc(t)}</button>`).join('')}</div>
  </section>

  <section class="panel cta-card">
    <div><h3>Want an expert to evaluate her level?</h3><p>She's Next Recruits helps families build a real recruiting plan.</p></div>
    <a class="btn" href="https://shesnextrecruits.com/" target="_blank" rel="noopener">Learn more →</a>
  </section>
  <p class="foot">${esc(a.disclaimer)} College data: Quad (athletics from federal IPEDS data) and U.S. Dept. of Education College Scorecard.</p>`;
  wireResults();
  updateGo();
  updateJump();
}

function levelRow(l) {
  const focus = l.status === 'explore_first';
  const size = l.size ? sizeBar(l) : `<span class="size-cap">Add height to compare</span>`;
  return `<div class="lv" data-l="${l.level}">
    <button type="button" aria-expanded="false">
      <span class="lv-name">${esc(l.level === 'JUCO' ? 'Junior college' : l.name)} ${focus ? '<span class="pill focus">✦ Match</span>' : ''}</span>
      <span class="ev">${meter(l.evidence.label)}${esc(l.evidence.label)}</span>
      <span class="lv-size">${size}</span>
      <span class="lv-money"><span class="money-tag">${esc(l.money.tag)}</span></span>
      <span class="chev" aria-hidden="true">⌄</span>
    </button>
    <div class="lv-body">
      <div class="lv-mobile">${l.size ? size : ''}<span class="money-tag">${esc(l.money.tag)}</span></div>
      <div><h4>Why</h4>${esc(l.reason)}<br><br><h4>Money</h4>${esc(l.money.text)}</div>
      <div><h4>Still unknown</h4><ul>${l.unknowns.map(u => `<li>${esc(u)}</li>`).join('')}</ul></div>
      <div><h4>How to confirm</h4><ul>${l.findOut.map(u => `<li>${esc(u)}</li>`).join('')}</ul></div>
    </div></div>`;
}
function sizeBar(l) {
  const MIN = 60, MAX = 80, x = i => ((Math.max(MIN, Math.min(MAX, i)) - MIN) / (MAX - MIN)) * 100;
  const toIn = s => { const m = /(\d)'(\d+)"/.exec(s); return m ? Number(m[1]) * 12 + Number(m[2]) : null; };
  const [lo, hi] = l.size.range.split('–'); const a = toIn(lo), plus = /\+$/.test(hi), b = plus ? MAX : toIn(hi);
  const word = { within: 'In typical range', below: 'Below typical range', above: 'Above typical range' }[l.size.rel];
  return `<div class="size-track" title="Typical: ${esc(l.size.range)}"><div class="size-band" style="left:${x(a)}%;width:${x(b) - x(a)}%"></div><div class="size-mark" style="left:${x(assessData.profile.heightIn)}%"></div></div>
    <div class="size-cap">${word} · ${esc(l.size.range)}</div>`;
}

// ---------- Colleges ----------
function schoolsPool() {
  if (!schoolsData || !schoolsData.ok || schoolsData.unknownZip) return null;
  return [...schoolsData.fourYear, ...schoolsData.twoYear.map((s, i) => ({ ...s, rank: 1000 + i }))];
}
function collegesHtml() {
  if (!schoolsData || !schoolsData.ok) return `<p class="notice">${esc(schoolsData?.error || 'College search is unavailable right now.')}</p>`;
  if (schoolsData.unknownZip) return '<p class="notice">We couldn’t place that ZIP code. PO-box-only ZIPs don’t work. Try her home ZIP.</p>';
  const pool = schoolsPool();
  const counts = Object.fromEntries(LV_ORDER.map(l => [l, pool.filter(s => s.level === l).length]));
  const chips = [['all', `All · ${pool.length}`], ...LV_ORDER.filter(l => counts[l]).map(l => [l, `${l === 'JUCO' ? '2-year' : l} · ${counts[l]}`]), ['saved', `Saved · ${pool.filter(s => ui.saved.has(s.id)).length}`]];
  return `<div class="toolbar">
      <label class="tb-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M20 20l-3.5-3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><input id="q" placeholder="Filter by name or city" value="${esc(ui.q)}" aria-label="Filter colleges"></label>
      <label class="tb-sort"><span>Sort</span><select id="sort" aria-label="Sort colleges">
        ${[['match', 'Best skill match'], ['closest', 'Closest'], ['price', 'Lowest net price'], ['selective', 'Most selective'], ['open', 'Easiest admission'], ['big', 'Largest'], ['small', 'Smallest']].map(([v, t]) => `<option value="${v}"${ui.sort === v ? ' selected' : ''}>${t}</option>`).join('')}
      </select></label>
      <div class="views" role="group" aria-label="View"><button type="button" data-view="cards" aria-pressed="${ui.view === 'cards'}">▦ Cards</button><button type="button" data-view="table" aria-pressed="${ui.view === 'table'}">☰ Table</button></div>
    </div>
    <div class="filterrow">${chips.map(([v, t]) => `<button type="button" class="chip" data-f="${v}" aria-pressed="${ui.filter === v}">${esc(t)}</button>`).join('')}</div>
    ${schoolsData.errors?.length ? `<p class="notice">${schoolsData.errors.map(esc).join(' ')}</p>` : ''}
    <div id="list"></div>`;
}
function filteredSorted() {
  const score = s => levelInfo(s.level)?.evidence.score ?? 0;
  const q = ui.q.trim().toLowerCase();
  const list = schoolsPool().filter(s => (ui.filter === 'all' || (ui.filter === 'saved' ? ui.saved.has(s.id) : s.level === ui.filter))
    && (!q || `${s.name} ${s.city} ${s.state}`.toLowerCase().includes(q)));
  const by = (f, dir = 1) => (a, b) => { const x = f(a), y = f(b); if (x == null) return 1; if (y == null) return -1; return (x - y) * dir; };
  const sorts = {
    match: (a, b) => score(b) - score(a) || a.rank - b.rank,
    closest: by(s => s.rank), price: by(s => s.netPrice), selective: by(s => s.acceptance), open: by(s => s.acceptance, -1),
    big: by(s => s.undergrads, -1), small: by(s => s.undergrads),
  };
  return list.sort(sorts[ui.sort]);
}
function initials(name) {
  const skip = new Set(['of', 'the', 'at', 'and', 'in', '&', '-']);
  const words = name.replace(/[^A-Za-z\s&-]/g, ' ').split(/\s+/).filter(w => w && !skip.has(w.toLowerCase()));
  return words.slice(0, 3).map(w => w[0].toUpperCase()).join('') || '•';
}
const LV_COLOR = { D1: ['#db2777', '#4a0b2a'], D2: ['#c026d3', '#3b0a45'], D3: ['#7c3aed', '#2e1065'], NAIA: ['#e11d48', '#4c0519'], JUCO: ['#64748b', '#1e1b2e'] };
function card(s) {
  const info = levelInfo(s.level);
  const ev = info?.evidence || { label: 'None yet', parts: [] };
  const strong = ev.label === 'Strong' || ev.label === 'Some';
  const [c1, c2] = s.accent ? [s.accent, s.crest || '#14070f'] : LV_COLOR[s.level];
  const tags = [];
  if (s.twoYear) tags.push(['g', 'Transfer path']);
  if (s.rank < 3) tags.push(['o', 'Closest']);
  if (s.grantPct != null && s.grantPct >= 0.9) tags.push(['g', 'High grant aid']);
  if (s.acceptance != null && s.acceptance < 0.25) tags.push(['v', 'Highly selective']);
  if (s.undergrads != null) tags.push(s.undergrads < 3000 ? ['m', 'Small campus'] : s.undergrads > 20000 ? ['o', 'Big campus'] : ['m', 'Mid-size campus']);
  const url = s.website ? (/^https?:\/\//.test(s.website) ? s.website : 'https://' + s.website) : null;
  const sizeW = s.undergrads ? Math.max(4, Math.min(100, (Math.log10(s.undergrads) - 2.5) / (4.7 - 2.5) * 100)) : 0;
  const priceW = s.netPrice ? Math.min(100, s.netPrice / 600) : 0;
  return `<article class="cc${strong ? ' focus' : ''}" style="--glow:${esc(c1)}33">
    <div class="cc-top">
      <div class="crest" style="background:linear-gradient(140deg, ${esc(c1)}, ${esc(c2)})">${esc(initials(s.name))}</div>
      <div><h3>${url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(s.name)}</a>` : esc(s.name)}</h3>
        <div class="loc">${esc(s.city)}, ${esc(s.state)}${s.control ? ' · ' + esc(s.control === 'public' ? 'Public' : 'Private') : ''}</div></div>
      <button type="button" class="save" data-id="${esc(s.id)}" aria-pressed="${ui.saved.has(s.id)}" aria-label="Save ${esc(s.name)}"><svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4z" fill="${ui.saved.has(s.id) ? '#fff' : 'none'}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg></button>
    </div>
    <div class="cc-mid">
      <div><div class="big">${money(s.netPrice)}</div><div class="big-k">avg net price / year</div></div>
      <span class="lvl${s.twoYear ? ' two' : ''}"><span class="dotv"></span>${s.twoYear ? '2-year college' : esc(s.level) + (s.conference ? ' · ' + esc(s.conference) : '')}</span>
    </div>
    <span class="match-badge${ev.label === 'None yet' ? ' none' : ''}">${meter(ev.label)}Skill match: ${esc(ev.label)}</span>
    ${ev.parts.length ? `<div class="why-match">${esc(ev.parts.join(' · '))}</div>` : ''}
    <div class="bars" style="margin-top:14px">
      <div class="bar"><span>Acceptance</span><div class="tr"><div class="fl" style="width:${s.acceptance == null ? 0 : s.acceptance * 100}%;background:var(--violet)"></div></div><b>${pct(s.acceptance)}</b></div>
      <div class="bar"><span>Undergrads</span><div class="tr"><div class="fl" style="width:${sizeW}%;background:var(--orange)"></div></div><b>${num(s.undergrads)}</b></div>
      ${s.twoYear ? '' : `<div class="bar"><span>Get grant aid</span><div class="tr"><div class="fl" style="width:${s.grantPct == null ? 0 : s.grantPct * 100}%;background:var(--green)"></div></div><b>${pct(s.grantPct)}</b></div>`}
      <div class="bar"><span>Net price</span><div class="tr"><div class="fl" style="width:${priceW}%;background:var(--amber)"></div></div><b>${money(s.netPrice)}</b></div>
    </div>
    <div class="tags">${tags.map(([c, t]) => `<span class="tag ${c}">${esc(t)}</span>`).join('')}</div>
    <div class="unv">${s.twoYear ? 'Athletics not verified (junior-college data not available)' : 'Not verified: women’s program · roster need at her position'}${s.priceCalculator ? ` · <a href="${esc(/^https?:/.test(s.priceCalculator) ? s.priceCalculator : 'https://' + s.priceCalculator)}" target="_blank" rel="noopener">Net price calculator</a>` : ''}</div>
  </article>`;
}
function table(list) {
  return `<div class="tbl-wrap"><table><thead><tr><th>College</th><th>Level</th><th>Skill match</th><th class="num">Net price</th><th class="num">Acceptance</th><th class="num">Undergrads</th><th class="num">Grant aid</th></tr></thead><tbody>
    ${list.map(s => { const ev = levelInfo(s.level)?.evidence; return `<tr><td><b>${esc(s.name)}</b><br><span class="muted">${esc(s.city)}, ${esc(s.state)}</span></td><td>${s.twoYear ? '2-year' : esc(s.level)}</td><td>${meter(ev?.label)} ${esc(ev?.label || '—')}</td><td class="num">${money(s.netPrice)}</td><td class="num">${pct(s.acceptance)}</td><td class="num">${num(s.undergrads)}</td><td class="num">${pct(s.grantPct)}</td></tr>`; }).join('')}
  </tbody></table></div>`;
}
function renderList() {
  const box = $('#list'); if (!box) return;
  const list = filteredSorted();
  const shown = list.slice(0, ui.shown);
  box.innerHTML = `<p class="meta"><b>${list.length}</b> college${list.length === 1 ? '' : 's'} · showing ${shown.length ? 1 : 0}–${shown.length}</p>
    ${!list.length ? '<p class="muted">Nothing here yet. Try another filter or a wider distance.</p>' : ui.view === 'table' ? table(shown) : `<div class="grid">${shown.map(card).join('')}</div>`}
    ${list.length > shown.length ? `<button type="button" class="more-btn" id="moreBtn">Show more</button>` : ''}`;
  $$('.save', box).forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.id; ui.saved.has(id) ? ui.saved.delete(id) : ui.saved.add(id);
    store.set('snr-saved', [...ui.saved]);
    if (ui.filter === 'saved') renderList(); else { b.setAttribute('aria-pressed', String(ui.saved.has(id))); $('path', b).setAttribute('fill', ui.saved.has(id) ? '#fff' : 'none'); refreshChipCounts(); }
  }));
  $('#moreBtn')?.addEventListener('click', () => { ui.shown += 10; renderList(); });
}
function refreshChipCounts() {
  const n = schoolsPool().filter(s => ui.saved.has(s.id)).length;
  const c = $('.filterrow .chip[data-f="saved"]'); if (c) c.textContent = `Saved · ${n}`;
}

function wireResults() {
  $('#staleGo').addEventListener('click', find);
  $$('.lv > button').forEach(b => b.addEventListener('click', () => {
    const row = b.parentElement, open = !row.classList.contains('open');
    row.classList.toggle('open', open); b.setAttribute('aria-expanded', String(open));
  }));
  const key = `snr-check-${assessData.profile.grade}`, done = new Set(store.get(key, []));
  $$('#checks .check').forEach(c => {
    c.setAttribute('aria-pressed', String(done.has(Number(c.dataset.i))));
    c.addEventListener('click', () => { const i = Number(c.dataset.i); done.has(i) ? done.delete(i) : done.add(i); store.set(key, [...done]); c.setAttribute('aria-pressed', String(done.has(i))); });
  });
  if (!schoolsPool()) return;
  $('#q').addEventListener('input', e => { ui.q = e.target.value; ui.shown = 10; renderList(); });
  $('#sort').addEventListener('change', e => { ui.sort = e.target.value; renderList(); });
  $$('.views button').forEach(b => b.addEventListener('click', () => { ui.view = b.dataset.view; $$('.views button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); renderList(); }));
  $$('.filterrow .chip').forEach(c => c.addEventListener('click', () => { ui.filter = c.dataset.f; ui.shown = 10; $$('.filterrow .chip').forEach(x => x.setAttribute('aria-pressed', String(x === c))); renderList(); }));
  renderList();
}

// ---------- Mobile jump-to-results ----------
let mainVisible = false;
new IntersectionObserver(es => { mainVisible = es[0].isIntersecting; updateJump(); }, { threshold: 0.05 }).observe($('#main'));
function updateJump() {
  const btn = $('#jump');
  btn.hidden = !(assessData && !mainVisible && innerWidth < 1024);
}
$('#jump').addEventListener('click', () => $('#main').scrollIntoView({ behavior: 'smooth' }));

// ---------- Init ----------
renderControls();
if (state.gpa != null || state.playing.length) $('#more').open = true;
renderEmpty();
