// She's Next College Finder AI: client
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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
  gpa: [['lt2', '<2.0'], ['2.0', '2.0–2.4'], ['2.5', '2.5–2.9'], ['3.0', '3.0–3.4'], ['3.5', '3.5–3.9'], ['4.0', '4.0+']],
  playing: [['hs_varsity', 'HS varsity'], ['hs_jv', 'HS JV'], ['middle_school', 'Middle school'], ['aau_exposure', 'AAU · exposure events'], ['aau_local', 'AAU · local']],
  interest: [['none', 'None yet'], ['mail', 'Mail / follows'], ['camp_invite', 'Camp invites'], ['contacted', 'Coach contact'], ['watched', 'Coach watched'], ['visit', 'Campus visit'], ['offer', 'Offer']],
  interestLevels: [['D1', 'D1'], ['D2', 'D2'], ['D3', 'D3'], ['NAIA', 'NAIA'], ['JUCO', 'JUCO']],
};
const DEFAULTS = { grade: null, positions: [], zip: '', radius: 100, height: null, gpa: null, playing: [], interest: [], interestLevels: [] };
const state = { ...DEFAULTS, ...store.get('snr-profile', {}) };
const ui = { view: 'cards', sort: 'suggested', filter: 'all', q: '', shown: 10, saved: new Set(store.get('snr-saved', [])) };
let assessData = null, schoolsData = null, schoolsKey = '', timer = null, reqId = 0;

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
      if (single) state[key] = state[key] === v && key !== 'grade' && key !== 'radius' ? null : v;
      else if (key === 'interest') {
        if (v === 'none') state.interest = state.interest.includes('none') ? [] : ['none'];
        else state.interest = state.interest.includes(v) ? state.interest.filter(x => x !== v) : [...state.interest.filter(x => x !== 'none'), v];
        if (!state.interest.length || state.interest.includes('none')) state.interestLevels = [];
      } else state[key] = state[key].includes(v) ? state[key].filter(x => x !== v) : [...state[key], v];
      changed();
    }));
  });
  $('#zip').value = state.zip;
  $('#hOut').textContent = fmtH(state.height) || 'Add';
  $('#hClear').hidden = state.height == null;
  $('#levelsWrap').hidden = !state.interest.length || state.interest.includes('none');
  const filled = [state.height != null, state.gpa != null, state.playing.length > 0, state.interest.length > 0].filter(Boolean).length;
  $('#moreCount').textContent = `${filled} of 4`;
}

function changed() { store.set('snr-profile', state); renderControls(); schedule(); }

$('#zip').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 5); state.zip = e.target.value; store.set('snr-profile', state); schedule(); });
$('#hMinus').addEventListener('click', () => { state.height = Math.max(58, (state.height ?? 69) - 1); changed(); });
$('#hPlus').addEventListener('click', () => { state.height = Math.min(80, (state.height ?? 67) + 1); changed(); });
$('#hClear').addEventListener('click', () => { state.height = null; changed(); });

const ready = () => state.grade != null && state.positions.length > 0 && /^\d{5}$/.test(state.zip);

// ---------- Fetching ----------
function schedule() {
  clearTimeout(timer);
  if (!ready()) { renderEmpty(); return; }
  if (!assessData) renderSkeleton();
  timer = setTimeout(run, 250);
}

async function run() {
  const id = ++reqId;
  const body = { ...state, gpa: state.gpa ?? 'unsure' };
  const key = `${state.zip}:${state.radius}`;
  const needSchools = key !== schoolsKey;
  if (needSchools) { schoolsData = null; ui.shown = 10; }
  try {
    const [a, s] = await Promise.all([
      fetch('/api/assess', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()),
      needSchools ? fetch(`/api/schools?zip=${state.zip}&radius=${state.radius}`).then(r => r.json()) : Promise.resolve(schoolsData),
    ]);
    if (id !== reqId) return;
    if (!a.ok) { renderEmpty(a.error); return; }
    assessData = a;
    if (needSchools) { schoolsData = s; schoolsKey = s && s.ok ? key : ''; }
    renderResults();
  } catch {
    if (id === reqId) renderEmpty('Something went wrong. Check your connection and try again.');
  }
}

// ---------- Empty + skeleton ----------
function renderEmpty(err) {
  assessData = null;
  if (typeof updateJump === 'function') $('#jump').hidden = true;
  const okG = state.grade != null, okP = state.positions.length > 0, okZ = /^\d{5}$/.test(state.zip);
  $('#main').innerHTML = `<section class="panel empty">
    <div class="orb" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 2l2.2 6.3L20.5 10l-6.3 2.2L12 18.5l-2.2-6.3L3.5 10l6.3-1.7z" fill="currentColor"/></svg></div>
    <h2>Three answers to see her matches</h2>
    <p class="muted">Pick her grade, her position and your ZIP. Add detail anytime for sharper results.</p>
    <div class="steps3"><span class="${okG ? 'ok' : ''}">${okG ? '✓' : '1'} Grade</span><span class="${okP ? 'ok' : ''}">${okP ? '✓' : '2'} Position</span><span class="${okZ ? 'ok' : ''}">${okZ ? '✓' : '3'} Home ZIP</span></div>
    ${err ? `<p class="notice" style="margin-top:16px">${esc(err)}</p>` : ''}
  </section>`;
}
function renderSkeleton() {
  $('#main').innerHTML = `<section class="panel"><div class="sk" style="height:60px;width:60px;border-radius:20px"></div><div class="sk" style="height:34px;width:55%;margin-top:14px"></div><div class="sk" style="height:16px;width:80%;margin-top:12px"></div>
    <div class="kpis">${'<div class="sk" style="height:70px"></div>'.repeat(4)}</div></section>
    <section class="panel"><div class="sk" style="height:180px"></div></section>`;
}

// ---------- Results ----------
const LV_ORDER = ['D1', 'D2', 'D3', 'NAIA', 'JUCO'];
function renderResults() {
  const a = assessData, p = a.profile;
  const pool = schoolsPool();
  const total = pool ? pool.length : null;
  $('#main').innerHTML = `
  <section class="panel summary">
    <div class="sum-top"><div class="avatar">’${String(p.gradYear).slice(2)}</div>
      <div><p class="eyebrow">Class of ${p.gradYear} · Grade ${p.grade}</p><p class="stage">${esc(a.stage.short)}</p></div></div>
    <p class="headline">${esc(a.stage.headline)}</p>
    <div class="kpis">
      <div class="kpi"><div class="v"><span class="sig ${a.signal.strength}"></span>${esc(a.signal.label)}</div><div class="k">Recruiting signal</div></div>
      <div class="kpi"><div class="v">${a.focus ? esc(a.focus.join(' · ')) : 'All levels'}</div><div class="k">${a.focus ? 'Focus levels' : 'Open to explore'}</div></div>
      <div class="kpi"><div class="v">${total == null ? '<span class="sk" style="display:inline-block;width:40px;height:22px"></span>' : total}</div><div class="k">Colleges within ${p.radius} mi</div></div>
      <div class="kpi"><div class="v">${p.height ? esc(p.height) : '—'}</div><div class="k">${p.height ? esc(p.positions.join(' · ')) : 'Add height for size fit'}</div></div>
    </div>
    <div class="notes">${a.readiness.map(r => `<div class="note"><i class="${r.label}">${{ supported: 'KEY', research: 'CHECK', unknown: 'NOTE' }[r.label]}</i><span>${esc(r.text)}</span></div>`).join('')}</div>
  </section>

  <section class="panel">
    <div class="sec-head"><h2>College levels</h2><p>${a.signal.strength === 'strong' ? 'Ordered by where coaches are showing interest.' : 'Every level is real college basketball.'}</p></div>
    <div>${a.levels.map(levelRow).join('')}</div>
    ${p.height ? `<p class="caveat">${esc(a.sizeCaveat)}</p>` : ''}
  </section>

  <section class="panel">
    <div class="sec-head"><h2>Next moves</h2><p>Picked for grade ${p.grade} and her answers</p></div>
    <div class="actions">${a.actions.map((x, i) => `<div class="act"><div class="n">${i + 1}</div><div><h3>${esc(x.title)}</h3><p>${esc(x.text)}</p></div></div>`).join('')}</div>
    <div class="checks" id="checks">${a.checklist.items.map((t, i) => `<button type="button" class="check" data-i="${i}" aria-pressed="false"><span class="box"></span>${esc(t)}</button>`).join('')}</div>
  </section>

  <section class="panel" id="colleges">
    <div class="sec-head"><h2>Colleges to research</h2><p>Matched to your distance, not her athletic fit</p></div>
    ${collegesHtml()}
  </section>

  <section class="panel cta-card">
    <div><h3>Want expert eyes on her recruiting?</h3><p>She's Next Recruits helps families build a real recruiting plan.</p></div>
    <a class="btn" href="https://shesnextrecruits.com/" target="_blank" rel="noopener">Learn more →</a>
  </section>
  <p class="foot">${esc(a.disclaimer)} College data: Quad (athletics from federal IPEDS data) and U.S. Dept. of Education College Scorecard.</p>`;
  wireResults();
  updateJump();
}

function levelRow(l) {
  const focus = l.status === 'explore_first';
  const size = l.size ? sizeBar(l) : `<span class="size-cap">Add height to compare</span>`;
  return `<div class="lv" data-l="${l.level}">
    <button type="button" aria-expanded="false">
      <span class="lv-name">${esc(l.level === 'JUCO' ? 'Junior college' : l.name)} <span class="pill ${focus ? 'focus' : 'open'}">${focus ? '✦ Focus' : 'Open'}</span></span>
      <span class="lv-size">${size}</span>
      <span class="lv-money"><span class="money-tag">${esc(l.money.tag)}</span></span>
      <span class="chev" aria-hidden="true">⌄</span>
    </button>
    <div class="lv-body">
      <div class="lv-mobile">${l.size ? size : ''}<span class="money-tag">${esc(l.money.tag)}</span></div>
      <div><h4>Why</h4>${esc(l.reason)}<br><br><h4>Money</h4>${esc(l.money.text)}</div>
      <div><h4>Still unknown</h4><ul>${l.unknowns.map(u => `<li>${esc(u)}</li>`).join('')}</ul></div>
      <div><h4>How to find out</h4><ul>${l.findOut.map(u => `<li>${esc(u)}</li>`).join('')}</ul></div>
    </div></div>`;
}
function sizeBar(l) {
  const MIN = 60, MAX = 80, x = i => ((Math.max(MIN, Math.min(MAX, i)) - MIN) / (MAX - MIN)) * 100;
  const toIn = s => { const m = /(\d)'(\d+)"/.exec(s); return m ? Number(m[1]) * 12 + Number(m[2]) : null; };
  const [lo, hi] = l.size.range.split('–'); const a = toIn(lo), plus = /\+$/.test(hi), b = plus ? MAX : toIn(hi);
  const her = assessData.profile.heightIn;
  const word = { within: 'In typical range', below: 'Below typical range', above: 'Above typical range' }[l.size.rel];
  return `<div class="size-track" title="Typical: ${esc(l.size.range)}"><div class="size-band" style="left:${x(a)}%;width:${x(b) - x(a)}%"></div><div class="size-mark" style="left:${x(her)}%"></div></div>
    <div class="size-cap">${word} · ${esc(l.size.range)}</div>`;
}

// ---------- Colleges ----------
function schoolsPool() {
  if (!schoolsData || !schoolsData.ok) return null;
  return [...schoolsData.fourYear, ...schoolsData.twoYear.map((s, i) => ({ ...s, rank: 1000 + i }))];
}
function collegesHtml() {
  if (!schoolsData) return '<div class="grid">' + '<div class="sk" style="height:250px"></div>'.repeat(4) + '</div>';
  if (!schoolsData.ok) return `<p class="notice">${esc(schoolsData.error || 'College search is unavailable right now.')}</p>`;
  if (schoolsData.unknownZip) return '<p class="notice">We couldn’t place that ZIP code. PO-box-only ZIPs don’t work. Try her home ZIP.</p>';
  const pool = schoolsPool();
  const counts = Object.fromEntries(LV_ORDER.map(l => [l, pool.filter(s => s.level === l).length]));
  const chips = [['all', `All · ${pool.length}`], ...LV_ORDER.filter(l => counts[l]).map(l => [l, `${l === 'JUCO' ? '2-year' : l} · ${counts[l]}`]), ['saved', `Saved · ${pool.filter(s => ui.saved.has(s.id)).length}`]];
  return `<div class="toolbar">
      <label class="tb-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M20 20l-3.5-3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><input id="q" placeholder="Filter by name or city" value="${esc(ui.q)}" aria-label="Filter colleges"></label>
      <label class="tb-sort"><span>Sort</span><select id="sort" aria-label="Sort colleges">
        ${[['suggested', 'Suggested'], ['closest', 'Closest'], ['price', 'Lowest net price'], ['selective', 'Most selective'], ['open', 'Easiest admission'], ['big', 'Largest'], ['small', 'Smallest']].map(([v, t]) => `<option value="${v}"${ui.sort === v ? ' selected' : ''}>${t}</option>`).join('')}
      </select></label>
      <div class="views" role="group" aria-label="View"><button type="button" data-view="cards" aria-pressed="${ui.view === 'cards'}">▦ Cards</button><button type="button" data-view="table" aria-pressed="${ui.view === 'table'}">☰ Table</button></div>
    </div>
    <div class="filterrow">${chips.map(([v, t]) => `<button type="button" class="chip" data-f="${v}" aria-pressed="${ui.filter === v}">${esc(t)}</button>`).join('')}</div>
    ${schoolsData.errors?.length ? `<p class="notice">${schoolsData.errors.map(esc).join(' ')}</p>` : ''}
    <div id="list"></div>`;
}
function filteredSorted() {
  const focus = new Set(assessData.focus || []);
  const q = ui.q.trim().toLowerCase();
  let list = schoolsPool().filter(s => (ui.filter === 'all' || (ui.filter === 'saved' ? ui.saved.has(s.id) : s.level === ui.filter))
    && (!q || `${s.name} ${s.city} ${s.state}`.toLowerCase().includes(q)));
  const by = (f, dir = 1) => (a, b) => { const x = f(a), y = f(b); if (x == null) return 1; if (y == null) return -1; return (x - y) * dir; };
  const sorts = {
    suggested: (a, b) => (focus.has(b.level) - focus.has(a.level)) || a.rank - b.rank,
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
const LV_COLOR = { D1: ['#4f46e5', '#1e1b4b'], D2: ['#7c3aed', '#2e1065'], D3: ['#0e7490', '#083344'], NAIA: ['#be185d', '#500724'], JUCO: ['#475569', '#0f172a'] };
function card(s) {
  const focus = (assessData.focus || []).includes(s.level);
  const [c1, c2] = s.accent ? [s.accent, s.crest || '#0a0c18'] : LV_COLOR[s.level];
  const tags = [];
  if (focus) tags.push(['v', '✦ Focus level']);
  if (s.twoYear) tags.push(['g', 'Transfer path']);
  if (s.rank < 3) tags.push(['o', 'Closest']);
  if (s.grantPct != null && s.grantPct >= 0.9) tags.push(['g', 'High grant aid']);
  if (s.acceptance != null && s.acceptance < 0.25) tags.push(['v', 'Highly selective']);
  if (s.undergrads != null) tags.push(s.undergrads < 3000 ? ['m', 'Small campus'] : s.undergrads > 20000 ? ['o', 'Big campus'] : ['m', 'Mid-size campus']);
  const url = s.website ? (/^https?:\/\//.test(s.website) ? s.website : 'https://' + s.website) : null;
  const sizeW = s.undergrads ? Math.min(100, (Math.log10(s.undergrads) - 2.5) / (4.7 - 2.5) * 100) : 0;
  const priceW = s.netPrice ? Math.min(100, s.netPrice / 600) : 0;
  return `<article class="cc${focus ? ' focus' : ''}" style="--glow:${esc(c1)}33">
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
    <div class="bars">
      <div class="bar"><span>Acceptance</span><div class="tr"><div class="fl" style="width:${s.acceptance == null ? 0 : s.acceptance * 100}%;background:var(--violet)"></div></div><b>${pct(s.acceptance)}</b></div>
      <div class="bar"><span>Undergrads</span><div class="tr"><div class="fl" style="width:${sizeW}%;background:var(--orange)"></div></div><b>${num(s.undergrads)}</b></div>
      ${s.twoYear ? '' : `<div class="bar"><span>Get grant aid</span><div class="tr"><div class="fl" style="width:${s.grantPct == null ? 0 : s.grantPct * 100}%;background:var(--green)"></div></div><b>${pct(s.grantPct)}</b></div>`}
      <div class="bar"><span>Net price</span><div class="tr"><div class="fl" style="width:${priceW}%;background:var(--amber)"></div></div><b>${money(s.netPrice)}</b></div>
    </div>
    <div class="tags">${tags.map(([c, t]) => `<span class="tag ${c}">${esc(t)}</span>`).join('')}</div>
    <div class="unv">${s.twoYear ? 'Athletics not verified (junior-college data not available)' : 'Not verified: women’s program · roster need at her position · her fit'}${s.priceCalculator ? ` · <a href="${esc(/^https?:/.test(s.priceCalculator) ? s.priceCalculator : 'https://' + s.priceCalculator)}" target="_blank" rel="noopener">Net price calculator</a>` : ''}</div>
  </article>`;
}
function table(list) {
  return `<div class="tbl-wrap"><table><thead><tr><th>College</th><th>Level</th><th>Conference</th><th class="num">Net price</th><th class="num">Acceptance</th><th class="num">Undergrads</th><th class="num">Grant aid</th></tr></thead><tbody>
    ${list.map(s => `<tr><td><b>${esc(s.name)}</b><br><span class="muted">${esc(s.city)}, ${esc(s.state)}</span></td><td>${s.twoYear ? '2-year' : esc(s.level)}</td><td>${esc(s.conference || '—')}</td><td class="num">${money(s.netPrice)}</td><td class="num">${pct(s.acceptance)}</td><td class="num">${num(s.undergrads)}</td><td class="num">${pct(s.grantPct)}</td></tr>`).join('')}
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
  $$('.lv > button').forEach(b => b.addEventListener('click', () => {
    const row = b.parentElement, open = !row.classList.contains('open');
    row.classList.toggle('open', open); b.setAttribute('aria-expanded', String(open));
  }));
  const key = `snr-check-${assessData.profile.grade}`, done = new Set(store.get(key, []));
  $$('#checks .check').forEach(c => {
    c.setAttribute('aria-pressed', String(done.has(Number(c.dataset.i))));
    c.addEventListener('click', () => { const i = Number(c.dataset.i); done.has(i) ? done.delete(i) : done.add(i); store.set(key, [...done]); c.setAttribute('aria-pressed', String(done.has(i))); });
  });
  if (!schoolsData || !schoolsData.ok || schoolsData.unknownZip) return;
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
  const n = schoolsPool()?.length;
  btn.hidden = !(assessData && !mainVisible && innerWidth < 1024);
  btn.innerHTML = `See her results${n ? ` · ${n} colleges` : ''} <span aria-hidden="true">↓</span>`;
}
$('#jump').addEventListener('click', () => $('#main').scrollIntoView({ behavior: 'smooth' }));

// ---------- Init ----------
renderControls();
if (state.height != null || state.gpa != null || state.playing.length || state.interest.length) $('#more').open = true;
schedule();
