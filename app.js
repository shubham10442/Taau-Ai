import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import {
  collection, deleteDoc, doc, getDoc, getDocFromServer, getFirestore,
  onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

// ── 1. Firebase Init & Guarded DB Helpers ───────────────────────────────────
const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(fbApp);
const provider = new GoogleAuthProvider();

const clamp = (v, min, max, float = false) => Number.isNaN(Number(v)) ? min : (float ? Math.min(Math.max(Number(v), min), max) : Math.round(Math.min(Math.max(Number(v), min), max)));
const txt = (v, max, fb = '') => { const s = String(v ?? '').trim(); return !s ? fb : s.slice(0, max); };
const uidId = (p) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

function dbFail(error, operationType, path) {
  const u = auth.currentUser;
  const payload = { error: error instanceof Error ? error.message : String(error), operationType, path, authInfo: { userId: u?.uid ?? null, email: u?.email ?? null } };
  console.error('Firestore Error:', JSON.stringify(payload));
  throw new Error(JSON.stringify(payload));
}

async function dbRun(op, path, fn) {
  try { return await fn(); } catch (err) { dbFail(err, op, path); }
}

// Verify Firestore connectivity on boot
getDocFromServer(doc(db, 'test', 'connection')).catch((e) => String(e?.message).includes('offline') && console.error('Check Firebase config.'));

function listen(col, filters, onData, onErr) {
  return onSnapshot(query(collection(db, col), ...filters.map(([k, v]) => where(k, '==', v))),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => { try { dbFail(err, 'list', col); } catch (w) { onErr(w); } });
}

// ── 2. Sample Syllabi & State ───────────────────────────────────────────────
const SAMPLES = [
  { title: 'Data Structures & Algorithms', text: 'Unit 1: Big-O, Recurrence Relations, Master Theorem\nUnit 2: Stacks, Queues, Linked Lists\nUnit 3: BSTs, AVL Rotations, Heaps\nUnit 4: BFS, DFS, Dijkstra, Kruskal MST' },
  { title: 'Discrete Mathematics', text: 'Mod 1: Quantifiers & Proofs\nMod 2: Equivalence Relations\nMod 3: Strong Induction & Recurrences\nMod 4: Pigeonhole & Inclusion-Exclusion' },
];

const state = {
  user: null, ready: false, estDays: 6, estHours: 3,
  subjects: [], loaded: false, subId: null, tab: 'overview', filter: 'all',
  tasks: [], summaries: [], sumId: null, quizzes: [], quizId: null, draft: [],
  fileData: null, unsubSubs: null, unsubChild: [],
};

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const curSub = () => state.subjects.find((s) => s.id === state.subId) || state.subjects[0] || null;
const daysLeft = (d) => Math.max(0, Math.ceil((new Date(`${d}T00:00:00`) - new Date().setHours(0, 0, 0, 0)) / 86400000) || 0);
const shortDate = (d) => Number.isNaN(Date.parse(`${d}T00:00:00`)) ? (d || '') : new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const plusDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const banner = (id, msg) => { const el = $(id); el.textContent = msg || ''; el.hidden = !msg; };

async function postJson(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

// ── 4. Firestore Writes (Bounded to firestore.rules) ────────────────────────
const ensureUser = (u) => dbRun('write', `users/${u.uid}`, async () => {
  const ref = doc(db, 'users', u.uid);
  if (!(await getDoc(ref)).exists()) {
    await setDoc(ref, { uid: u.uid, displayName: txt(u.displayName, 120, 'Student'), email: txt(u.email, 200, 'student@example.com'), dailyStudyHours: 3, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }
});

const createSubject = (uid, title, examDate, hours, parsed) => {
  const id = uidId('sub');
  const tasks = (parsed.tasks || []).slice(0, 30);
  return dbRun('create', `subjects/${id}`, async () => {
    await setDoc(doc(db, 'subjects', id), {
      userId: uid, title: txt(title, 120, 'Subject'), examDate: txt(examDate, 40, plusDays(6)),
      dailyHours: clamp(hours, 0.5, 16, true), syllabusOverview: txt(parsed.syllabusOverview, 1500, 'Exam syllabus'),
      topics: (parsed.topics || []).slice(0, 35).map((t) => txt(t, 150, 'Topic')),
      totalTasks: tasks.length, completedTasks: 0, averageQuizScore: -1, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    if (tasks.length) {
      const batch = writeBatch(db);
      tasks.forEach((t, i) => batch.set(doc(db, 'studyTasks', uidId('tsk')), {
        userId: uid, subjectId: id, topicTitle: txt(t.topicTitle, 160, 'Revision'),
        description: txt(t.description, 400, 'Review and solve problems.'), scheduledDate: txt(t.scheduledDate, 40, examDate),
        durationMinutes: clamp(t.durationMinutes, 10, 480), priority: ['high', 'medium', 'normal'].includes(t.priority) ? t.priority : 'medium',
        status: 'pending', orderIndex: i, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      }));
      await batch.commit();
    }
    return id;
  });
};

const toggleTask = (task) => dbRun('update', `studyTasks/${task.id}`, async () => {
  const next = task.status === 'completed' ? 'pending' : 'completed';
  await updateDoc(doc(db, 'studyTasks', task.id), { status: next, updatedAt: serverTimestamp() });
  const done = state.tasks.filter((t) => (t.id === task.id ? next : t.status) === 'completed').length;
  await updateDoc(doc(db, 'subjects', task.subjectId), { completedTasks: clamp(done, 0, 500), totalTasks: clamp(state.tasks.length, 0, 500), updatedAt: serverTimestamp() });
});

const addTask = (uid, subId, p) => dbRun('create', 'studyTasks', async () => {
  await setDoc(doc(db, 'studyTasks', uidId('tsk')), {
    userId: uid, subjectId: subId, topicTitle: txt(p.topic, 160, 'Milestone'), description: txt(p.desc, 400, 'Focused practice'),
    scheduledDate: txt(p.date, 40, plusDays(6)), durationMinutes: clamp(p.mins, 10, 480), priority: p.pri,
    status: 'pending', orderIndex: clamp(state.tasks.length, 0, 500), createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'subjects', subId), { totalTasks: clamp(state.tasks.length + 1, 0, 500), updatedAt: serverTimestamp() });
});

const saveSummary = (uid, subId, topic, d) => {
  const id = uidId('sum');
  return dbRun('create', `studySummaries/${id}`, async () => {
    await setDoc(doc(db, 'studySummaries', id), {
      userId: uid, subjectId: subId, topicTitle: txt(topic, 160, 'Summary'), overview: txt(d.overview, 2000, 'Summary generated.'),
      coreConcepts: (d.coreConcepts || []).slice(0, 15).map((c) => txt(c, 500, 'Point')),
      formulaSheet: (d.formulaSheet || []).slice(0, 15).map((f) => ({ label: txt(f.label, 160, 'Rule'), expression: txt(f.expression, 300, '—'), note: txt(f.note, 400, '') })),
      examPitfalls: (d.examPitfalls || []).slice(0, 12).map((p) => txt(p, 400, 'Check edge cases')),
      memoryAnchor: txt(d.memoryAnchor, 600, ''), createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    return id;
  });
};

const saveQuiz = (uid, subId, topic, difficulty, qs) => {
  const id = uidId('quz');
  const clean = qs.slice(0, 15).map((q) => {
    const opts = (q.options || []).slice(0, 4).map((o) => txt(o, 300, 'Option'));
    while (opts.length < 4) opts.push('None of the above');
    return { prompt: txt(q.prompt, 600, 'Question'), options: opts, correctIndex: clamp(q.correctIndex, 0, 3), explanation: txt(q.explanation, 800, 'Review notes.') };
  });
  return dbRun('create', `quizzes/${id}`, async () => {
    await setDoc(doc(db, 'quizzes', id), {
      userId: uid, subjectId: subId, topicTitle: txt(topic, 160, 'Quiz'), difficulty, questions: clean,
      userAnswers: clean.map(() => -1), scorePercent: -1, status: 'in_progress', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    return id;
  });
};

const gradeQuiz = (quiz, ans) => dbRun('update', `quizzes/${quiz.id}`, async () => {
  const score = Math.round((quiz.questions.filter((q, i) => ans[i] === q.correctIndex).length / Math.max(quiz.questions.length, 1)) * 100);
  await updateDoc(doc(db, 'quizzes', quiz.id), { userAnswers: ans.slice(0, 15).map((a) => clamp(a, -1, 3)), scorePercent: clamp(score, 0, 100), status: 'completed', updatedAt: serverTimestamp() });
  const all = state.quizzes.filter((q) => q.id !== quiz.id && q.status === 'completed' && q.scorePercent >= 0).map((q) => q.scorePercent).concat(score);
  await updateDoc(doc(db, 'subjects', quiz.subjectId), { averageQuizScore: clamp(all.reduce((a, b) => a + b, 0) / all.length, 0, 100, true), updatedAt: serverTimestamp() });
});

const removeSubject = (subId) => dbRun('delete', `subjects/${subId}`, async () => {
  await Promise.all([
    ...state.tasks.map((t) => deleteDoc(doc(db, 'studyTasks', t.id))),
    ...state.summaries.map((s) => deleteDoc(doc(db, 'studySummaries', s.id))),
    ...state.quizzes.map((q) => deleteDoc(doc(db, 'quizzes', q.id))),
  ]);
  await deleteDoc(doc(db, 'subjects', subId));
});

// ── 5. Real-Time Subscriptions & Renderers ──────────────────────────────────
const clearChildren = () => { state.unsubChild.forEach((f) => f()); state.unsubChild = []; };

function subscribeSubject(subId) {
  clearChildren();
  if (!state.user || !subId) { state.tasks = []; state.summaries = []; state.quizzes = []; return renderWorkspace(); }
  const uid = state.user.uid;
  const onErr = (e) => banner('sync-error-banner', `Cloud sync notice: ${e.message}`);
  state.unsubChild.push(
    listen('studyTasks', [['userId', uid], ['subjectId', subId]], (d) => { state.tasks = d.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || a.orderIndex - b.orderIndex); renderWorkspace(); }, onErr),
    listen('studySummaries', [['userId', uid], ['subjectId', subId]], (d) => { state.summaries = d; if (!d.some((s) => s.id === state.sumId)) state.sumId = d[0]?.id || null; renderWorkspace(); }, onErr),
    listen('quizzes', [['userId', uid], ['subjectId', subId]], (d) => {
      state.quizzes = d;
      const cur = d.find((q) => q.id === state.quizId) || d[0] || null;
      if (!cur) { state.quizId = null; state.draft = []; } else if (cur.id !== state.quizId) { state.quizId = cur.id; state.draft = cur.userAnswers.slice(); }
      renderWorkspace();
    }, onErr),
  );
}

function renderEstimator() {
  const total = state.estDays * state.estHours;
  const earlyEnd = Math.max(1, Math.ceil(state.estDays * 0.5));
  const midEnd = Math.max(earlyEnd + 1, state.estDays - 1);
  $('est-total').textContent = `${total}h total`;
  document.querySelectorAll('[data-est-days]').forEach((b) => b.classList.toggle('is-active', Number(b.dataset.estDays) === state.estDays));
  document.querySelectorAll('[data-est-hours]').forEach((b) => b.classList.toggle('is-active', Number(b.dataset.estHours) === state.estHours));

  const phases = [
    ['Core Concepts & Sheets', `Days 1-${earlyEnd} · Heavy units first`, `${(total * 0.5).toFixed(1).replace(/\.0$/, '')}h`, 'amber'],
    ['Problem Sets & Tracing', `Days ${earlyEnd + 1}-${midEnd} · Past papers`, `${(total * 0.3).toFixed(1).replace(/\.0$/, '')}h`, ''],
    ['Timed Quizzes & Weak Drills', `Last 48h · Fix missed topics`, `${(total * 0.2).toFixed(1).replace(/\.0$/, '')}h`, 'lime'],
  ];
  $('est-breakdown').innerHTML = phases.map(([title, sub, hrs, cls]) =>
    `<div class="sprint-row"><div><p class="small-strong">${title}</p><p class="meta">${sub}</p></div><span class="mono ${cls}">${hrs}</span></div>`
  ).join('');
}

function renderApp() {
  $('boot-loader').hidden = state.ready;
  if (!state.ready) return;
  const on = Boolean(state.user);
  $('landing-view').hidden = on; $('workspace-view').hidden = !on;
  $('landing-nav').hidden = on; $('workspace-nav').hidden = !on;
  $('primary-action-btn').textContent = on ? '+ New Subject' : 'Sign In';
  if (!on) return renderEstimator();
  $('user-display-name').textContent = state.user.displayName || 'Student';
  $('user-email').textContent = state.user.email || '';
  $('welcome-heading').textContent = `Ready to plan, ${(state.user.displayName || 'Student').split(' ')[0]}?`;
  renderWorkspace();
}

function renderWorkspace() {
  if (!state.user) return;
  const sub = curSub();
  $('subject-count').textContent = String(state.subjects.length);
  $('subject-list').innerHTML = state.subjects.map((s) => {
    const pct = s.totalTasks ? Math.round((s.completedTasks / s.totalTasks) * 100) : 0;
    return `<button type="button" class="subject-item ${sub?.id === s.id ? 'is-selected' : ''}" data-select-subject="${esc(s.id)}">
      <div class="row between"><span class="small-strong truncate">${esc(s.title)}</span><span class="mono ${daysLeft(s.examDate) <= 3 ? 'amber' : 'lime'}">${daysLeft(s.examDate)}d</span></div>
      <div class="track"><div class="fill" style="width:${pct}%"></div></div>
      <div class="row between meta mono"><span>${s.completedTasks}/${s.totalTasks}</span><span>${s.averageQuizScore >= 0 ? `${Math.round(s.averageQuizScore)}%` : 'no quiz'}</span></div>
    </button>`;
  }).join('') || `<p class="meta">No subjects yet.</p>`;

  $('empty-subjects-state').hidden = !state.loaded || Boolean(sub);
  $('subject-workspace').hidden = !sub;
  document.querySelectorAll('.tab').forEach((b) => { b.disabled = !sub; b.classList.toggle('is-active', b.dataset.tab === state.tab); });
  if (!sub) return;

  const done = state.tasks.filter((t) => t.status === 'completed').length, pct = state.tasks.length ? Math.round((done / state.tasks.length) * 100) : 0;
  const graded = state.quizzes.filter((q) => q.status === 'completed' && q.scorePercent >= 0);
  $('subject-title-heading').textContent = sub.title;
  $('subject-meta-line').textContent = `Exam ${shortDate(sub.examDate)} · ${sub.dailyHours}h/day · ${sub.topics.length} topics`;
  $('readiness-percent').textContent = `${pct}%`; $('readiness-bar-fill').style.width = `${pct}%`;
  $('kpi-days').textContent = `${daysLeft(sub.examDate)}d`; $('kpi-milestones').textContent = `${done}/${state.tasks.length}`;
  $('kpi-quiz-avg').textContent = graded.length ? `${Math.round(graded.reduce((a, q) => a + q.scorePercent, 0) / graded.length)}%` : '—';

  ['overview', 'plan', 'summaries', 'quizzes'].forEach((t) => { $(`panel-${t}`).hidden = state.tab !== t; });
  if (state.tab === 'overview') {
    $('overview-syllabus-text').textContent = sub.syllabusOverview || 'No overview.';
    $('overview-sheets-count').textContent = `${state.summaries.length} sheets`;
    $('overview-topics-list').innerHTML = sub.topics.map((t, i) => `<div class="list-row"><span class="truncate small-strong"><span class="mono muted">${String(i + 1).padStart(2, '0')}</span> ${esc(t)}</span><div class="row"><button type="button" class="link-btn" data-jump-sum="${esc(t)}">Sheet</button><span class="meta">·</span><button type="button" class="link-btn amber" data-jump-quiz="${esc(t)}">Quiz</button></div></div>`).join('') || `<p class="muted card-pad">No topics.</p>`;
    $('overview-next-tasks').innerHTML = state.tasks.filter((t) => t.status === 'pending').slice(0, 5).map((t) => `<div class="list-row"><div class="row"><button type="button" class="check-btn" data-toggle-task="${esc(t.id)}"></button><div><p class="small-strong">${esc(t.topicTitle)}</p><p class="meta">${shortDate(t.scheduledDate)} · ${t.durationMinutes}m</p></div></div></div>`).join('') || `<p class="muted card-pad">All milestones done.</p>`;
  } else if (state.tab === 'plan') {
    document.querySelectorAll('#plan-filter-group .seg').forEach((b) => b.classList.toggle('is-active', b.dataset.filter === state.filter));
    const rows = state.tasks.filter((t) => state.filter === 'all' || t.status === state.filter);
    $('plan-tasks-list').innerHTML = rows.map((t) => {
      const d = t.status === 'completed';
      return `<div class="list-row"><div class="row" style="align-items:flex-start"><button type="button" class="check-btn ${d ? 'is-done' : ''}" data-toggle-task="${esc(t.id)}">${d ? '&#10003;' : ''}</button><div><p class="small-strong ${d ? 'is-done-text' : ''}">${esc(t.topicTitle)}</p><p class="muted">${esc(t.description)}</p></div></div><span class="meta mono">${esc(t.priority)} · ${shortDate(t.scheduledDate)} · ${t.durationMinutes}m</span></div>`;
    }).join('') || `<p class="muted card-pad">No milestones match.</p>`;
  } else if (state.tab === 'summaries') {
    fillSelect('summary-topic-select', sub, false);
    $('summary-custom-topic').hidden = $('summary-topic-select').value !== '__custom__';
    const cur = state.summaries.find((s) => s.id === state.sumId) || state.summaries[0];
    $('summaries-container').innerHTML = !cur ? `<div class="card"><p class="muted">Pick a topic above and click Make Study Sheet.</p></div>` : `<div class="split">
      <div class="card flush">${state.summaries.map((s) => `<button type="button" class="history-item ${s.id === cur.id ? 'is-selected' : ''}" data-sel-sum="${esc(s.id)}"><span class="small-strong">${esc(s.topicTitle)}</span><span class="meta">${s.formulaSheet.length} formulas</span></button>`).join('')}</div>
      <article class="card">
        <h3 class="h2">${esc(cur.topicTitle)}</h3><p class="body-copy">${esc(cur.overview)}</p>
        <div class="stack-sm"><span class="small-strong">Core Concepts</span>${cur.coreConcepts.map((c, i) => `<p class="muted"><span class="mono lime">${i + 1}.</span> ${esc(c)}</p>`).join('')}</div>
        ${cur.formulaSheet.length ? `<div class="grid-2">${cur.formulaSheet.map((f) => `<div class="formula-card"><span class="small-strong">${esc(f.label)}</span><div class="formula-expr">${esc(f.expression)}</div><span class="meta">${esc(f.note)}</span></div>`).join('')}</div>` : ''}
        <div class="grid-2 divider-top"><div class="stack-sm"><span class="small-strong amber">Exam Pitfalls</span>${cur.examPitfalls.map((p) => `<p class="muted">- ${esc(p)}</p>`).join('')}</div><div class="formula-card"><span class="small-strong lime">Memory Hook</span><p class="muted">${esc(cur.memoryAnchor || 'Review derivations.')}</p></div></div>
      </article></div>`;
  } else {
    fillSelect('quiz-topic-select', sub, true);
    const weak = state.quizzes.filter((q) => q.status === 'completed' && q.questions.some((qs, i) => q.userAnswers[i] !== qs.correctIndex)).map((q) => q.topicTitle);
    $('drill-weak-btn').hidden = !weak.length;
    const cur = state.quizzes.find((q) => q.id === state.quizId) || state.quizzes[0];
    if (!cur) { $('quizzes-container').innerHTML = `<div class="card"><p class="muted">Pick a topic and click Start Quiz.</p></div>`; return; }
    const done = cur.status === 'completed', ready = cur.questions.every((_, i) => state.draft[i] >= 0);
    $('quizzes-container').innerHTML = `<div class="split">
      <div class="card flush">${state.quizzes.map((q) => `<button type="button" class="history-item ${q.id === cur.id ? 'is-selected' : ''}" data-sel-quiz="${esc(q.id)}"><span class="small-strong">${esc(q.topicTitle)}</span><span class="meta">${q.status === 'completed' ? `${q.scorePercent}%` : 'In progress'} · ${q.questions.length} Qs</span></button>`).join('')}</div>
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

function fillSelect(id, sub, all) {
  const el = $(id), prev = el.value;
  el.innerHTML = (all ? ['<option value="Comprehensive Mock">All Topics (Mock)</option>'] : [])
    .concat(sub.topics.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`))
    .concat(all ? [] : ['<option value="__custom__">Custom Topic...</option>']).join('');
  if (prev && [...el.options].some((o) => o.value === prev)) el.value = prev;
}

// ── 6. Actions, Delegated Events & Auth Boot ────────────────────────────────
const signIn = () => { banner('auth-error-msg', ''); signInWithPopup(auth, provider).catch((e) => banner('auth-error-msg', e.message)); };
function openModal(show) {
  $('add-subject-modal').hidden = !show;
  if (show) { $('new-subject-date').value = plusDays(6); $('new-subject-title').focus(); banner('modal-error', ''); banner('modal-status', ''); }
  else { $('add-subject-form').reset(); state.fileData = null; $('uploaded-file-name').textContent = 'No file attached (PDF/PNG/JPG/TXT, 10 MB max)'; $('clear-file-btn').hidden = true; }
}

async function runSummary(topic) {
  const sub = curSub(), btn = $('generate-summary-btn');
  if (!sub || !topic) return;
  btn.disabled = true; btn.textContent = 'Generating...'; banner('summary-error', '');
  try { state.sumId = await saveSummary(state.user.uid, sub.id, topic, await postJson('/api/ai/generate-summary', { subjectTitle: sub.title, topicTitle: topic, syllabusContext: sub.syllabusOverview })); }
  catch (e) { banner('summary-error', e.message); } finally { btn.disabled = false; btn.textContent = 'Make Study Sheet'; }
}

async function runQuiz(topic, weak = []) {
  const sub = curSub(), btn = $('start-quiz-btn'), difficulty = $('quiz-difficulty-select').value;
  if (!sub || !topic) return;
  btn.disabled = true; btn.textContent = 'Building...'; banner('quiz-error', '');
  try {
    const res = await postJson('/api/ai/generate-quiz', { subjectTitle: sub.title, topicTitle: topic, difficulty, questionCount: Number($('quiz-count-select').value), syllabusContext: sub.syllabusOverview, focusWeaknesses: weak });
    if (!res.questions?.length) throw new Error('No questions returned.');
    state.quizId = await saveQuiz(state.user.uid, sub.id, topic, difficulty, res.questions);
    state.draft = res.questions.map(() => -1);
  } catch (e) { banner('quiz-error', e.message); } finally { btn.disabled = false; btn.textContent = 'Start Quiz'; }
}

document.addEventListener('click', async (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.id === 'landing-signin-btn') return signIn();
  if (t.id === 'primary-action-btn' || t.id === 'sidebar-add-btn' || t.id === 'empty-add-subject-btn' || t.id === 'est-start-btn') return state.user ? openModal(true) : signIn();
  if (t.id === 'signout-btn') return signOut(auth);
  if (t.id === 'close-modal-btn' || t.id === 'cancel-modal-btn') return openModal(false);

  if (t.dataset.estDays) { state.estDays = Number(t.dataset.estDays); return renderEstimator(); }
  if (t.dataset.estHours) { state.estHours = Number(t.dataset.estHours); return renderEstimator(); }

  if (t.dataset.tab && curSub()) { state.tab = t.dataset.tab; return renderWorkspace(); }
  if (t.dataset.selectSubject) { state.subId = t.dataset.selectSubject; state.sumId = null; state.quizId = null; return subscribeSubject(state.subId); }
  if (t.id === 'jump-full-schedule-btn') { state.tab = 'plan'; return renderWorkspace(); }
  if (t.dataset.jumpSum) { state.tab = 'summaries'; renderWorkspace(); $('summary-topic-select').value = t.dataset.jumpSum; return runSummary(t.dataset.jumpSum); }
  if (t.dataset.jumpQuiz) { state.tab = 'quizzes'; renderWorkspace(); $('quiz-topic-select').value = t.dataset.jumpQuiz; return runQuiz(t.dataset.jumpQuiz); }

  if (t.id === 'ask-delete-subject-btn') { $('delete-prompt-default').hidden = true; $('delete-prompt-confirm').hidden = false; }
  if (t.id === 'cancel-delete-subject-btn') { $('delete-prompt-default').hidden = false; $('delete-prompt-confirm').hidden = true; }
  if (t.id === 'confirm-delete-subject-btn' && curSub()) { await removeSubject(curSub().id); $('delete-prompt-default').hidden = false; $('delete-prompt-confirm').hidden = true; }

  if (t.dataset.filter) { state.filter = t.dataset.filter; return renderWorkspace(); }
  if (t.id === 'toggle-add-task-btn' || t.id === 'cancel-add-task-btn') { const f = $('add-milestone-form'); f.hidden = !f.hidden; if (!f.hidden) $('milestone-date').value = plusDays(6); }
  if (t.dataset.toggleTask) { const task = state.tasks.find((x) => x.id === t.dataset.toggleTask); if (task) return toggleTask(task); }

  if (t.id === 'generate-summary-btn') { const v = $('summary-topic-select').value; return runSummary(v === '__custom__' ? $('summary-custom-topic').value.trim() : v); }
  if (t.dataset.selSum) { state.sumId = t.dataset.selSum; return renderWorkspace(); }
  if (t.id === 'start-quiz-btn') return runQuiz($('quiz-topic-select').value);
  if (t.id === 'drill-weak-btn') {
    const missed = [...new Set(state.quizzes.filter((q) => q.status === 'completed' && q.questions.some((qs, i) => q.userAnswers[i] !== qs.correctIndex)).map((q) => q.topicTitle))];
    if (missed.length) return runQuiz(`Weak Drill: ${missed[0]}`, missed);
  }
  if (t.dataset.selQuiz) { const q = state.quizzes.find((x) => x.id === t.dataset.selQuiz); if (q) { state.quizId = q.id; state.draft = q.userAnswers.slice(); return renderWorkspace(); } }
  if (t.dataset.qq !== undefined) { state.draft[Number(t.dataset.qq)] = Number(t.dataset.qo); return renderWorkspace(); }
  if (t.id === 'submit-quiz-btn') { const q = state.quizzes.find((x) => x.id === state.quizId); if (q) return gradeQuiz(q, state.draft); }

  if (t.dataset.sample !== undefined) { const s = SAMPLES[Number(t.dataset.sample)]; if (s) { $('new-subject-title').value = s.title; $('new-subject-syllabus').value = s.text; } }
  if (t.id === 'clear-file-btn') { state.fileData = null; $('syllabus-file-input').value = ''; $('uploaded-file-name').textContent = 'No file attached (PDF/PNG/JPG/TXT, 10 MB max)'; $('clear-file-btn').hidden = true; }
});

$('summary-topic-select').addEventListener('change', (e) => { $('summary-custom-topic').hidden = e.target.value !== '__custom__'; });
$('add-milestone-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!curSub() || !state.user) return;
  await addTask(state.user.uid, curSub().id, { topic: $('milestone-topic').value, date: $('milestone-date').value, mins: $('milestone-duration').value, pri: $('milestone-priority').value, desc: $('milestone-desc').value });
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
  if (!state.user) return;
  const btn = $('submit-subject-btn');
  btn.disabled = true; btn.textContent = 'Generating...'; banner('modal-error', ''); banner('modal-status', 'Reading syllabus...');
  try {
    const title = $('new-subject-title').value.trim(), examDate = $('new-subject-date').value, hours = Number($('new-subject-hours').value) || 3;
    const parsed = await postJson('/api/ai/parse-syllabus', { subjectTitle: title, examDate, dailyHours: hours, currentDate: plusDays(0), syllabusText: $('new-subject-syllabus').value, fileData: state.fileData });
    state.subId = await createSubject(state.user.uid, title, examDate, hours, parsed);
    state.tab = 'overview'; openModal(false); subscribeSubject(state.subId);
  } catch (err) { banner('modal-status', ''); banner('modal-error', err.message); } finally { btn.disabled = false; btn.textContent = 'Build Study Plan'; }
});

onAuthStateChanged(auth, async (user) => {
  state.unsubSubs?.(); state.unsubSubs = null; clearChildren();
  state.user = user; state.ready = true; state.subjects = []; state.loaded = false; state.subId = null;
  if (user) {
    await ensureUser(user).catch((e) => banner('sync-error-banner', e.message));
    state.unsubSubs = listen('subjects', [['userId', user.uid]], (items) => {
      state.subjects = items.sort((a, b) => a.examDate.localeCompare(b.examDate));
      state.loaded = true;
      if (!state.subjects.some((s) => s.id === state.subId)) { state.subId = state.subjects[0]?.id || null; subscribeSubject(state.subId); }
      else renderWorkspace();
    }, (e) => banner('sync-error-banner', e.message));
  }
  renderApp();
});
