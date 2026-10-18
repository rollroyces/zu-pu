#!/usr/bin/env node
/* zu-pu v1 — life-path genealogy with 9-language i18n, SVG portraits, Lab mode */
'use strict';

const CACHE = { i18n: null };
let I18N = {}, LANG = 'zh-Hant';

const SUPPORTED_LANGS = ['zh-Hant','zh-Hans','en','ko','ja','vi','fr','th','es'];

const $  = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => Array.from(el.querySelectorAll(s));

function detectLang() {
  const saved = localStorage.getItem('zu-pu.lang');
  if (saved && SUPPORTED_LANGS.includes(saved)) return saved;
  const nav = (navigator.language || 'en').toLowerCase();
  if (nav.startsWith('zh'))  return nav.includes('hans') || nav.includes('cn') ? 'zh-Hans' : 'zh-Hant';
  if (nav.startsWith('en'))  return 'en';
  if (nav.startsWith('ko'))  return 'ko';
  if (nav.startsWith('ja'))  return 'ja';
  if (nav.startsWith('vi'))  return 'vi';
  if (nav.startsWith('fr'))  return 'fr';
  if (nav.startsWith('th'))  return 'th';
  if (nav.startsWith('es'))  return 'es';
  return 'en';
}

function t(key, ...vals) {
  const dict = I18N[LANG] || I18N['en'] || {};
  let s = dict[key];
  if (s == null) s = (I18N['en'] || {})[key] || key;
  vals.forEach((v, i) => { s = s.replace(new RegExp('\\{'+i+'\\}','g'), v); });
  return s;
}

async function loadI18n() {
  if (CACHE.i18n) { I18N = CACHE.i18n; return; }
  try {
    const res = await fetch('data/i18n.json');
    I18N = await res.json();
    CACHE.i18n = I18N;
  } catch (e) { I18N = { en: {} }; }
}

function setLang(lang) {
  if (!SUPPORTED_LANGS.includes(lang)) return;
  LANG = lang;
  localStorage.setItem('zu-pu.lang', lang);
  renderAll();
}

/* ===== Data Model ===== */
let STATE = {
  people: [],
  families: [],
  meta: { root: null, name: '' }
};

const SEX = { M: 'M', F: 'F', U: 'U' };

function personById(id) { return STATE.people.find(p => p.id === id); }
function familyById(id) { return STATE.families.find(f => f.id === id); }
function familiesOf(p) {
  return STATE.families.filter(f => (f.husb === p.id || f.wife === p.id));
}
function parentsOf(p) {
  const fam = STATE.families.find(f => f.children && f.children.includes(p.id));
  if (!fam) return [];
  return [fam.husb, fam.wife].filter(Boolean).map(personById).filter(Boolean);
}
function childrenOf(p) {
  const fams = familiesOf(p);
  const out = [];
  fams.forEach(f => (f.children || []).forEach(cid => {
    const c = personById(cid);
    if (c) out.push(c);
  }));
  return out;
}
function spousesOf(p) {
  return familiesOf(p).map(f => f.husb === p.id ? personById(f.wife) : personById(f.husb)).filter(Boolean);
}
function genOf(p, seen) {
  seen = seen || new Set();
  if (seen.has(p.id)) return 0;
  seen.add(p.id);
  const pars = parentsOf(p);
  if (!pars.length) return 0;
  return 1 + Math.max(...pars.map(x => genOf(x, seen)));
}

function lifeStatus(p) {
  if (!p) return 'unknown';
  if (p.death) return 'deceased';
  return 'alive';
}

/* ===== Family-origin heuristics ===== */
function guessFamily(p) {
  const bp = (p.birthplace || '').toLowerCase();
  const caste = (p.caste || p.notes || '').toLowerCase();
  if (caste.includes('原住民') || bp.includes('毛利') || bp.includes('maori') || bp.includes('new zealand')) return 'maori';
  if (caste.includes('aboriginal') || bp.includes('aboriginal') || bp.includes('澳洲原住民')) return 'aboriginal';
  if (caste.includes('scheduled tribe') || caste.includes('st') || bp.includes('tribal')) return 'indian_st';
  if (caste.includes('scheduled caste') || caste.includes('sc') || caste.includes('dalit')) return 'indian_sc';
  if (caste.includes('obc') || caste.includes('其他落後階級')) return 'indian_obc';
  if (caste.includes('brahmin') || caste.includes('rajput') || caste.includes('kshatriya')) return 'indian_brahmin';
  if (bp.includes('india') || bp.includes('pakistan') || bp.includes('bangladesh')) return 'indian_obc';
  if (bp.includes('korea')) return 'korean';
  if (bp.includes('japan')) return 'japanese';
  if (bp.includes('vietnam')) return 'vietnamese';
  if (bp.includes('thailand')) return 'thai';
  if (bp.includes('france') || bp.includes('paris')) return 'european';
  if (bp.includes('spain') || bp.includes('mexico') || bp.includes('argentina')) return 'hispanic';
  if (bp.includes('africa')) return 'african';
  if (bp.includes('australia') || bp.includes('new south wales')) return 'european';
  if (bp.includes('taiwan')) return 'hakka';
  if (caste.includes('客家') || bp.includes('meizhou') || bp.includes('客家')) return 'hakka';
  if (caste.includes('回族') || bp.includes('ningxia') || bp.includes('回族')) return 'hui';
  if (bp.includes('china') || bp.includes('beijing') || bp.includes('shanghai') || bp.includes('fujian')) return 'han';
  return 'han';
}

const FAMILY_PALETTE = {
  han:        { skin:'#f1c9a5', hair:'#1a1a1a' },
  hakka:      { skin:'#e8b58e', hair:'#0d0d0d' },
  hui:        { skin:'#dca478', hair:'#000000' },
  korean:     { skin:'#f3d0a9', hair:'#1a1a1a' },
  japanese:   { skin:'#f0cba0', hair:'#0a0a0a' },
  vietnamese: { skin:'#e8b58e', hair:'#1a1a1a' },
  thai:       { skin:'#d99b6a', hair:'#1a1a1a' },
  european:   { skin:'#f4d0b0', hair:'#6b3a1d' },
  hispanic:   { skin:'#c98a5f', hair:'#1a1a1a' },
  african:    { skin:'#7a4a2a', hair:'#0a0a0a' },
  indian_brahmin:{ skin:'#dca478', hair:'#1a1a1a' },
  indian_obc: { skin:'#a86a3f', hair:'#1a1a1a' },
  indian_sc:  { skin:'#8b5a3c', hair:'#1a1a1a' },
  indian_st:  { skin:'#7a4a2a', hair:'#0a0a0a' },
  maori:      { skin:'#a87148', hair:'#1a1a1a' },
  aboriginal: { skin:'#8b5a3c', hair:'#0a0a0a' }
};

/* ===== SVG pixel portrait ===== */
function pixelPortraitSVG(p, age, sex) {
  age = age || 30;
  sex = sex || p.sex || 'U';
  const fam = guessFamily(p);
  const pal = FAMILY_PALETTE[fam] || FAMILY_PALETTE.han;
  const stage = age < 3 ? 'baby' : age < 13 ? 'child' : age < 20 ? 'teen' : age < 60 ? 'adult' : 'elder';
  const skin = pal.skin, hair = pal.hair;
  const isF = sex === 'F';
  const headRX = stage === 'baby' ? 14 : stage === 'child' ? 16 : 18;
  const skinDark = age > 70 ? '#888' : 'transparent';
  return `
<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" class="px-portrait">
  <rect width="64" height="64" fill="#f8f4ea"/>
  ${stage !== 'baby' ? `<rect x="8" y="44" width="48" height="20" fill="${isF?'#a04060':'#405070'}" rx="3"/>` : ''}
  ${stage === 'baby' ? `<rect x="20" y="40" width="24" height="20" fill="#e8c4a0" rx="6"/>` : ''}
  <ellipse cx="32" cy="30" rx="${headRX}" ry="${headRX+2}" fill="${skin}" stroke="${skinDark}" stroke-width="${age>70?1:0}"/>
  ${stage !== 'baby' ? `<path d="M${32-headRX} 28 Q32 ${14-headRX/2} ${32+headRX} 28 L${32+headRX-2} ${30-headRX/2} Q32 ${16} ${32-headRX+2} ${30-headRX/2} Z" fill="${hair}"/>` : `<circle cx="20" cy="22" r="3" fill="${hair}"/><circle cx="44" cy="22" r="3" fill="${hair}"/>`}
  ${isF && stage !== 'baby' && stage !== 'child' ? `<rect x="${32-headRX-1}" y="${30-headRX/2}" width="${headRX*2+2}" height="${headRX}" fill="${hair}" opacity="0.8"/>` : ''}
  ${age < 3
    ? `<circle cx="26" cy="32" r="1.8" fill="#222"/><circle cx="38" cy="32" r="1.8" fill="#222"/><path d="M28 40 Q32 42 36 40" stroke="#a04040" stroke-width="1.2" fill="none"/>`
    : age > 70
    ? `<path d="M25 33 L29 33" stroke="#222" stroke-width="1.5"/><path d="M35 33 L39 33" stroke="#222" stroke-width="1.5"/><path d="M28 40 L36 40" stroke="#a04040" stroke-width="1.2"/>`
    : `<circle cx="26" cy="32" r="2" fill="#222"/><circle cx="38" cy="32" r="2" fill="#222"/><path d="M28 40 Q32 42 36 40" stroke="#a04040" stroke-width="1.2" fill="none"/>`}
</svg>`;
}

/* ===== Tree rendering ===== */
function buildAncestorTree(rootId, depth) {
  const root = personById(rootId);
  if (!root) return null;
  const visit = (pid, d) => {
    const p = personById(pid);
    if (!p) return null;
    const node = { id: p.id, person: p, gen: depth - d, kids: [] };
    if (d > 0) {
      const pars = parentsOf(p);
      pars.forEach(par => {
        const child = visit(par.id, d-1);
        if (child) node.kids.push(child);
      });
    }
    return node;
  };
  return visit(rootId, depth);
}

function buildDescendantTree(rootId, depth) {
  const visit = (pid, d) => {
    const p = personById(pid);
    if (!p) return null;
    const node = { id: p.id, person: p, gen: d, kids: [] };
    if (d < depth) {
      childrenOf(p).forEach(c => {
        const child = visit(c.id, d+1);
        if (child) node.kids.push(child);
      });
    }
    return node;
  };
  return visit(rootId, 0);
}

function renderTreeSVG(treeRoot, mode) {
  if (!treeRoot) return '<p class="muted">—</p>';
  const width = mode === 'both' ? 1100 : 900;
  const rowH = 90;
  const positions = [];
  function layout(node, x, y) {
    positions.push({ node, x, y });
    if (!node.kids.length) return x;
    let cur = x;
    node.kids.forEach(k => {
      cur = layout(k, cur, y + rowH);
      cur += 30;
    });
    return cur - 30;
  }
  layout(treeRoot, 0, 0);
  const maxX = Math.max(...positions.map(p => p.x));
  const maxY = Math.max(...positions.map(p => p.y));
  const cols = maxX + 220;
  const rows = maxY + 80;
  let svg = `<svg viewBox="0 0 ${cols} ${rows}" xmlns="http://www.w3.org/2000/svg" class="tree-svg">`;
  positions.forEach(({ node, x, y }) => {
    node.kids.forEach(k => {
      const childPos = positions.find(p => p.node.id === k.id);
      if (childPos) {
        svg += `<line x1="${x+60}" y1="${y+50}" x2="${childPos.x+60}" y2="${childPos.y+50}" stroke="#888" stroke-width="1.5"/>`;
      }
    });
  });
  positions.forEach(({ node, x, y }) => {
    const p = node.person;
    const age = computeAge(p);
    const sex = p.sex || 'U';
    const deceased = lifeStatus(p) === 'deceased';
    svg += `<g transform="translate(${x}, ${y})">`;
    svg += `<rect class="node-rect node-${sexLower(sex)} ${deceased?'node-deceased':''}" x="0" y="0" width="160" height="80" rx="6"/>`;
    svg += `<foreignObject x="4" y="4" width="48" height="48">${pixelPortraitSVG(p, age, sex)}</foreignObject>`;
    svg += `<text x="58" y="22" class="node-name">${escapeXml(p.name || '?')}</text>`;
    svg += `<text x="58" y="40" class="node-meta">${p.birth || ''} – ${p.death || t('legend.m')} · ${t('sex.' + sexLower(sex))}</text>`;
    svg += `<text x="58" y="56" class="node-gen">${t('tree.g2').replace('{0}', node.gen+1)}</text>`;
    if (deceased) svg += `<text x="148" y="14" class="node-cross">†</text>`;
    svg += `</g>`;
  });
  svg += `</svg>`;
  return svg;
}

function sexLower(s) { return s === 'M' ? 'm' : s === 'F' ? 'f' : 'u'; }

function escapeXml(s) {
  return String(s || '').replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
}

function computeAge(p) {
  if (!p.birth) return 30;
  const by = parseInt(p.birth.slice(0,4));
  const ey = p.death ? parseInt(p.death.slice(0,4)) : new Date().getFullYear();
  return Math.max(0, ey - by);
}

/* ===== Person detail card ===== */
function personCard(p) {
  const age = computeAge(p);
  const sex = p.sex || 'U';
  const deceased = lifeStatus(p) === 'deceased';
  const fam = guessFamily(p);
  return `
<article class="person-card">
  <div class="person-portrait">${pixelPortraitSVG(p, age, sex)}</div>
  <h3 class="person-name">${escapeXml(p.name || '?')}</h3>
  <p class="person-meta">
    <span class="badge badge-${sexLower(sex)}">${t('sex.' + sexLower(sex))}</span>
    ${deceased ? `<span class="badge badge-deceased">${t('legend.d')}</span>` : `<span class="badge badge-alive">${t('legend.m')}</span>`}
    <span class="badge badge-fam">${fam}</span>
  </p>
  <ul class="person-fields">
    ${p.birth ? `<li><b>${t('event.birth')}:</b> ${escapeXml(p.birth)}</li>` : ''}
    ${p.death ? `<li><b>${t('event.death')}:</b> ${escapeXml(p.death)}</li>` : ''}
    ${p.birthplace ? `<li><b>${t('event.birthplace')}:</b> ${escapeXml(p.birthplace)}</li>` : ''}
    ${p.occupation ? `<li><b>${t('event.occupation')}:</b> ${escapeXml(p.occupation)}</li>` : ''}
    ${p.education ? `<li><b>${t('event.education')}:</b> ${escapeXml(p.education)}</li>` : ''}
    ${p.caste ? `<li><b>${t('event.caste')}:</b> ${escapeXml(p.caste)}</li>` : ''}
    ${p.notes ? `<li><b>${t('event.notes')}:</b> ${escapeXml(p.notes)}</li>` : ''}
  </ul>
</article>`;
}

/* ===== Lab mode ===== */
function runLab() {
  const ps = STATE.people;
  if (!ps.length) return { total: 0, avgAge: 0, avgGen: 0, maxGen: 0, byDecade: [] };
  const total = ps.length;
  let ageSum = 0, ageN = 0;
  const seen = new Set();
  const gens = ps.map(p => genOf(p, seen));
  const maxGen = Math.max(0, ...gens);
  const avgGen = gens.reduce((a,b)=>a+b,0) / gens.length;
  ps.forEach(p => {
    const a = computeAge(p);
    if (!isNaN(a) && a > 0) { ageSum += a; ageN++; }
  });
  const avgAge = ageN ? ageSum / ageN : 0;
  const bins = {};
  ps.forEach(p => {
    const by = parseInt((p.birth||'').slice(0,4));
    if (!isNaN(by)) {
      const decade = Math.floor(by/10)*10;
      bins[decade] = (bins[decade]||0) + 1;
    }
  });
  const byDecade = Object.keys(bins).sort().map(d => ({ decade: parseInt(d), n: bins[d] }));
  return { total, avgAge, avgGen, maxGen, byDecade };
}

function renderLab() {
  const wrap = $('#lab-results');
  if (!wrap) return;
  const r = runLab();
  if (!r.total) { wrap.innerHTML = `<p class="muted">—</p>`; return; }
  const maxBar = Math.max(...r.byDecade.map(b => b.n), 1);
  let html = `<div class="lab-stats">
    <div class="lab-stat"><b>${r.total}</b><span>${t('lab.total')}</span></div>
    <div class="lab-stat"><b>${r.avgAge.toFixed(1)}</b><span>${t('lab.avgAge')}</span></div>
    <div class="lab-stat"><b>${r.avgGen.toFixed(2)}</b><span>${t('lab.avgGen')}</span></div>
    <div class="lab-stat"><b>${r.maxGen+1}</b><span>${t('lab.maxGen')}</span></div>
  </div>`;
  if (r.byDecade.length) {
    html += `<div class="lab-section"><h3>${t('lab.byDecade')}</h3><div class="lab-bars">`;
    r.byDecade.forEach(b => {
      const h = Math.round((b.n / maxBar) * 80);
      html += `<div class="lab-bar-col"><div class="lab-bar" style="height:${h}px"></div><div class="lab-bar-label">${b.decade}s</div><div class="lab-bar-n">${b.n}</div></div>`;
    });
    html += `</div></div>`;
  }
  wrap.innerHTML = html;
}

/* ===== View switching ===== */
function showView(name) {
  ['tree','people','person','lab'].forEach(v => {
    const el = $('#view' + v.charAt(0).toUpperCase() + v.slice(1));
    if (el) el.style.display = (v === name) ? 'block' : 'none';
  });
  $$('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.view === name));
}

/* ===== Pick a sensible default tree root ===== */
function defaultTreeRoot() {
  const withFamily = STATE.people.find(p => parentsOf(p).length && childrenOf(p).length);
  if (withFamily) return withFamily.id;
  return STATE.people[0]?.id;
}

/* ===== Render everything ===== */
function renderAll() {
  $$('[data-t]').forEach(el => {
    const k = el.getAttribute('data-t');
    el.textContent = t(k);
  });
  $$('[data-t-placeholder]').forEach(el => {
    const k = el.getAttribute('data-t-placeholder');
    el.setAttribute('placeholder', t(k));
  });
  const sel = $('#langSelect');
  if (sel) sel.value = LANG;

  renderPeopleList();
  renderTree();
  renderLab();
}

function renderPeopleList() {
  const wrap = $('#peopleList');
  if (!wrap) return;
  if (!STATE.people.length) { wrap.innerHTML = `<p class="muted">—</p>`; return; }
  wrap.innerHTML = STATE.people.map(p => {
    const age = computeAge(p);
    const deceased = lifeStatus(p) === 'deceased';
    return `<div class="person-row" data-id="${p.id}">
      <div class="row-portrait">${pixelPortraitSVG(p, age, p.sex || 'U')}</div>
      <div class="row-meta">
        <div class="row-name">${escapeXml(p.name || '?')} <span class="row-sex">[${t('sex.' + sexLower(p.sex || 'U'))}]</span> ${deceased ? '†' : ''}</div>
        <div class="row-life">${p.birth||'?'} – ${p.death || t('legend.m')}</div>
      </div>
    </div>`;
  }).join('');
  $$('#peopleList .person-row').forEach(row => {
    row.addEventListener('click', () => {
      const id = row.dataset.id;
      const p = personById(id);
      $('#personCardWrap').innerHTML = p ? personCard(p) : '';
      showView('person');
    });
  });
}

function renderTree() {
  const wrap = $('#treeSvg');
  if (!wrap) return;
  const rootSel = $('#treeRoot');
  const modeSel = $('#treeMode');
  const depthSel = $('#treeDepth');
  if (!rootSel) return;
  if (rootSel.options.length !== STATE.people.length) {
    rootSel.innerHTML = STATE.people.map(p => `<option value="${p.id}">${escapeXml(p.name || '?')}</option>`).join('');
    const def = defaultTreeRoot();
    if (def) rootSel.value = def;
  }
  const rid = rootSel.value;
  const mode = modeSel ? modeSel.value : 'descendant';
  const depth = depthSel ? parseInt(depthSel.value) : 3;
  let tree;
  if (mode === 'ancestor') tree = buildAncestorTree(rid, depth);
  else if (mode === 'both') tree = buildAncestorTree(rid, depth);
  else tree = buildDescendantTree(rid, depth);
  wrap.innerHTML = renderTreeSVG(tree, mode);
}

/* ===== Events ===== */
function bindUI() {
  $('#langSelect')?.addEventListener('change', e => setLang(e.target.value));
  $$('.tab-btn').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
  $('#treeRoot')?.addEventListener('change', renderTree);
  $('#treeMode')?.addEventListener('change', renderTree);
  $('#treeDepth')?.addEventListener('change', renderTree);
  $('#labRun')?.addEventListener('click', renderLab);
}

/* ===== Init ===== */
async function loadDemo() {
  try {
    const res = await fetch('data/demo.json');
    const data = await res.json();
    STATE.people = data.people || [];
    STATE.families = data.families || [];
    STATE.meta = data.meta || { root: null, name: '' };
  } catch (e) {
    console.warn('demo.json load failed', e);
  }
}

(async function init() {
  await loadI18n();
  LANG = detectLang();
  await loadDemo();
  bindUI();
  renderAll();
})();

window.zuPu = { setLang, STATE, t, runLab };