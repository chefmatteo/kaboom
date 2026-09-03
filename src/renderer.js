const fs = require('fs');
const path = require('path');
const { ipcRenderer } = require('electron');
const {
  COLUMNS, PRIORITIES, today, emptyState, addTask, updateTask, deleteTask,
  removeTasks, moveTask, addCategory, updateCategory, deleteCategory, esc,
  matchesQuery, markup, isOverdue, tasksIn, allTags, counts, parseTags,
} = require('./store.js');

const DATA_DIR = ipcRenderer.sendSync('data-dir');
const FILE = path.join(DATA_DIR, 'tasks.json');
const ARCHIVE = path.join(DATA_DIR, 'archive.json');

function archive(tasks) {
  let prev = [];
  try { prev = JSON.parse(fs.readFileSync(ARCHIVE, 'utf8')); } catch { /* first clear */ }
  const clearedOn = today();
  fs.writeFileSync(ARCHIVE, JSON.stringify([...prev, ...tasks.map(t => ({ ...t, clearedOn }))], null, 2));
}

const $ = id => document.getElementById(id);
const elCounts = $('counts');
const elFilters = $('filters');
const elBoard = $('board');
const dlg = $('editor');
const fTitle = $('title');
const fNotes = $('notes');
const fPriority = $('priority');
const fDue = $('due');
const fTags = $('tags');
const fCategory = $('category');
const fTaglist = $('taglist');
const catForm = $('catform');
const catName = $('catname');
const catColor = $('catcolor');
const elSearch = $('search');
const catsDlg = $('cats');
const catList = $('catlist');

let state = (() => {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { return emptyState(); }
})();
const filter = { categories: new Set(), tags: new Set() };
let editing = null;
let dragId = null;
let query = '';

let timer = null;
function writeNow() {
  clearTimeout(timer);
  timer = null;
  fs.writeFileSync(FILE, JSON.stringify(state, null, 2));
}
function commit(next) {
  state = next;
  clearTimeout(timer);
  timer = setTimeout(writeNow, 300);
  render();
}
addEventListener('beforeunload', () => { if (timer) writeNow(); });

const fmtDue = d => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const toggle = (set, v) => (set.has(v) ? set.delete(v) : set.add(v));

function render() {
  const c = counts(state);
  const hits = query.trim() ? state.tasks.filter(t => matchesQuery(t, query)).length : null;
  elCounts.innerHTML = `<b>${c.doing}</b> in progress · ` +
    (c.overdue ? `<b class="over">${c.overdue}</b> overdue · ` : '') + `<b>${c.done}</b> done` +
    (hits === null ? '' : ` · <span class="hits">${hits} match${hits === 1 ? '' : 'es'}</span>`);
  renderFilters();
  elBoard.replaceChildren(...COLUMNS.map(colEl));
}

function chip(on, html, onclick) {
  const b = document.createElement('button');
  b.className = 'chip' + (on ? ' on' : '');
  b.innerHTML = html;
  b.onclick = onclick;
  return b;
}

function renderFilters() {
  elFilters.replaceChildren();
  for (const cat of state.categories) {
    elFilters.append(chip(filter.categories.has(cat.id),
      `<span class="dot" style="background:${esc(cat.color)}"></span>${esc(cat.name)}`,
      () => { toggle(filter.categories, cat.id); render(); }));
  }

  const tags = allTags(state);
  if (state.categories.length && tags.length) {
    const sep = document.createElement('div');
    sep.className = 'sep';
    elFilters.append(sep);
  }
  for (const tag of tags) {
    elFilters.append(chip(filter.tags.has(tag), esc(tag),
      () => { toggle(filter.tags, tag); render(); }));
  }

  if (filter.categories.size || filter.tags.size) {
    const clear = chip(false, 'clear ×', () => {
      filter.categories.clear();
      filter.tags.clear();
      render();
    });
    clear.classList.add('clear');
    elFilters.append(clear);
  }

  const gear = chip(false, 'categories', openCats);
  gear.classList.add('gear');
  elFilters.append(gear);
}

function colEl(col) {
  const el = document.createElement('div');
  el.className = 'col';
  const shown = tasksIn(state, col.id, filter);

  const h2 = document.createElement('h2');
  const n = document.createElement('span');
  n.className = 'n';
  n.textContent = shown.length;
  h2.append(col.name, n);
  if (col.id === 'done' && shown.length) h2.append(clearDoneBtn(shown));
  el.append(h2);

  const body = document.createElement('div');
  body.className = 'body';
  body.append(...shown.map(cardEl));
  if (!shown.length && !state.tasks.length && col.id === 'backlog') {
    body.innerHTML = '<div class="empty">Nothing here yet — add your first ticket.</div>';
  }

  body.ondragover = e => {
    e.preventDefault();
    body.classList.add('over');
    const before = dropTarget(body, e.clientY);
    body.querySelectorAll('.drop-before').forEach(x => x.classList.remove('drop-before'));
    if (before) before.classList.add('drop-before');
  };
  body.ondragleave = e => { if (!body.contains(e.relatedTarget)) clearDrop(body); };
  body.ondrop = e => {
    e.preventDefault();
    const before = dropTarget(body, e.clientY);
    clearDrop(body);
    if (dragId) commit(moveTask(state, dragId, col.id, before ? before.dataset.id : null));
  };

  const add = document.createElement('button');
  add.className = 'add';
  add.textContent = '+ Add ticket';
  add.onclick = () => openEditor(null, col.id);

  el.append(body, add);
  return el;
}

function clearDoneBtn(shown) {
  const b = document.createElement('button');
  b.className = 'clear-done';
  b.textContent = 'clear';
  b.title = 'Remove these from the board (kept in archive.json)';
  b.onclick = () => {
    const n = shown.length;
    if (!confirm(`Clear ${n} done ticket${n === 1 ? '' : 's'}?\n\nThey leave the board but are kept in archive.json.`)) return;
    archive(shown);
    commit(removeTasks(state, shown.map(t => t.id)));
  };
  return b;
}

const clearDrop = body => {
  body.classList.remove('over');
  body.querySelectorAll('.drop-before').forEach(x => x.classList.remove('drop-before'));
};

const dropTarget = (body, y) =>
  [...body.querySelectorAll('.card:not(.dragging)')]
    .find(c => { const r = c.getBoundingClientRect(); return y < r.top + r.height / 2; }) || null;

function cardEl(t) {
  const el = document.createElement('div');
  el.className = 'card' + (t.column === 'done' ? ' done' : '') +
    (matchesQuery(t, query) ? ' hit' : '');
  el.dataset.id = t.id;
  el.draggable = true;
  el.style.setProperty('--p', PRIORITIES.find(p => p.id === t.priority).color);

  const cat = state.categories.find(c => c.id === t.categoryId);
  el.innerHTML =
    `<div class="title">${markup(t.title, query)}</div><div class="meta">` +
    (cat ? `<span class="cat"><span class="dot" style="background:${esc(cat.color)}"></span>${esc(cat.name)}</span>` : '') +
    (t.due ? `<span class="due${isOverdue(t) ? ' overdue' : ''}">${fmtDue(t.due)}</span>` : '') +
    t.tags.map(x => `<span class="tag">${markup(x, query)}</span>`).join('') +
    (t.notes.trim() ? '<span class="note-mark">≡</span>' : '') + '</div>';

  el.onclick = () => openEditor(t);
  el.ondragstart = e => { dragId = t.id; el.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; };
  el.ondragend = () => { dragId = null; render(); };
  return el;
}

fPriority.innerHTML = PRIORITIES.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

function openEditor(t, column = 'backlog') {
  editing = t ? { ...t } : { column };
  fTitle.value = t ? t.title : '';
  fNotes.value = t ? t.notes : '';
  fPriority.value = t ? t.priority : 2;
  fDue.value = t ? t.due : '';
  fTags.value = t ? t.tags.join(', ') : '';
  fTaglist.innerHTML = allTags(state).map(x => `<option value="${esc(x)}">`).join('');
  fillCats(t ? t.categoryId : null);
  catForm.classList.add('hidden');
  $('del').style.visibility = t ? 'visible' : 'hidden';
  dlg.showModal();
  fTitle.focus();
}

function fillCats(selected) {
  fCategory.innerHTML = '<option value="">— none —</option>' +
    state.categories.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  fCategory.value = selected || '';
}

$('newcat').onclick = () => { catForm.classList.toggle('hidden'); catName.focus(); };
$('catadd').onclick = () => {
  const name = catName.value.trim();
  if (!name) return catName.focus();
  const [next, id] = addCategory(state, name, catColor.value);
  commit(next);
  fillCats(id);
  catName.value = '';
  catForm.classList.add('hidden');
};

$('form').onsubmit = e => {
  e.preventDefault();
  const fields = {
    title: fTitle.value.trim(),
    notes: fNotes.value,
    priority: +fPriority.value,
    due: fDue.value,
    tags: parseTags(fTags.value),
    categoryId: fCategory.value || null,
  };
  commit(editing.id ? updateTask(state, editing.id, fields)
                    : addTask(state, { ...fields, column: editing.column }));
  dlg.close();
};
$('del').onclick = () => {
  if (editing.id && confirm(`Delete "${editing.title}"?`)) {
    commit(deleteTask(state, editing.id));
    dlg.close();
  }
};
$('cancel').onclick = () => dlg.close();

elSearch.oninput = () => { query = elSearch.value; render(); };
elSearch.onkeydown = e => {
  if (e.key === 'Escape') { elSearch.value = ''; query = ''; render(); elSearch.blur(); }
};

function openCats() { renderCats(); catsDlg.showModal(); }

function renderCats() {
  catList.replaceChildren(...state.categories.map(c => {
    const row = document.createElement('div');
    row.className = 'catrow';

    const color = document.createElement('input');
    color.type = 'color';
    color.value = c.color;
    color.onchange = () => commit(updateCategory(state, c.id, { color: color.value }));

    const name = document.createElement('input');
    name.value = c.name;
    name.onchange = () => commit(updateCategory(state, c.id, { name: name.value.trim() || c.name }));

    const kill = document.createElement('button');
    kill.className = 'kill';
    kill.textContent = '×';
    kill.title = 'Delete category';
    kill.onclick = () => {
      const n = state.tasks.filter(t => t.categoryId === c.id).length;
      if (!confirm(`Delete "${c.name}"?` + (n ? ` ${n} ticket${n === 1 ? '' : 's'} will keep their titles but lose the category.` : ''))) return;
      filter.categories.delete(c.id);
      commit(deleteCategory(state, c.id));
      renderCats();
    };

    row.append(color, name, kill);
    return row;
  }));
  if (!state.categories.length) {
    catList.innerHTML = '<div class="empty">No categories yet — create one while editing a ticket.</div>';
  }
}

const newCatName = $('newcatname');
const newCatColor = $('newcatcolor');
function addCatFromManager() {
  const name = newCatName.value.trim();
  if (!name) return newCatName.focus();
  const [next] = addCategory(state, name, newCatColor.value);
  commit(next);
  newCatName.value = '';
  renderCats();
  newCatName.focus();
}
$('newcatadd').onclick = addCatFromManager;
newCatName.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); addCatFromManager(); } };

$('catsclose').onclick = () => catsDlg.close();
$('newBtn').onclick = () => openEditor(null);
addEventListener('keydown', e => {
  if (!(e.metaKey || e.ctrlKey)) return;
  const k = e.key.toLowerCase();
  if (k === 'n') { e.preventDefault(); openEditor(null); }
  if (k === 'f') { e.preventDefault(); elSearch.focus(); elSearch.select(); }
});

render();
