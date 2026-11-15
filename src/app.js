// ── 1. Storage, Sample Syllabi & State ────────────────────────────────────────
const STORE_KEY = 'taau_ai_v1';
const SAMPLES = [
  { title: 'Data Structures & Algorithms', text: 'Unit 1: Big-O, Recurrence Relations, Master Theorem\nUnit 2: Stacks, Queues, Linked Lists\nUnit 3: BSTs, AVL Rotations, Heaps\nUnit 4: BFS, DFS, Dijkstra, Kruskal MST' },
  { title: 'Discrete Mathematics', text: 'Mod 1: Quantifiers & Proofs\nMod 2: Equivalence Relations\nMod 3: Strong Induction & Recurrences\nMod 4: Pigeonhole & Inclusion-Exclusion' },
];

const $ = (id) => document.getElementById(id);
const uidId = (p) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const daysLeft = (d) => Math.max(0, Math.ceil((new Date(`${d}T00:00:00`) - new Date().setHours(0, 0, 0, 0)) / 86400000) || 0);
const shortDate = (d) => Number.isNaN(Date.parse(`${d}T00:00:00`)) ? (d || '') : new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const plusDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const banner = (id, msg) => { const el = $(id); el.textContent = msg || ''; el.hidden = !msg; };

const state = {
  subjects: [], tasks: [], summaries: [], quizzes: [],
  subId: null, sumId: null, quizId: null, draft: [],
  tab: 'overview', filter: 'all', fileData: null,
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    ['subjects', 'tasks', 'summaries', 'quizzes'].forEach((k) => { if (Array.isArray(saved[k])) state[k] = saved[k]; });
    state.subId = state.subjects.some((s) => s.id === saved.subId) ? saved.subId : (state.subjects[0]?.id || null);
    if (['overview', 'plan', 'summaries', 'quizzes'].includes(saved.tab)) state.tab = saved.tab;
  } catch { /* ignore invalid local storage */ }
  syncActiveItems();
}

function saveState() {
  try {
    const { subjects, tasks, summaries, quizzes, subId, tab } = state;
    localStorage.setItem(STORE_KEY, JSON.stringify({ subjects, tasks, summaries, quizzes, subId, tab }));
  } catch { /* ignore storage quota errors */ }
}

const curSub = () => state.subjects.find((s) => s.id === state.subId) || state.subjects[0] || null;
const subTasks = (id) => state.tasks.filter((t) => t.subjectId === id).sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || a.orderIndex - b.orderIndex);
const subSummaries = (id) => state.summaries.filter((s) => s.subjectId === id);
const subQuizzes = (id) => state.quizzes.filter((q) => q.subjectId === id);

function syncActiveItems() {
  const sub = curSub();
  if (!sub) { state.sumId = null; state.quizId = null; state.draft = []; return; }
  const sums = subSummaries(sub.id), quzs = subQuizzes(sub.id);
  if (!sums.some((s) => s.id === state.sumId)) state.sumId = sums[0]?.id || null;
  const q = quzs.find((x) => x.id === state.quizId) || quzs[0] || null;
  state.quizId = q?.id || null;
  state.draft = q ? q.userAnswers.slice() : [];
}

async function postJson(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

// ── 2. Local Data Actions ───────────────────────────────────────────────────
function createSubject(title, examDate, hours, parsed) {
  const id = uidId('sub');
  const tasks = (parsed.tasks || []).slice(0, 30);
  state.subjects.push({
    id, title: title || 'Subject', examDate: examDate || plusDays(6), dailyHours: Math.max(0.5, Number(hours) || 3),
    syllabusOverview: parsed.syllabusOverview || 'Exam syllabus',
    topics: (parsed.topics || []).slice(0, 35),
  });
  tasks.forEach((t, i) => state.tasks.push({
    id: uidId('tsk'), subjectId: id, topicTitle: t.topicTitle || 'Revision',
    description: t.description || 'Review and solve problems.', scheduledDate: t.scheduledDate || examDate,
    durationMinutes: Number(t.durationMinutes) || 45, priority: t.priority || 'medium', status: 'pending', orderIndex: i,
  }));
  state.subjects.sort((a, b) => a.examDate.localeCompare(b.examDate));
  state.subId = id; state.tab = 'overview';
  syncActiveItems(); saveState(); renderWorkspace();
}

function loadSampleSubject() {
  createSubject('Data Structures & Algorithms', plusDays(6), 3, {
    syllabusOverview: '4 core units covering asymptotic analysis, linear structures, balanced trees, and graph algorithms.',
    topics: ['Big-O & Recurrences', 'Stacks, Queues & Linked Lists', 'BSTs, AVL Trees & Heaps', 'BFS, DFS & Shortest Paths'],
    tasks: [
      { topicTitle: 'Big-O & Recurrences', description: 'Solve 8 Master Theorem and recursion tree problems.', scheduledDate: plusDays(1), durationMinutes: 60, priority: 'high' },
      { topicTitle: 'Stacks, Queues & Linked Lists', description: 'Trace pointer reversal and circular queue edge cases.', scheduledDate: plusDays(2), durationMinutes: 45, priority: 'medium' },
      { topicTitle: 'BSTs, AVL Trees & Heaps', description: 'Practice LL/LR rotations and bottom-up heapify.', scheduledDate: plusDays(3), durationMinutes: 60, priority: 'high' },
      { topicTitle: 'BFS, DFS & Shortest Paths', description: 'Run Dijkstra and Kruskal dry runs on weighted graphs.', scheduledDate: plusDays(5), durationMinutes: 60, priority: 'high' },
    ],
  });
}

function toggleTask(taskId) {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) return;
  task.status = task.status === 'completed' ? 'pending' : 'completed';
  saveState(); renderWorkspace();
}

function addTask(subId, p) {
  state.tasks.push({
    id: uidId('tsk'), subjectId: subId, topicTitle: p.topic.trim() || 'Milestone',
    description: p.desc.trim() || 'Focused practice', scheduledDate: p.date || plusDays(6),
    durationMinutes: Math.max(10, Number(p.mins) || 45), priority: p.pri || 'medium',
    status: 'pending', orderIndex: subTasks(subId).length,
  });
  saveState(); renderWorkspace();
}

function saveSummary(subId, topic, d) {
  const id = uidId('sum');
  state.summaries.unshift({
    id, subjectId: subId, topicTitle: topic, overview: d.overview || 'Summary generated.',
    coreConcepts: (d.coreConcepts || []).slice(0, 15),
    formulaSheet: (d.formulaSheet || []).slice(0, 15),
    examPitfalls: (d.examPitfalls || []).slice(0, 12),
    memoryAnchor: d.memoryAnchor || '',
  });
  state.sumId = id; saveState(); renderWorkspace();
}

function saveQuiz(subId, topic, difficulty, qs) {
  const id = uidId('quz');
  const clean = qs.slice(0, 15).map((q) => {
    const opts = (q.options || []).slice(0, 4);
    while (opts.length < 4) opts.push('None of the above');
    return { prompt: q.prompt, options: opts, correctIndex: Math.min(Math.max(Number(q.correctIndex) || 0, 0), 3), explanation: q.explanation || 'Review notes.' };
  });
  state.quizzes.unshift({ id, subjectId: subId, topicTitle: topic, difficulty, questions: clean, userAnswers: clean.map(() => -1), scorePercent: -1, status: 'in_progress' });
  state.quizId = id; state.draft = clean.map(() => -1);
  saveState(); renderWorkspace();
}

function gradeQuiz(quiz, ans) {
  quiz.userAnswers = ans.slice();
  quiz.scorePercent = Math.round((quiz.questions.filter((q, i) => ans[i] === q.correctIndex).length / Math.max(quiz.questions.length, 1)) * 100);
  quiz.status = 'completed';
  saveState(); renderWorkspace();
}

function removeSubject(subId) {
  state.subjects = state.subjects.filter((s) => s.id !== subId);
  state.tasks = state.tasks.filter((t) => t.subjectId !== subId);
  state.summaries = state.summaries.filter((s) => s.subjectId !== subId);
  state.quizzes = state.quizzes.filter((q) => q.subjectId !== subId);
  state.subId = state.subjects[0]?.id || null;
  syncActiveItems(); saveState(); renderWorkspace();
}

// ── 3. Workspace Renderer ───────────────────────────────────────────────────
function fillSelect(id, sub, all) {
  const el = $(id), prev = el.value;
  el.innerHTML = (all ? ['<option value="Comprehensive Mock">All Topics (Mock)</option>'] : [])
    .concat(sub.topics.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`))
    .concat(all ? [] : ['<option value="__custom__">Custom Topic...</option>']).join('');
  if (prev && [...el.options].some((o) => o.value === prev)) el.value = prev;
}

function renderWorkspace() {
  const sub = curSub();
  $('subject-count').textContent = String(state.subjects.length);
  $('subject-list').innerHTML = state.subjects.map((s) => {
    const tasks = subTasks(s.id), done = tasks.filter((t) => t.status === 'completed').length;
    const graded = subQuizzes(s.id).filter((q) => q.status === 'completed' && q.scorePercent >= 0);
    const avg = graded.length ? `${Math.round(graded.reduce((a, q) => a + q.scorePercent, 0) / graded.length)}%` : 'no quiz';
    const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
    return `<button type="button" class="subject-item ${sub?.id === s.id ? 'is-selected' : ''}" data-select-subject="${esc(s.id)}">
      <div class="row between"><span class="small-strong truncate">${esc(s.title)}</span><span class="mono ${daysLeft(s.examDate) <= 3 ? 'amber' : 'lime'}">${daysLeft(s.examDate)}d</span></div>
      <div class="track"><div class="fill" style="width:${pct}%"></div></div>
      <div class="row between meta mono"><span>${done}/${tasks.length}</span><span>${avg}</span></div>
    </button>`;
  }).join('') || `<p class="meta">No subjects yet.</p>`;

  $('empty-subjects-state').hidden = Boolean(sub);
  $('subject-workspace').hidden = !sub;
  document.querySelectorAll('.tab').forEach((b) => { b.disabled = !sub; b.classList.toggle('is-active', b.dataset.tab === state.tab); });
  if (!sub) return;

  const tasks = subTasks(sub.id), sums = subSummaries(sub.id), quzs = subQuizzes(sub.id);
  const done = tasks.filter((t) => t.status === 'completed').length, pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const graded = quzs.filter((q) => q.status === 'completed' && q.scorePercent >= 0);
  $('subject-title-heading').textContent = sub.title;
  $('subject-meta-line').textContent = `Exam ${shortDate(sub.examDate)} · ${sub.dailyHours}h/day · ${sub.topics.length} topics`;
  $('readiness-percent').textContent = `${pct}%`; $('readiness-bar-fill').style.width = `${pct}%`;
  $('kpi-days').textContent = `${daysLeft(sub.examDate)}d`; $('kpi-milestones').textContent = `${done}/${tasks.length}`;
  $('kpi-quiz-avg').textContent = graded.length ? `${Math.round(graded.reduce((a, q) => a + q.scorePercent, 0) / graded.length)}%` : '—';

  ['overview', 'plan', 'summaries', 'quizzes'].forEach((t) => { $(`panel-${t}`).hidden = state.tab !== t; });
  if (state.tab === 'overview') {
    $('overview-syllabus-text').textContent = sub.syllabusOverview || 'No overview.';
    $('overview-sheets-count').textContent = `${sums.length} sheets`;
    $('overview-topics-list').innerHTML = sub.topics.map((t, i) => `<div class="list-row"><span class="truncate small-strong"><span class="mono muted">${String(i + 1).padStart(2, '0')}</span> ${esc(t)}</span><div class="row"><button type="button" class="link-btn" data-jump-sum="${esc(t)}">Sheet</button><span class="meta">·</span><button type="button" class="link-btn amber" data-jump-quiz="${esc(t)}">Quiz</button></div></div>`).join('') || `<p class="muted card-pad">No topics.</p>`;
    $('overview-next-tasks').innerHTML = tasks.filter((t) => t.status === 'pending').slice(0, 5).map((t) => `<div class="list-row"><div class="row"><button type="button" class="check-btn" data-toggle-task="${esc(t.id)}"></button><div><p class="small-strong">${esc(t.topicTitle)}</p><p class="meta">${shortDate(t.scheduledDate)} · ${t.durationMinutes}m</p></div></div></div>`).join('') || `<p class="muted card-pad">All milestones done.</p>`;
  } else if (state.tab === 'plan') {
    document.querySelectorAll('#plan-filter-group .seg').forEach((b) => b.classList.toggle('is-active', b.dataset.filter === state.filter));
    const rows = tasks.filter((t) => state.filter === 'all' || t.status === state.filter);
    $('plan-tasks-list').innerHTML = rows.map((t) => {
      const d = t.status === 'completed';
      return `<div class="list-row"><div class="row" style="align-items:flex-start"><button type="button" class="check-btn ${d ? 'is-done' : ''}" data-toggle-task="${esc(t.id)}">${d ? '&#10003;' : ''}</button><div><p class="small-strong ${d ? 'is-done-text' : ''}">${esc(t.topicTitle)}</p><p class="muted">${esc(t.description)}</p></div></div><span class="meta mono">${esc(t.priority)} · ${shortDate(t.scheduledDate)} · ${t.durationMinutes}m</span></div>`;
    }).join('') || `<p class="muted card-pad">No milestones match.</p>`;
  } else if (state.tab === 'summaries') {
    fillSelect('summary-topic-select', sub, false);
    $('summary-custom-topic').hidden = $('summary-topic-select').value !== '__custom__';
    const cur = sums.find((s) => s.id === state.sumId) || sums[0];
    $('summaries-container').innerHTML = !cur ? `<div class="card"><p class="muted">Pick a topic above and click Make Study Sheet.</p></div>` : `<div class="split">
      <div class="card flush">${sums.map((s) => `<button type="button" class="history-item ${s.id === cur.id ? 'is-selected' : ''}" data-sel-sum="${esc(s.id)}"><span class="small-strong">${esc(s.topicTitle)}</span><span class="meta">${s.formulaSheet.length} formulas</span></button>`).join('')}</div>
      <article class="card">
        <h3 class="h2">${esc(cur.topicTitle)}</h3><p class="body-copy">${esc(cur.overview)}</p>
        <div class="stack-sm"><span class="small-strong">Core Concepts</span>${cur.coreConcepts.map((c, i) => `<p class="muted"><span class="mono lime">${i + 1}.</span> ${esc(c)}</p>`).join('')}</div>
        ${cur.formulaSheet.length ? `<div class="grid-2">${cur.formulaSheet.map((f) => `<div class="formula-card"><span class="small-strong">${esc(f.label)}</span><div class="formula-expr">${esc(f.expression)}</div><span class="meta">${esc(f.note)}</span></div>`).join('')}</div>` : ''}
        <div class="grid-2 divider-top"><div class="stack-sm"><span class="small-strong amber">Exam Pitfalls</span>${cur.examPitfalls.map((p) => `<p class="muted">- ${esc(p)}</p>`).join('')}</div><div class="formula-card"><span class="small-strong lime">Memory Hook</span><p class="muted">${esc(cur.memoryAnchor || 'Review derivations.')}</p></div></div>
      </article></div>`;
  } else {
    fillSelect('quiz-topic-select', sub, true);
    const weak = quzs.filter((q) => q.status === 'completed' && q.questions.some((qs, i) => q.userAnswers[i] !== qs.correctIndex)).map((q) => q.topicTitle);
    $('drill-weak-btn').hidden = !weak.length;
    const cur = quzs.find((q) => q.id === state.quizId) || quzs[0];
    if (!cur) { $('quizzes-container').innerHTML = `<div class="card"><p class="muted">Pick a topic and click Start Quiz.</p></div>`; return; }
    const done = cur.status === 'completed', ready = cur.questions.every((_, i) => state.draft[i] >= 0);
    $('quizzes-container').innerHTML = `<div class="split">
      <div class="card flush">${quzs.map((q) => `<button type="button" class="history-item ${q.id === cur.id ? 'is-selected' : ''}" data-sel-quiz="${esc(q.id)}"><span class="small-strong">${esc(q.topicTitle)}</span><span class="meta">${q.status === 'completed' ? `${q.scorePercent}%` : 'In progress'} · ${q.questions.length} Qs</span></button>`).join('')}</div>
      <div class="card">
        <div class="row between"><div><h3 class="h2">${esc(cur.topicTitle)}</h3><p class="meta">${esc(cur.difficulty)} · ${cur.questions.length} Qs</p></div>${done ? `<span class="kpi ${cur.scorePercent >= 70 ? 'lime' : 'amber'}">${cur.scorePercent}%</span>` : ''}</div>
        ${cur.questions.map((q, qi) => {
          const p = done ? cur.userAnswers[qi] : state.draft[qi];
          return `<div class="stack-sm divider-top"><p class="small-strong"><span class="mono">Q${qi + 1}.</span> ${esc(q.prompt)}</p>${q.options.map((o, oi) => `<button type="button" class="quiz-opt ${done ? (oi === q.correctIndex ? 'is-correct' : oi === p ? 'is-wrong' : '') : (p === oi ? 'is-selected' : '')}" ${done ? 'disabled' : `data-qq="${qi}" data-qo="${oi}"`}><span class="mono">${String.fromCharCode(65 + oi)}.</span><span>${esc(o)}</span></button>`).join('')}${done ? `<p class="meta">${esc(q.explanation)}</p>` : ''}</div>`;
        }).join('')}
        ${done ? '' : `<div class="row end"><button type="button" id="submit-quiz-btn" class="btn primary" ${ready ? '' : 'disabled'}>Grade Quiz</button></div>`}
      </div></div>`;
  }
}

// ── 4. Actions, Events & Boot ───────────────────────────────────────────────
function openModal(show) {
  $('add-subject-modal').hidden = !show;
  if (show) { $('new-subject-date').value = plusDays(6); $('new-subject-title').focus(); banner('modal-error', ''); banner('modal-status', ''); }
  else { $('add-subject-form').reset(); state.fileData = null; $('uploaded-file-name').textContent = 'No file attached (PDF/PNG/JPG/TXT, 10 MB max)'; $('clear-file-btn').hidden = true; }
}

async function runSummary(topic) {
  const sub = curSub(), btn = $('generate-summary-btn');
  if (!sub || !topic) return;
  btn.disabled = true; btn.textContent = 'Generating...'; banner('summary-error', '');
  try { saveSummary(sub.id, topic, await postJson('/api/ai/generate-summary', { subjectTitle: sub.title, topicTitle: topic, syllabusContext: sub.syllabusOverview })); }
  catch (e) { banner('summary-error', e.message); } finally { btn.disabled = false; btn.textContent = 'Make Study Sheet'; }
}

async function runQuiz(topic, weak = []) {
  const sub = curSub(), btn = $('start-quiz-btn'), difficulty = $('quiz-difficulty-select').value;
  if (!sub || !topic) return;
  btn.disabled = true; btn.textContent = 'Building...'; banner('quiz-error', '');
  try {
    const res = await postJson('/api/ai/generate-quiz', { subjectTitle: sub.title, topicTitle: topic, difficulty, questionCount: Number($('quiz-count-select').value), syllabusContext: sub.syllabusOverview, focusWeaknesses: weak });
    if (!res.questions?.length) throw new Error('No questions returned.');
    saveQuiz(sub.id, topic, difficulty, res.questions);
  } catch (e) { banner('quiz-error', e.message); } finally { btn.disabled = false; btn.textContent = 'Start Quiz'; }
}

document.addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.id === 'primary-action-btn' || t.id === 'sidebar-add-btn' || t.id === 'empty-add-subject-btn') return openModal(true);
  if (t.id === 'load-sample-btn') return loadSampleSubject();
  if (t.id === 'close-modal-btn' || t.id === 'cancel-modal-btn') return openModal(false);

  if (t.dataset.tab && curSub()) { state.tab = t.dataset.tab; saveState(); return renderWorkspace(); }
  if (t.dataset.selectSubject) { state.subId = t.dataset.selectSubject; syncActiveItems(); saveState(); return renderWorkspace(); }
  if (t.id === 'jump-full-schedule-btn') { state.tab = 'plan'; saveState(); return renderWorkspace(); }
  if (t.dataset.jumpSum) { state.tab = 'summaries'; renderWorkspace(); $('summary-topic-select').value = t.dataset.jumpSum; return runSummary(t.dataset.jumpSum); }
  if (t.dataset.jumpQuiz) { state.tab = 'quizzes'; renderWorkspace(); $('quiz-topic-select').value = t.dataset.jumpQuiz; return runQuiz(t.dataset.jumpQuiz); }

  if (t.id === 'ask-delete-subject-btn') { $('delete-prompt-default').hidden = true; $('delete-prompt-confirm').hidden = false; }
  if (t.id === 'cancel-delete-subject-btn') { $('delete-prompt-default').hidden = false; $('delete-prompt-confirm').hidden = true; }
  if (t.id === 'confirm-delete-subject-btn' && curSub()) { removeSubject(curSub().id); $('delete-prompt-default').hidden = false; $('delete-prompt-confirm').hidden = true; }

  if (t.dataset.filter) { state.filter = t.dataset.filter; return renderWorkspace(); }
  if (t.id === 'toggle-add-task-btn' || t.id === 'cancel-add-task-btn') { const f = $('add-milestone-form'); f.hidden = !f.hidden; if (!f.hidden) $('milestone-date').value = plusDays(6); }
  if (t.dataset.toggleTask) return toggleTask(t.dataset.toggleTask);

  if (t.id === 'generate-summary-btn') { const v = $('summary-topic-select').value; return runSummary(v === '__custom__' ? $('summary-custom-topic').value.trim() : v); }
  if (t.dataset.selSum) { state.sumId = t.dataset.selSum; return renderWorkspace(); }
  if (t.id === 'start-quiz-btn') return runQuiz($('quiz-topic-select').value);
  if (t.id === 'drill-weak-btn') {
    const missed = [...new Set(subQuizzes(curSub().id).filter((q) => q.status === 'completed' && q.questions.some((qs, i) => q.userAnswers[i] !== qs.correctIndex)).map((q) => q.topicTitle))];
    if (missed.length) return runQuiz(`Weak Drill: ${missed[0]}`, missed);
  }
  if (t.dataset.selQuiz) { const q = state.quizzes.find((x) => x.id === t.dataset.selQuiz); if (q) { state.quizId = q.id; state.draft = q.userAnswers.slice(); return renderWorkspace(); } }
  if (t.dataset.qq !== undefined) { state.draft[Number(t.dataset.qq)] = Number(t.dataset.qo); return renderWorkspace(); }
  if (t.id === 'submit-quiz-btn') { const q = state.quizzes.find((x) => x.id === state.quizId); if (q) return gradeQuiz(q, state.draft); }

  if (t.dataset.sample !== undefined) { const s = SAMPLES[Number(t.dataset.sample)]; if (s) { $('new-subject-title').value = s.title; $('new-subject-syllabus').value = s.text; } }
  if (t.id === 'clear-file-btn') { state.fileData = null; $('syllabus-file-input').value = ''; $('uploaded-file-name').textContent = 'No file attached (PDF/PNG/JPG/TXT, 10 MB max)'; $('clear-file-btn').hidden = true; }
});

$('summary-topic-select').addEventListener('change', (e) => { $('summary-custom-topic').hidden = e.target.value !== '__custom__'; });
$('add-milestone-form').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!curSub()) return;
  addTask(curSub().id, { topic: $('milestone-topic').value, date: $('milestone-date').value, mins: $('milestone-duration').value, pri: $('milestone-priority').value, desc: $('milestone-desc').value });
  e.target.reset(); e.target.hidden = true;
});

$('syllabus-file-input').addEventListener('change', async (e) => {
  const f = e.target.files?.[0]; if (!f) return;
  banner('modal-error', '');
  if (f.size > 10 * 1024 * 1024) return banner('modal-error', 'File exceeds 10 MB.');
  if (f.type.startsWith('text/') || /\.(txt|md)$/i.test(f.name)) { $('new-subject-syllabus').value = (await f.text()).slice(0, 20000); state.fileData = null; }
  else {
    const url = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result || '')); r.onerror = () => rej(new Error('Read failed')); r.readAsDataURL(f); });
    state.fileData = { mimeType: f.type || 'application/pdf', base64: url.split(',')[1] || '' };
  }
  $('uploaded-file-name').textContent = f.name; $('clear-file-btn').hidden = false;
});

$('add-subject-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('submit-subject-btn');
  btn.disabled = true; btn.textContent = 'Generating...'; banner('modal-error', ''); banner('modal-status', 'Reading syllabus...');
  try {
    const title = $('new-subject-title').value.trim(), examDate = $('new-subject-date').value, hours = Number($('new-subject-hours').value) || 3;
    const parsed = await postJson('/api/ai/parse-syllabus', { subjectTitle: title, examDate, dailyHours: hours, currentDate: plusDays(0), syllabusText: $('new-subject-syllabus').value, fileData: state.fileData });
    createSubject(title, examDate, hours, parsed);
    openModal(false);
  } catch (err) { banner('modal-status', ''); banner('modal-error', err.message); } finally { btn.disabled = false; btn.textContent = 'Build Study Plan'; }
});

loadState();
renderWorkspace();
