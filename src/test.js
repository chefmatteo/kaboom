// node test.js — fails loudly if the state helpers lose, duplicate, or misorder a ticket.
const assert = require('assert');
const S = require('./store.js');

const ids = s => s.tasks.map(t => t.id);
const col = (s, c) => s.tasks.filter(t => t.column === c).map(t => t.title);

// build a board: a,b in todo; c in doing
let s = S.emptyState();
['a', 'b'].forEach(t => { s = S.addTask(s, { title: t, column: 'todo' }); });
s = S.addTask(s, { title: 'c', column: 'doing' });
const [a, b, c] = ids(s);

// --- move across columns, to the end
let m = S.moveTask(s, a, 'doing');
assert.deepStrictEqual(col(m, 'doing'), ['c', 'a'], 'cross-column move lands at end');
assert.deepStrictEqual(col(m, 'todo'), ['b']);
assert.strictEqual(m.tasks.length, 3, 'no ticket lost or duplicated');

// --- move across columns, before a specific card
m = S.moveTask(s, a, 'doing', c);
assert.deepStrictEqual(col(m, 'doing'), ['a', 'c'], 'beforeId inserts ahead of target');

// --- reorder within a column
m = S.moveTask(s, b, 'todo', a);
assert.deepStrictEqual(col(m, 'todo'), ['b', 'a'], 'within-column reorder');
assert.strictEqual(m.tasks.length, 3);

// --- no-ops stay no-ops
assert.deepStrictEqual(ids(S.moveTask(s, a, 'todo', a)), ids(s), 'dropping on itself changes nothing');
assert.deepStrictEqual(ids(S.moveTask(s, 'nope', 'todo')), ids(s), 'unknown id changes nothing');

// --- move into an empty column
m = S.moveTask(s, a, 'done');
assert.deepStrictEqual(col(m, 'done'), ['a'], 'empty column accepts a drop');
assert.strictEqual(m.tasks.length, 3);

// --- input is never mutated
assert.deepStrictEqual(col(s, 'todo'), ['a', 'b'], 'moveTask does not mutate its input');

// --- delete
assert.strictEqual(S.deleteTask(s, a).tasks.length, 2);

// --- categories: deleting one orphans its tasks rather than deleting them
let [s2, catId] = S.addCategory(s, 'Study', '#5b8def');
s2 = S.updateTask(s2, a, { categoryId: catId });
s2 = S.deleteCategory(s2, catId);
assert.strictEqual(s2.categories.length, 0);
assert.strictEqual(s2.tasks.length, 3, 'deleting a category keeps its tickets');
assert.strictEqual(s2.tasks.find(t => t.id === a).categoryId, null, 'and clears the dead reference');

// --- filtering
let f = S.emptyState();
let catA, catB;
[f, catA] = S.addCategory(f, 'Work', '#111');
[f, catB] = S.addCategory(f, 'Home', '#222');
f = S.addTask(f, { title: 'w', column: 'todo', categoryId: catA, tags: ['urgent'] });
f = S.addTask(f, { title: 'h', column: 'todo', categoryId: catB, tags: ['later'] });
f = S.addTask(f, { title: 'x', column: 'todo', tags: ['urgent', 'later'] });
assert.strictEqual(S.tasksIn(f, 'todo', {}).length, 3, 'no filter shows everything');
assert.deepStrictEqual(S.tasksIn(f, 'todo', { categories: [catA] }).map(t => t.title), ['w']);
assert.deepStrictEqual(S.tasksIn(f, 'todo', { tags: ['urgent'] }).map(t => t.title), ['w', 'x'], 'tags are OR-ed');
assert.deepStrictEqual(S.tasksIn(f, 'todo', { categories: [catA], tags: ['later'] }).map(t => t.title), [],
  'category and tag filters are AND-ed');
assert.deepStrictEqual(S.allTags(f), ['later', 'urgent']);

// --- overdue is local-date based, and Done is never overdue
const now = new Date('2026-09-03T12:00:00');
assert.strictEqual(S.today(now), '2026-09-03');
assert.strictEqual(S.isOverdue({ due: '2026-09-02', column: 'todo' }, now), true);
assert.strictEqual(S.isOverdue({ due: '2026-09-03', column: 'todo' }, now), false, 'due today is not overdue');
assert.strictEqual(S.isOverdue({ due: '2026-09-02', column: 'done' }, now), false, 'done is never overdue');
assert.strictEqual(S.isOverdue({ due: '', column: 'todo' }, now), false);

// --- tag parsing
assert.deepStrictEqual(S.parseTags(' a, b ,, a , c '), ['a', 'b', 'c'], 'trims, drops blanks, dedupes');
assert.deepStrictEqual(S.parseTags(''), []);

// --- counts
assert.deepStrictEqual(S.counts(f, now), { doing: 0, overdue: 0, done: 0 });

// --- category rename
let [r, rid] = S.addCategory(S.emptyState(), 'Studdy', '#4b607c');
r = S.updateCategory(r, rid, { name: 'Study' });
assert.strictEqual(r.categories[0].name, 'Study');
assert.strictEqual(r.categories[0].color, '#4b607c', 'rename leaves the color alone');
assert.deepStrictEqual(S.updateCategory(r, 'nope', { name: 'x' }).categories, r.categories,
  'unknown id changes nothing');

// --- search matches title, notes and tags; empty query matches nothing
const t = { title: 'Renew passport', notes: 'book the APPOINTMENT', tags: ['admin'] };
assert.strictEqual(S.matchesQuery(t, 'pass'), true, 'title substring');
assert.strictEqual(S.matchesQuery(t, 'appointment'), true, 'notes, case-insensitive');
assert.strictEqual(S.matchesQuery(t, 'ADMIN'), true, 'tags');
assert.strictEqual(S.matchesQuery(t, 'visa'), false);
assert.strictEqual(S.matchesQuery(t, ''), false, 'empty query highlights nothing');
assert.strictEqual(S.matchesQuery(t, '   '), false);

// --- markup highlights every occurrence and never emits unescaped input
assert.strictEqual(S.markup('a b a', 'a'), '<mark>a</mark> b <mark>a</mark>');
assert.strictEqual(S.markup('Renew Passport', 'pass'), 'Renew <mark>Pass</mark>port',
  'match is case-insensitive but keeps the original casing');
assert.strictEqual(S.markup('a<b>c', ''), 'a&lt;b&gt;c', 'no query still escapes');
assert.strictEqual(S.markup('<script>', 'script'), '&lt;<mark>script</mark>&gt;',
  'escapes around the mark');
assert.strictEqual(S.markup('x & y', '&'), 'x <mark>&amp;</mark> y', 'escapes inside the mark');
assert.strictEqual(S.markup('abc', 'zzz'), 'abc', 'no match passes through');

// --- bulk remove only takes the ids it was given
const keep = S.removeTasks(s, [a, c]);
assert.deepStrictEqual(keep.tasks.map(x => x.title), ['b'], 'removes exactly the listed ids');
assert.strictEqual(S.removeTasks(s, []).tasks.length, 3, 'empty list is a no-op');
assert.strictEqual(S.removeTasks(s, ['ghost']).tasks.length, 3, 'unknown ids are ignored');
assert.strictEqual(s.tasks.length, 3, 'removeTasks does not mutate its input');

console.log('all good');
