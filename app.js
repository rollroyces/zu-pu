/* 族譜 — Vanilla HTML/CSS/JS
   資料儲存在 localStorage，預設載入範例（張氏家族）。
   支援 GEDCOM 5.5.1 匯入匯出。
*/

const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const STORAGE_KEY = 'zu-pu-v1';

let DB = { _meta: { source: 'demo', version: 1, title: '族譜' }, people: {} };
let STATE = {
  view: 'tree',
  tree: { rootId: null, mode: 'ancestor', gen: 3 },
  selectedId: null,
  ioMessage: '',
};

const fmtDate = (d) => {
  if (!d) return '';
  const y = d.year || '?';
  const m = d.month ? String(d.month).padStart(2, '0') : '';
  const day = d.day ? String(d.day).padStart(2, '0') : '';
  if (m && day) return `${y}-${m}-${day}`;
  if (m) return `${y}-${m}`;
  return `${y}`;
};
const fmtDateRange = (p) => {
  const b = fmtDate(p.birth), d = fmtDate(p.death);
  if (b && d) return `${b} → ${d}`;
  if (b) return `${b} →`;
  if (d) return `→ ${d}`;
  return '—';
};
const ageAt = (p) => {
  if (!p.birth || !p.birth.year) return null;
  const end = (p.death && p.death.year) || new Date().getFullYear();
  return end - p.birth.year;
};
const isAlive = (p) => !p.death || !p.death.year;
const isMale = (p) => p.gender === 'M';
const isFemale = (p) => p.gender === 'F';
const isUnknown = (p) => p.gender === 'U' || !p.gender;
const person = (id) => DB.people[id] || null;
const allIds = () => Object.keys(DB.people);

/* 衍生關係 */
function getParents(id) {
  const p = person(id);
  if (!p) return [];
  return (p.parents || []).map(person).filter(Boolean);
}
function getFather(id) {
  const ps = getParents(id);
  return ps.find(isMale) || ps[0] || null;
}
function getMother(id) {
  const ps = getParents(id);
  return ps.find(isFemale) || ps[1] || null;
}
function getChildren(id) {
  const out = [];
  for (const pid of allIds()) {
    const p = person(pid);
    if ((p.parents || []).includes(id)) out.push(p);
  }
  return out;
}
function getSiblings(id) {
  const p = person(id);
  if (!p || !(p.parents && p.parents.length)) return [];
  const parents = new Set(p.parents);
  return allIds()
    .filter(pid => pid !== id)
    .map(person)
    .filter(o => (o.parents || []).some(x => parents.has(x)));
}
function getSpouses(id) {
  const p = person(id);
  if (!p) return [];
  return (p.spouses || []).map(person).filter(Boolean);
}
function getGrandparents(id) {
  const ps = getParents(id);
  return ps.flatMap(p => getParents(p.id));
}
function getSiblingsHalf(id, sharedParent) {
  const p = person(id);
  if (!p) return [];
  return allIds()
    .filter(pid => pid !== id)
    .map(person)
    .filter(o => (o.parents || []).includes(sharedParent));
}
function genLabel(p) {
  if (!p.birth || !p.birth.year) return '?';
  const years = allIds().map(id => person(id).birth?.year).filter(Boolean);
  const minYear = Math.min(...years);
  return Math.floor((p.birth.year - minYear) / 30) + 1;
}

/* 搜尋 */
function search(q) {
  if (!q) return [];
  const lq = q.toLowerCase();
  return allIds()
    .map(person)
    .filter(p => {
      const blob = [p.name, p.nameEn, p.birthPlace, p.deathPlace, p.notes].join(' ').toLowerCase();
      return blob.includes(lq);
    });
}

/* 載入與儲存 */
async function loadData() {
  const cached = localStorage.getItem(STORAGE_KEY);
  if (cached) {
    try {
      DB = JSON.parse(cached);
      return;
    } catch (e) {}
  }
  const res = await fetch('data/demo.json');
  DB = await res.json();
  saveData();
}
function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DB));
}
function resetToDemo() {
  if (!confirm('確定要重置為範例資料嗎？這會覆蓋你目前的編輯。')) return;
  fetch('data/demo.json').then(r => r.json()).then(d => {
    DB = d; saveData(); toast('已重置為範例資料'); renderAll();
  });
}
function clearAll() {
  if (!confirm('確定要清空所有資料嗎？此操作無法復原。')) return;
  DB = { _meta: { source: 'empty', version: 1, title: '族譜' }, people: {} };
  saveData(); renderAll(); toast('已清空全部');
}

/* 路由 */
function setView(name) {
  STATE.view = name;
  $$('.view').forEach(v => v.classList.remove('active'));
  $$('.navbtn').forEach(b => b.classList.remove('active'));
  $(`#view${name[0].toUpperCase()+name.slice(1)}`)?.classList.add('active');
  $(`.navbtn[data-view="${name}"]`)?.classList.add('active');
  if (name === 'tree') renderTree();
  if (name === 'list') renderList();
  if (name === 'timeline') renderTimeline();
}
function setTreeRoot(id) {
  STATE.tree.rootId = id;
  if (STATE.view === 'tree') renderTree();
}

/* Toast */
let toastTimer = null;
function toast(msg, ms=2200) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}

/* === 族譜樹 === */
function renderTree() {
  const canvas = $('#treeCanvas');
  canvas.innerHTML = '';
  const sel = $('#treeRoot');
  if (sel.children.length === 0) {
    const sorted = allIds().map(person).sort((a, b) => (a.birth?.year || 9999) - (b.birth?.year || 9999));
    for (const p of sorted) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.name}${p.birth?.year ? ' ('+p.birth.year+')' : ''}`;
      sel.appendChild(opt);
    }
  }
  if (!STATE.tree.rootId) STATE.tree.rootId = allIds()[0];
  if (STATE.tree.rootId) sel.value = STATE.tree.rootId;
  if (!person(STATE.tree.rootId)) {
    canvas.innerHTML = '<div class="tree-empty">請選擇一個人物作為中心</div>';
    return;
  }

  const mode = STATE.tree.mode;
  const gen = STATE.tree.gen;
  if (mode === 'ancestor') renderAncestorTree(canvas, STATE.tree.rootId, gen);
  else if (mode === 'descendant') renderDescendantTree(canvas, STATE.tree.rootId, gen);
  else renderBothTree(canvas, STATE.tree.rootId, gen);
}

function getAncestorLayout(rootId, maxGen) {
  const nodes = [];
  const linkParentChild = [];
  function recurse(id, gen, xSlot) {
    if (!id) return;
    if (gen > maxGen) return;
    if (nodes.find(n => n.id === id)) return;
    nodes.push({ id, gen, xSlot });
    if (gen < maxGen) {
      const ps = getParents(id);
      const slotWidth = Math.pow(2, maxGen - gen - 1);
      recurse(ps[0] ? ps[0].id : null, gen + 1, xSlot);
      recurse(ps[1] ? ps[1].id : null, gen + 1, xSlot + slotWidth);
      if (ps[0]) linkParentChild.push([{gen: gen+1, xSlot: xSlot}, {gen, xSlot}]);
      if (ps[1]) linkParentChild.push([{gen: gen+1, xSlot: xSlot + slotWidth}, {gen, xSlot}]);
    }
  }
  recurse(rootId, 0, Math.pow(2, maxGen) / 2 - 0.5);
  return { nodes, linkParentChild, totalSlots: Math.pow(2, maxGen) };
}

function renderAncestorTree(canvas, rootId, maxGen) {
  const layout = getAncestorLayout(rootId, maxGen);
  const slots = layout.totalSlots;
  const slotW = 200;
  const rowH = 120;
  const marginX = 30;
  const marginY = 30;
  const w = marginX * 2 + slots * slotW;
  const h = marginY * 2 + (maxGen + 1) * rowH;
  const svg = svgEl('svg', { viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: 'xMidYMid meet', width: '100%' });
  for (const [from, to] of layout.linkParentChild) {
    if (!layout.nodes.find(n => n.xSlot === to.xSlot && n.gen === to.gen)) continue;
    if (!layout.nodes.find(n => n.xSlot === from.xSlot && n.gen === from.gen)) continue;
    const fx = marginX + from.xSlot * slotW + slotW / 2;
    const fy = marginY + from.gen * rowH + 40;
    const tx = marginX + to.xSlot * slotW + slotW / 2;
    const ty = marginY + to.gen * rowH + 90;
    svgEl('path', {
      d: `M ${fx} ${fy} L ${fx} ${fy + (ty - fy) / 2} L ${tx} ${fy + (ty - fy) / 2} L ${tx} ${ty}`,
      class: 'tree-link'
    }, svg);
  }
  for (const n of layout.nodes) {
    const p = person(n.id);
    if (!p) continue;
    const x = marginX + n.xSlot * slotW;
    const y = marginY + n.gen * rowH;
    drawPersonNode(svg, p, x, y, slotW - 8, 80, n.id === STATE.selectedId);
  }
  canvas.appendChild(svg);
}

function renderDescendantTree(canvas, rootId, maxGen) {
  const nodes = [{ id: rootId, gen: 0 }];
  const edges = [];
  function recurse(id, gen) {
    if (gen >= maxGen) return;
    const kids = getChildren(id).sort((a, b) => {
      if (a.gender !== b.gender) return a.gender === 'F' ? 1 : -1;
      return (a.birth?.year || 0) - (b.birth?.year || 0);
    });
    for (const k of kids) {
      nodes.push({ id: k.id, gen: gen + 1 });
      edges.push({ parentId: id, childId: k.id });
      recurse(k.id, gen + 1);
    }
  }
  recurse(rootId, 0);
  const genCounts = [];
  for (let g = 0; g <= maxGen; g++) {
    genCounts.push(nodes.filter(n => n.gen === g).length);
  }
  const maxInGen = Math.max(...genCounts, 1);
  const slotW = 220;
  const rowH = 110;
  const marginX = 30;
  const marginY = 30;
  const totalW = marginX * 2 + maxInGen * slotW;
  const totalH = marginY * 2 + (maxGen + 1) * rowH;
  const genOffsets = [];
  for (let g = 0; g <= maxGen; g++) {
    const count = genCounts[g];
    genOffsets.push((maxInGen - count) * slotW / 2);
  }
  const nodePos = {};
  for (let g = 0; g <= maxGen; g++) {
    const inGen = nodes.filter(n => n.gen === g);
    inGen.forEach((n, i) => {
      nodePos[n.id] = { x: marginX + genOffsets[g] + i * slotW, y: marginY + g * rowH };
    });
  }
  const spouseEdges = [];
  for (const n of nodes) {
    const p = person(n.id);
    if (!p) continue;
    for (const sp of p.spouses || []) {
      if (nodePos[sp] && !spouseEdges.find(e => (e.a === sp && e.b === n.id))) {
        spouseEdges.push({ a: n.id, b: sp });
      }
    }
  }
  const svg = svgEl('svg', { viewBox: `0 0 ${totalW} ${totalH}`, preserveAspectRatio: 'xMidYMid meet', width: '100%' });
  for (const e of edges) {
    const a = nodePos[e.parentId], b = nodePos[e.childId];
    if (!a || !b) continue;
    const fx = a.x + slotW / 2, fy = a.y + 80;
    const tx = b.x + slotW / 2, ty = b.y;
    svgEl('path', {
      d: `M ${fx} ${fy} L ${fx} ${fy + (ty - fy) / 2} L ${tx} ${fy + (ty - fy) / 2} L ${tx} ${ty}`,
      class: 'tree-link'
    }, svg);
  }
  for (const e of spouseEdges) {
    const a = nodePos[e.a], b = nodePos[e.b];
    if (!a || !b) continue;
    svgEl('line', {
      x1: a.x + slotW, y1: a.y + 40,
      x2: b.x, y2: b.y + 40,
      class: 'tree-link spouse'
    }, svg);
  }
  for (const n of nodes) {
    const p = person(n.id);
    if (!p) continue;
    const pos = nodePos[n.id];
    drawPersonNode(svg, p, pos.x, pos.y, slotW - 8, 80, n.id === STATE.selectedId);
  }
  canvas.appendChild(svg);
}

function renderBothTree(canvas, rootId, maxGen) {
  const halfGen = Math.max(1, Math.floor(maxGen / 2));
  renderAncestorTree(canvas, rootId, halfGen);
}

function drawPersonNode(svg, p, x, y, w, h, selected) {
  const g = svgEl('g', { class: 'tree-node' + (selected ? ' selected' : '') + (isAlive(p) ? '' : ' deceased'), transform: `translate(${x}, ${y})` }, svg);
  g.addEventListener('click', () => { STATE.selectedId = p.id; showPerson(p.id); });
  const genderClass = isMale(p) ? 'node-m' : isFemale(p) ? 'node-f' : 'node-u';
  const stroke = isMale(p) ? '#4a6da8' : isFemale(p) ? '#b86998' : '#c2b693';
  const aliveOpacity = isAlive(p) ? 1 : 0.55;
  svgEl('rect', {
    class: 'node-rect ' + genderClass,
    x: 0, y: 0, width: w, height: h,
    rx: 8, ry: 8,
    fill: '#faf6ec',
    stroke: stroke,
    'stroke-width': 1.5,
    opacity: aliveOpacity,
  }, g);
  const nameY = 24;
  const nameEl = svgEl('text', { class: 'node-name', x: 12, y: nameY, fill: '#2a2218' }, g);
  nameEl.textContent = p.name;
  if (p.nameEn) {
    const en = svgEl('text', { class: 'node-en', x: 12, y: nameY + 16, fill: '#8b7e64' }, g);
    en.textContent = p.nameEn;
  }
  const lifeY = h - 14;
  const lifeText = `${fmtDate(p.birth)} – ${p.death ? fmtDate(p.death) : ''}`;
  const life = svgEl('text', { class: 'node-life', x: 12, y: lifeY, fill: '#8b7e64' }, g);
  life.textContent = lifeText;
  svgEl('circle', { class: 'node-dot ' + genderClass, cx: w - 14, cy: 14, r: 5, fill: stroke, opacity: aliveOpacity }, g);
}

function svgEl(tag, attrs, parent) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const k in attrs) {
    if (Object.prototype.hasOwnProperty.call(attrs, k)) {
      const v = attrs[k];
      if (v !== undefined && v !== null) el.setAttribute(k, String(v));
    }
  }
  if (parent) parent.appendChild(el);
  return el;
}

/* === 名冊 === */
function renderList() {
  const container = $('#listContainer');
  const q = ($('#listSearch').value || '').toLowerCase();
  const sort = $('#listSort').value;
  let list = allIds().map(person);
  if (q) {
    list = list.filter(p => {
      const blob = [p.name, p.nameEn, p.birthPlace, p.deathPlace, p.notes].join(' ').toLowerCase();
      return blob.includes(q);
    });
  }
  if (sort === 'name') {
    list.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
  } else if (sort === 'birthAsc') {
    list.sort((a, b) => (a.birth?.year || 9999) - (b.birth?.year || 9999));
  } else if (sort === 'birthDesc') {
    list.sort((a, b) => (b.birth?.year || 0) - (a.birth?.year || 0));
  } else {
    list.sort((a, b) => genLabel(a) - genLabel(b) || (a.birth?.year || 0) - (b.birth?.year || 0));
  }
  container.innerHTML = '';
  if (list.length === 0) {
    container.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--fg-3);">沒有符合的人</div>';
    return;
  }
  for (const p of list) {
    const card = document.createElement('div');
    const classes = ['list-card', p.gender || 'U'];
    if (!isAlive(p)) classes.push('deceased');
    card.className = classes.join(' ');
    card.innerHTML = `
      <div class="lc-name">${escapeHtml(p.name)}${p.nameEn ? ` <span style="color:var(--fg-3);font-size:12px;font-weight:400;">${escapeHtml(p.nameEn)}</span>` : ''}</div>
      <div class="lc-meta">${fmtDateRange(p)}${p.birthPlace ? ' · '+escapeHtml(p.birthPlace) : ''}</div>
    `;
    card.addEventListener('click', () => showPerson(p.id));
    container.appendChild(card);
  }
}

function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

/* === 時間軸 === */
function renderTimeline() {
  const canvas = $('#tlCanvas');
  canvas.innerHTML = '';
  const mode = $('#tlMode').value;
  const events = [];
  for (const p of allIds().map(person)) {
    if (p.birth?.year && (mode === 'birth' || mode === 'both')) {
      events.push({ year: p.birth.year, type: 'birth', person: p });
    }
    if (p.death?.year && (mode === 'death' || mode === 'both')) {
      events.push({ year: p.death.year, type: 'death', person: p });
    }
  }
  events.sort((a, b) => a.year - b.year);
  if (events.length === 0) {
    canvas.innerHTML = '<div class="tree-empty">沒有事件</div>';
    return;
  }
  let lastYear = -1;
  for (const e of events) {
    if (e.year !== lastYear) {
      const yr = document.createElement('div');
      yr.className = 'tl-row';
      yr.innerHTML = `<div class="tl-year">${e.year}</div><div style="flex:1;display:flex;flex-direction:column;gap:2px;"></div>`;
      canvas.appendChild(yr);
      lastYear = e.year;
    }
    const lastRow = canvas.lastElementChild;
    const container = lastRow.lastElementChild;
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:2px 0;';
    row.innerHTML = `
      <span class="tl-dot ${e.type}"></span>
      <span class="tl-name">${escapeHtml(e.person.name)}</span>
      <span style="color:var(--fg-3);font-size:12px;">${e.type === 'birth' ? '出生' : '逝世'}</span>
    `;
    row.querySelector('.tl-name').addEventListener('click', () => showPerson(e.person.id));
    container.appendChild(row);
  }
}

/* === 人物詳情 === */
function showPerson(id) {
  const p = person(id);
  if (!p) return;
  STATE.selectedId = id;
  $('#pmTitle').textContent = p.name;
  const body = $('#pmBody');
  body.innerHTML = '';
  const sec1 = document.createElement('div');
  sec1.className = 'pm-section';
  sec1.innerHTML = `<h4>基本資料</h4>
    <div class="pm-grid">
      <div class="pm-kv"><span>性別</span><b>${p.gender === 'M' ? '男' : p.gender === 'F' ? '女' : '未知'}</b></div>
      <div class="pm-kv"><span>享年</span><b>${ageAt(p) ?? '—'} ${!isAlive(p) ? '（已故）' : ''}</b></div>
      <div class="pm-kv"><span>出生</span><b>${fmtDate(p.birth) || '—'}${p.birthPlace ? ' · '+escapeHtml(p.birthPlace) : ''}</b></div>
      <div class="pm-kv"><span>逝世</span><b>${fmtDate(p.death) || '—'}${p.deathPlace ? ' · '+escapeHtml(p.deathPlace) : ''}</b></div>
      <div class="pm-kv"><span>世代</span><b>第 ${genLabel(p)} 世</b></div>
      <div class="pm-kv"><span>子女數</span><b>${getChildren(p.id).length}</b></div>
    </div>
    ${p.notes ? `<p style="margin-top:10px;color:var(--fg-2);font-size:14px;line-height:1.7;">${escapeHtml(p.notes)}</p>` : ''}
  `;
  body.appendChild(sec1);

  const sec2 = document.createElement('div');
  sec2.className = 'pm-section';
  const rels = [];
  const father = getFather(p.id), mother = getMother(p.id);
  if (father) rels.push({ kind: 'father', label: '父', p: father });
  if (mother) rels.push({ kind: 'mother', label: '母', p: mother });
  for (const s of getSiblings(p.id)) rels.push({ kind: 'sibling', label: isMale(s) ? '兄弟' : '姊妹', p: s });
  for (const sp of getSpouses(p.id)) rels.push({ kind: 'spouse', label: isMale(sp) ? '夫' : '妻', p: sp });
  for (const c of getChildren(p.id)) rels.push({ kind: 'child', label: isMale(c) ? '子' : '女', p: c });
  if (rels.length) {
    sec2.innerHTML = `<h4>關係</h4><div class="pm-rels">${rels.map(r =>
      `<span class="pm-rel ${r.kind}" data-id="${r.p.id}">${r.label} · ${escapeHtml(r.p.name)}</span>`
    ).join('')}</div>`;
    sec2.querySelectorAll('.pm-rel').forEach(el => {
      el.addEventListener('click', () => { STATE.selectedId = el.dataset.id; showPerson(el.dataset.id); });
    });
    body.appendChild(sec2);
  }

  $('#personModal').hidden = false;
  if (STATE.view === 'tree') renderTree();
}

function openEditModal(id) {
  const isNew = !id;
  const p = id ? person(id) : { id: null, name: '', nameEn: '', gender: 'M', birth: {}, death: {}, birthPlace: '', deathPlace: '', notes: '', parents: [], spouses: [] };
  $('#emTitle').textContent = isNew ? '新增人物' : `編輯：${p.name}`;
  $('#emForm').reset();
  const allSorted = allIds().map(person).sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
  const p1 = $('#emForm [name="parent1"]'), p2 = $('#emForm [name="parent2"]');
  p1.innerHTML = '<option value="">— 無 —</option>' + allSorted.map(o => `<option value="${o.id}">${escapeHtml(o.name)}</option>`).join('');
  p2.innerHTML = '<option value="">— 無 —</option>' + allSorted.map(o => `<option value="${o.id}">${escapeHtml(o.name)}</option>`).join('');
  const sp = $('#emForm [name="spouses"]');
  sp.innerHTML = allSorted.map(o => `<option value="${o.id}">${escapeHtml(o.name)}</option>`).join('');
  if (!isNew) {
    const f = $('#emForm');
    f.name.value = p.name || '';
    f.nameEn.value = p.nameEn || '';
    f.gender.value = p.gender || 'M';
    f.birthYear.value = p.birth?.year || '';
    f.birthMonth.value = p.birth?.month || '';
    f.birthDay.value = p.birth?.day || '';
    f.birthPlace.value = p.birthPlace || '';
    f.deathYear.value = p.death?.year || '';
    f.deathMonth.value = p.death?.month || '';
    f.deathDay.value = p.death?.day || '';
    f.deathPlace.value = p.deathPlace || '';
    f.notes.value = p.notes || '';
    if (p.parents?.[0]) p1.value = p.parents[0];
    if (p.parents?.[1]) p2.value = p.parents[1];
    for (const s of (p.spouses || [])) {
      const opt = Array.from(sp.options).find(o => o.value === s);
      if (opt) opt.selected = true;
    }
  }
  if (id) {
    [p1, p2, sp].forEach(sel => {
      const opt = sel.querySelector(`option[value="${id}"]`);
      if (opt) opt.remove();
    });
  }
  $('#editModal').dataset.editId = id || '';
  $('#editModal').hidden = false;
}

function savePerson(e) {
  e.preventDefault();
  const f = $('#emForm');
  const id = $('#editModal').dataset.editId;
  const data = {
    name: f.name.value.trim(),
    nameEn: f.nameEn.value.trim(),
    gender: f.gender.value,
    birth: f.birthYear.value ? { year: +f.birthYear.value, month: +f.birthMonth.value || null, day: +f.birthDay.value || null } : null,
    death: f.deathYear.value ? { year: +f.deathYear.value, month: +f.deathMonth.value || null, day: +f.deathDay.value || null } : null,
    birthPlace: f.birthPlace.value.trim(),
    deathPlace: f.deathPlace.value.trim(),
    notes: f.notes.value.trim(),
    parents: [f.parent1.value, f.parent2.value].filter(Boolean),
    spouses: Array.from(f.spouses.selectedOptions).map(o => o.value),
  };
  if (!data.name) { toast('請填姓名'); return; }
  let newId = id;
  if (id) {
    Object.assign(person(id), data);
  } else {
    newId = 'p' + Date.now();
    data.id = newId;
    DB.people[newId] = data;
  }
  for (const spId of data.spouses) {
    const sp = person(spId);
    if (sp && !sp.spouses.includes(newId)) sp.spouses.push(newId);
  }
  if (id) {
    const old = person(id);
    for (const spId of (old?.spouses || [])) {
      if (!data.spouses.includes(spId)) {
        const sp = person(spId);
        if (sp) sp.spouses = sp.spouses.filter(x => x !== id);
      }
    }
  }
  saveData();
  $('#editModal').hidden = true;
  $('#personModal').hidden = true;
  STATE.selectedId = newId;
  toast(id ? '已更新' : '已新增');
  renderAll();
}

function deletePerson(id) {
  if (!confirm(`刪除「${person(id)?.name}」？此操作無法復原。`)) return;
  for (const spId of person(id).spouses || []) {
    const sp = person(spId);
    if (sp) sp.spouses = sp.spouses.filter(x => x !== id);
  }
  for (const pid of allIds()) {
    const p = person(pid);
    if (p.parents) p.parents = p.parents.filter(x => x !== id);
  }
  delete DB.people[id];
  saveData();
  $('#personModal').hidden = true;
  toast('已刪除');
  renderAll();
}

/* === GEDCOM === */
function exportGedcom() {
  if (!window.Gedcom) { toast('GEDCOM 模組未載入'); return; }
  const ged = window.Gedcom.export(DB);
  const blob = new Blob([ged], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${DB._meta?.title || 'zu-pu'}.ged`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setIoMsg(`已匯出 ${allIds().length} 人`, 'ok');
}

function importGedcom(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const text = e.target.result;
      if (!window.Gedcom) { setIoMsg('GEDCOM 模組未載入', 'err'); return; }
      const result = window.Gedcom.import(text);
      if (!result || !result.people) { setIoMsg('檔案無法解析', 'err'); return; }
      if (!confirm(`偵測到 ${Object.keys(result.people).length} 人。匯入將覆蓋目前資料，確定？`)) return;
      DB = { _meta: { source: 'gedcom', version: 1, title: result.title || '匯入族譜' }, people: result.people };
      saveData();
      setIoMsg(`成功匯入 ${Object.keys(DB.people).length} 人`, 'ok');
      renderAll();
    } catch (err) {
      console.error(err);
      setIoMsg('匯入失敗：' + err.message, 'err');
    }
  };
  reader.readAsText(file);
}
function setIoMsg(msg, kind) {
  const el = $('#ioMsg');
  el.textContent = msg;
  el.className = 'io-msg' + (kind ? ' ' + kind : '');
}

/* === wire === */
function wire() {
  $$('.navbtn').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
  $('#treeRoot').addEventListener('change', e => setTreeRoot(e.target.value));
  $$('.seg[data-group="treeMode"] .seg-btn').forEach(b => b.addEventListener('click', () => {
    $$('.seg[data-group="treeMode"] .seg-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    STATE.tree.mode = b.dataset.val;
    renderTree();
  }));
  $$('.seg[data-group="treeGen"] .seg-btn').forEach(b => b.addEventListener('click', () => {
    $$('.seg[data-group="treeGen"] .seg-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    STATE.tree.gen = +b.dataset.val;
    renderTree();
  }));
  $('#listSearch').addEventListener('input', renderList);
  $('#listSort').addEventListener('change', renderList);
  $('#tlMode').addEventListener('change', renderTimeline);

  $('#btnSearch').addEventListener('click', () => {
    $('#searchInput').value = '';
    $('#searchResults').innerHTML = '';
    $('#searchModal').hidden = false;
    $('#searchInput').focus();
  });
  $('#searchInput').addEventListener('input', (e) => {
    const q = e.target.value.trim();
    const res = search(q);
    const cont = $('#searchResults');
    if (!q) { cont.innerHTML = ''; return; }
    cont.innerHTML = res.slice(0, 30).map(p =>
      `<span class="pm-rel" data-id="${p.id}">${escapeHtml(p.name)}${p.birth?.year ? ' ('+p.birth.year+')' : ''}${p.notes ? ' — '+escapeHtml(p.notes.slice(0,30)) : ''}</span>`
    ).join('') || '<div style="color:var(--fg-3);padding:8px;">沒有符合</div>';
    cont.querySelectorAll('.pm-rel').forEach(el => el.addEventListener('click', () => {
      $('#searchModal').hidden = true;
      showPerson(el.dataset.id);
    }));
  });
  $('#searchClose').addEventListener('click', () => $('#searchModal').hidden = true);

  $('#btnAdd').addEventListener('click', () => openEditModal(null));
  $('#pmEdit').addEventListener('click', () => {
    if (!STATE.selectedId) return;
    openEditModal(STATE.selectedId);
  });
  $('#pmDelete').addEventListener('click', () => {
    if (STATE.selectedId) deletePerson(STATE.selectedId);
  });
  $('#pmClose').addEventListener('click', () => $('#personModal').hidden = true);
  $('#emCancel').addEventListener('click', () => $('#editModal').hidden = true);
  $('#emForm').addEventListener('submit', savePerson);

  $('#btnIO').addEventListener('click', () => { $('#ioModal').hidden = false; $('#ioMsg').textContent = ''; });
  $('#ioClose').addEventListener('click', () => $('#ioModal').hidden = true);
  $('#btnImport').addEventListener('click', () => $('#fileImport').click());
  $('#fileImport').addEventListener('change', (e) => {
    if (e.target.files[0]) importGedcom(e.target.files[0]);
  });
  $('#btnExport').addEventListener('click', exportGedcom);
  $('#btnReset').addEventListener('click', resetToDemo);
  $('#btnClear').addEventListener('click', clearAll);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      $$('.modal').forEach(m => m.hidden = true);
    }
  });
}

function renderAll() {
  if (STATE.tree.rootId && !person(STATE.tree.rootId)) {
    STATE.tree.rootId = allIds()[0] || null;
  }
  $('#treeRoot').innerHTML = '';
  renderTree();
  if (STATE.view === 'list') renderList();
  if (STATE.view === 'timeline') renderTimeline();
  if (STATE.selectedId && !person(STATE.selectedId)) {
    $('#personModal').hidden = true;
  }
}

async function init() {
  await loadData();
  wire();
  setView('tree');
}
init();
