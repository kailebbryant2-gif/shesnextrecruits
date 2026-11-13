const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const state = { grade: null, positions: [], playing: [], interest: [], interestLevels: [], distance: null };

const GRADES = { 8: '8th', 9: '9th', 10: '10th', 11: '11th', 12: '12th' };
const LABEL = { supported: 'Supported', research: 'Worth researching', unknown: "Can't tell yet" };

function fmtHeight(i) { return i >= 80 ? '6\'8"+' : `${Math.floor(i / 12)}'${i % 12}"`; }

function chip(group, value, text, type) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'chip'; b.textContent = text; b.dataset.value = value;
  b.setAttribute('aria-pressed', 'false');
  b.addEventListener('click', () => toggle(group, value, type, b));
  return b;
}

function toggle(group, value, type, btn) {
  const box = btn.parentElement;
  if (type === 'single') {
    state[group] = value;
    box.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.value === String(value))));
    return;
  }
  const arr = state[group];
  const on = arr.includes(value);
  if (group === 'interest') {
    // "None yet" is exclusive with every other choice.
    if (value === 'none' && !on) state.interest = ['none'];
    else if (value !== 'none') state.interest = (on ? arr.filter(v => v !== value) : [...arr.filter(v => v !== 'none'), value]);
    else state.interest = [];
    box.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(state.interest.includes(c.dataset.value))));
    $('#levelsBox').hidden = state.interest.includes('none') || state.interest.length === 0;
    return;
  }
  state[group] = on ? arr.filter(v => v !== value) : [...arr, value];
  btn.setAttribute('aria-pressed', String(!on));
}

async function init() {
  const opts = await fetch('/api/options').then(r => r.json());
  const fill = (name, entries, type) => {
    const box = $(`[data-name="${name}"] .chips`) || $(`.chips[data-name="${name}"]`);
    entries.forEach(([v, t]) => box.appendChild(chip(name, v, t, type)));
  };
  fill('grade', Object.entries(GRADES).map(([v, t]) => [Number(v), t]), 'single');
  fill('positions', Object.entries(opts.POSITIONS), 'multi');
  fill('playing', Object.entries(opts.PLAYING), 'multi');
  fill('interest', Object.entries(opts.INTEREST), 'multi');
  fill('interestLevels', opts.LEVELS.map(l => [l, l]), 'multi');
  fill('distance', Object.entries(opts.DISTANCE), 'single');
  const h = $('#height');
  for (let i = 58; i <= 80; i++) h.add(new Option(fmtHeight(i), i));
  const g = $('#gpa');
  Object.entries(opts.GPA).forEach(([v, t]) => g.add(new Option(t, v)));
  $('#levelsBox').hidden = true;
}

function collect() {
  return { ...state, height: Number($('#height').value), gpa: $('#gpa').value, zip: $('#zip').value.trim() };
}

const FIELD_NAMES = { grade: 'grade', height: 'height', positions: 'position', playing: 'where she plays', gpa: 'GPA', interest: 'recruiting interest', zip: '5-digit ZIP code', distance: 'how far from home' };

$('#quiz').addEventListener('submit', async e => {
  e.preventDefault();
  const err = $('#formError'); err.hidden = true;
  const btn = $('#submitBtn'); btn.disabled = true; btn.textContent = 'Building her profile…';
  try {
    const res = await fetch('/api/assess', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(collect()) });
    const data = await res.json();
    if (!data.ok) {
      err.textContent = 'Please answer: ' + (data.errors || []).map(k => FIELD_NAMES[k] || k).join(', ') + '.';
      err.hidden = false; return;
    }
    render(data);
  } catch {
    err.textContent = 'Something went wrong. Please try again.'; err.hidden = false;
  } finally {
    btn.disabled = false; btn.textContent = 'See her recruiting profile';
  }
});

const tag = l => `<span class="tag ${l}">${LABEL[l]}</span>`;
const src = s => s ? ` <span class="src">Source: ${esc(s)}</span>` : '';
const money = n => n == null ? 'not reported' : '$' + Math.round(n).toLocaleString();
const pct = n => n == null ? 'not reported' : Math.round(n * 100) + '%';

function render(d) {
  const p = d.profile;
  const levels = p.interestLevels.length ? ` (${p.interestLevels.map(esc).join(', ')})` : '';
  const html = `
  <article class="card">
    <p class="sec-num">Section 1</p><h2>Your athlete profile</h2>
    <dl class="profile">
      <dt>Class of</dt><dd>${p.gradYear} (${p.grade}th grade)</dd>
      <dt>Height</dt><dd>${esc(p.height)}</dd>
      <dt>Positions</dt><dd>${p.positions.map(esc).join(', ')}</dd>
      <dt>Plays</dt><dd>${p.playing.map(esc).join(', ')}</dd>
      <dt>GPA</dt><dd>${esc(p.gpa)}</dd>
      <dt>Interest</dt><dd>${p.interest.map(esc).join(', ')}${levels}</dd>
      <dt>Location</dt><dd>${esc(p.distance)} of ${esc(p.zip)}</dd>
    </dl>
    <div class="stage"><strong>${esc(p.stage.name)}</strong><br>${esc(p.stage.text)}${src(p.stage.src)}</div>
    <h3>What we can and can't tell</h3>
    <ul class="plain">${p.readiness.map(r => `<li>${tag(r.label)}${esc(r.text)}${src(r.src)}</li>`).join('')}</ul>
  </article>

  <article class="card">
    <p class="sec-num">Section 2</p><h2>Potential recruiting pathways</h2>
    <p>Every level here is real college basketball. Coach Tay: "The goal is not the division. The goal is the right opportunity." <span class="src">Source: M3.L2-T</span></p>
    ${d.pathways.map(l => `
      <details class="level" ${l.status === 'explore_first' ? 'open' : ''}>
        <summary>${l.status === 'explore_first' ? '<span class="tag first">Explore first</span>' : '<span class="tag research">Worth exploring</span>'} ${esc(l.name)}</summary>
        ${l.why.map(w => `<p>${esc(w.text)}${src(w.src)}</p>`).join('')}
        <p>${tag('research')}${esc(l.height.text)}${src(l.height.src)}</p>
        <p><strong>Academics &amp; money:</strong> ${esc(l.academics.text)}${src(l.academics.src)}</p>
        <p>${tag('unknown')}<strong>What we can't tell yet:</strong></p>
        <ul class="plain">${l.unknown.map(u => `<li>${esc(u)}</li>`).join('')}</ul>
        <p><strong>How you'll find out:</strong></p>
        <ul class="plain">${l.findOut.map(u => `<li>${esc(u)}</li>`).join('')}</ul>
      </details>`).join('')}
    <details class="level"><summary>Coach Tay's size chart (context only)</summary>
      <p class="notice">${esc(d.heightContext.caveat)}</p>
      ${d.heightContext.groups.map(g => `<h3>${esc(g.group)}</h3><table class="chart"><tr><th>Level</th><th>Rough range</th><th>Her height</th></tr>
        ${g.rows.map(r => `<tr><td>${esc(r.level)}</td><td>${esc(r.range)}</td><td class="${r.rel}">${esc(r.rel)}</td></tr>`).join('')}</table>`).join('')}
      <p class="src">Source: ${esc(d.heightContext.src)}</p>
    </details>
  </article>

  <article class="card">
    <p class="sec-num">Section 3</p><h2>Schools worth researching</h2>
    ${schoolsHtml(d)}
  </article>

  <article class="card">
    <p class="sec-num">Section 4</p><h2>Coach Tay's recruiting recommendations</h2>
    ${d.recommendations.map(r => `<div class="rec"><h3>${esc(r.title)}</h3><p>${esc(r.text)}${src(r.src)}</p></div>`).join('')}
  </article>

  <article class="card">
    <p class="sec-num">Section 5</p><h2>Next steps</h2>
    <ol class="check">${d.checklist.map((c, i) => `<li><input type="checkbox" id="c${i}"><label for="c${i}">${esc(c.text)}${src(c.src)}</label></li>`).join('')}</ol>
  </article>

  <p class="fine">${esc(d.disclaimer)}</p>
  <button class="ghost" id="restart" type="button">Start over</button>`;
  const out = $('#results');
  out.innerHTML = html; out.hidden = false; $('#quiz').hidden = true;
  $('#restart').addEventListener('click', () => { out.hidden = true; $('#quiz').hidden = false; window.scrollTo(0, 0); });
  window.scrollTo(0, 0);
}

const LEVEL_LABEL = { D1: 'NCAA Division I', D2: 'NCAA Division II', D3: 'NCAA Division III', NAIA: 'NAIA' };

function schoolCard(c, pathways) {
  const path = c.level ? pathways.find(p => p.level === c.level) : null;
  const first = path && path.status === 'explore_first';
  const url = u => esc(/^https?:\/\//.test(u) ? u : 'https://' + u);
  const athletics = c.level
    ? `<p><span class="tag ${first ? 'first' : 'research'}">${first ? 'Explore first' : 'Worth exploring'}</span><strong>${esc(LEVEL_LABEL[c.level])}</strong>${c.conference ? ' · ' + esc(c.conference) : ''}<br>
       <span class="meta">This is the school’s athletic membership from federal (IPEDS) data. ${c.basketballListed ? 'Basketball is listed, but men’s and women’s aren’t specified.' : 'Basketball isn’t listed in this data.'}</span></p>`
    : `<p><span class="tag unknown">Can’t tell yet</span><strong>2-year college</strong> (possible junior-college option)<br><span class="meta">Athletics not verified: our data sources don’t cover NJCAA programs.</span></p>`;
  const money = c.avgNetPrice != null ? `Average net price ${'$' + Math.round(c.avgNetPrice).toLocaleString()} a year` : 'Net price not reported';
  return `<div class="school">
    <h3>${esc(c.name)}</h3>
    <p class="meta">${esc(c.city)}, ${esc(c.state)}${c.control ? ' · ' + esc(String(c.control).replace('-', ' ')) : ''}</p>
    ${athletics}
    <p><strong>Matches your preferences:</strong> within your distance range. ${money}${c.acceptanceRate != null ? `; acceptance rate ${Math.round(c.acceptanceRate * (c.acceptanceRate <= 1 ? 100 : 1))}%` : ''}. Coach Tay: ask about the "total financial package," not just basketball money.${c.priceCalculator ? ` <a href="${url(c.priceCalculator)}" target="_blank" rel="noopener">Net price calculator</a>` : ''}</p>
    <p>${tag('unknown')}<strong>Not yet verified:</strong> ${c.level ? 'whether there’s a women’s basketball program; ' : ''}roster need at her position for her class; whether her level fits; coach interest.</p>
    <p><strong>Your research to-dos:</strong> watch one full game; check the roster for players graduating at her position in her class year; find the head coach and an assistant’s email.${(c.website || c.url) ? ` <a href="${url(c.website || c.url)}" target="_blank" rel="noopener">School website</a>` : ''}</p>
  </div>`;
}

function schoolsHtml(d) {
  const s = d.schools;
  const radius = s.radiusMiles ? `within about ${s.radiusMiles} miles of your ZIP` : 'nationwide';
  const errs = (s.errors || []).map(e => `<p class="notice">${esc(e)}</p>`).join('');
  if (!s.fourYear.length && !s.twoYear.length) return errs || '<p>No colleges found in that range. Try a wider distance.</p>';
  return `<p class="notice"><strong>These schools match your stated preferences, not her athletic fit.</strong> They're ordered closest first, with a mix of levels and the levels marked "Explore first" up top. Nothing here means a program needs her or that her level fits. That takes film, coach interest and research.</p>
    ${errs}
    ${s.anywhere ? '<p class="meta">She\u2019s open to anywhere, so we start with the closest schools to home (up to about 500 miles). Coach Tay notes that nearby schools can see her play more easily.</p>' : ''}
    ${s.fourYear.length ? `<h3>Four-year colleges ${esc(radius)}</h3>${s.fourYear.map(c => schoolCard(c, d.pathways)).join('')}` : ''}
    ${s.twoYear.length ? `<h3>Two-year colleges near you (possible junior-college options)</h3>${s.twoYear.map(c => schoolCard(c, d.pathways)).join('')}` : ''}
    <p class="src">College data: Quad Data API (athletics from IPEDS) and U.S. Department of Education College Scorecard. Distances are approximate.</p>`;
}

init();
