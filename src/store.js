// Pure state helpers: no DOM, no fs. Everything here is tested by test.js.

const COLUMNS = [
  { id: 'backlog', name: 'Backlog' },
  { id: 'todo',    name: 'To Do' },
  { id: 'doing',   name: 'In Progress' },
  { id: 'done',    name: 'Done' },
];

// Low gets no stripe at all — the quiet default shouldn't cost you a color.
const PRIORITIES = [
  { id: 1, name: 'High', color: '#844f3b' },
  { id: 2, name: 'Med',  color: '#c9973f' },
  { id: 3, name: 'Low',  color: 'transparent' },
];

const uid = () => Math.random().toString(36).slice(2, 10);

// Local date as YYYY-MM-DD. Not toISOString() — that's UTC and drifts a day.
function today(now = new Date()) {
  return new Date(now.getTime() - now.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
}

const emptyState = () => ({ categories: [], tasks: [] });

const esc = str => String(str).replace(/[&<>"]/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Case-insensitive substring over title, notes and tags. Empty query matches nothing.
function matchesQuery(task, q) {
  const s = (q || '').trim().toLowerCase();
  if (!s) return false;
  return `${task.title} ${task.notes} ${task.tags.join(' ')}`.toLowerCase().includes(s);
}

// HTML-escaped text with every occurrence of `q` wrapped in <mark>.
function markup(text, q) {
  const s = (q || '').trim();
  if (!s) return esc(text);
  let out = '', rest = String(text), i;
  while ((i = rest.toLowerCase().indexOf(s.toLowerCase())) >= 0) {
    out += esc(rest.slice(0, i)) + '<mark>' + esc(rest.slice(i, i + s.length)) + '</mark>';
    rest = rest.slice(i + s.length);
  }
  return out + esc(rest);
}

function addTask(state, fields = {}) {
  const task = {
    id: uid(), title: '', notes: '', priority: 2, due: '',
    tags: [], categoryId: null, column: 'backlog', ...fields,
  };
  return { ...state, tasks: [...state.tasks, task] };
}

function updateTask(state, id, fields) {
  return { ...state, tasks: state.tasks.map(t => (t.id === id ? { ...t, ...fields } : t)) };
}

function updateCategory(state, id, fields) {
  return { ...state, categories: state.categories.map(c => (c.id === id ? { ...c, ...fields } : c)) };
}

const deleteTask = (state, id) => ({ ...state, tasks: state.tasks.filter(t => t.id !== id) });

// Bulk remove by id. The caller passes the ids it can actually see, so clearing a
// filtered column never silently takes tickets that were hidden.
function removeTasks(state, ids) {
  const kill = new Set(ids);
  return { ...state, tasks: state.tasks.filter(t => !kill.has(t.id)) };
}

// Move `id` into `column`, inserted before `beforeId` (null = end of that column).
function moveTask(state, id, column, beforeId = null) {
  const task = state.tasks.find(t => t.id === id);
  if (!task || id === beforeId) return state;
  const rest = state.tasks.filter(t => t.id !== id);
  const moved = { ...task, column };
  let at = beforeId ? rest.findIndex(t => t.id === beforeId) : -1;
  if (at === -1) {
    at = rest.length;
    for (let i = rest.length - 1; i >= 0; i--) {
      if (rest[i].column === column) { at = i + 1; break; }
    }
  }
  rest.splice(at, 0, moved);
  return { ...state, tasks: rest };
}

function addCategory(state, name, color) {
  const cat = { id: uid(), name, color };
  return [{ ...state, categories: [...state.categories, cat] }, cat.id];
}

function deleteCategory(state, id) {
  return {
    categories: state.categories.filter(c => c.id !== id),
    tasks: state.tasks.map(t => (t.categoryId === id ? { ...t, categoryId: null } : t)),
  };
}

const isOverdue = (task, now) => !!task.due && task.column !== 'done' && task.due < today(now);

// filter: { categories: Set|Array, tags: Set|Array } — empty means "no filter".
function visible(tasks, filter = {}) {
  const cats = [...(filter.categories || [])];
  const tags = [...(filter.tags || [])];
  return tasks.filter(t =>
    (!cats.length || cats.includes(t.categoryId)) &&
    (!tags.length || tags.some(tag => t.tags.includes(tag))));
}

const tasksIn = (state, column, filter) =>
  visible(state.tasks, filter).filter(t => t.column === column);

const allTags = state =>
  [...new Set(state.tasks.flatMap(t => t.tags))].sort();

const counts = (state, now) => ({
  doing: state.tasks.filter(t => t.column === 'doing').length,
  overdue: state.tasks.filter(t => isOverdue(t, now)).length,
  done: state.tasks.filter(t => t.column === 'done').length,
});

const parseTags = s =>
  [...new Set(s.split(',').map(x => x.trim()).filter(Boolean))];

if (typeof module !== 'undefined') {
  module.exports = { COLUMNS, PRIORITIES, uid, today, emptyState, addTask, updateTask,
    deleteTask, removeTasks, moveTask, addCategory, updateCategory, deleteCategory, esc, matchesQuery, markup, isOverdue, visible, tasksIn,
    allTags, counts, parseTags };
}
