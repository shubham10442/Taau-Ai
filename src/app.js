import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import {
  collection, deleteDoc, doc, getDoc, getDocFromServer, getFirestore,
  onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// ── 1. Firebase Setup & Helpers ─────────────────────────────────────────────
const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(fbApp);
const googleProvider = new GoogleAuthProvider();

// Clamp strings/numbers so Firestore writes always satisfy security rules
const clampText = (val, max, fallback = '') => {
  const s = String(val ?? '').trim();
  return !s ? fallback : s.length > max ? s.slice(0, max) : s;
};
const clampNum = (val, min, max, isFloat = false) => {
  const n = Number(val);
  if (Number.isNaN(n)) return min;
  const clamped = Math.min(Math.max(n, min), max);
  return isFloat ? clamped : Math.round(clamped);
};
const makeId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

// Standard error formatter required for Firestore debugging
function handleDbError(error, operationType, path) {
  const user = auth.currentUser;
  const info = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: { userId: user?.uid ?? null, email: user?.email ?? null },
  };
  console.error('Firestore Error:', JSON.stringify(info));
  throw new Error(JSON.stringify(info));
}

// Verify Firestore connection on startup
getDocFromServer(doc(db, 'test', 'connection')).catch((err) => {
  if (String(err?.message).includes('offline')) console.error('Check Firebase configuration.');
});

// Generic real-time listener for user-owned collections
function listenCollection(name, filters, onData, onError) {
  const q = query(collection(db, name), ...filters.map(([k, v]) => where(k, '==', v)));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      try { handleDbError(err, 'list', name); }
      catch (wrapped) { onError(wrapped); }
    },
  );
}

// ── 2. Static Demo & Sample Data ────────────────────────────────────────────
const SAMPLE_SYLLABI = [
  {
    title: 'Data Structures & Algorithms',
    syllabus: [
      'Unit 1: Time & Space Complexity (Big-O, Recurrence Relations, Master Theorem)',
      'Unit 2: Arrays, Linked Lists, Stacks & Queues (Infix to Postfix, Circular Queues)',
      'Unit 3: Trees & BSTs (Traversals, AVL Rotations, Heap Sort & Priority Queues)',
      'Unit 4: Hashing & Graphs (Collision Resolution, BFS, DFS, Dijkstra, Kruskal MST)',
      'Unit 5: Searching & Sorting (Merge Sort, Quick Sort, Binary Search edge cases)',
    ].join('\n'),
  },
  {
    title: 'Discrete Mathematics',
    syllabus: [
      'Module 1: Propositional & Predicate Logic (Truth Tables, Quantifiers, Contradiction)',
      'Module 2: Sets, Relations & Functions (Equivalence Relations, Partial Orders, Bijections)',
      'Module 3: Mathematical Induction & Recursion (Strong Induction, Recurrence Solving)',
      'Module 4: Combinatorics (Permutations, Combinations, Pigeonhole, Inclusion-Exclusion)',
      'Module 5: Graph Theory Basics (Eulerian & Hamiltonian Paths, Chromatic Number)',
    ].join('\n'),
  },
  {
    title: 'Macroeconomics Finals',
    syllabus: [
      'Module 1: National Income Accounting (GDP, GNP, CPI vs GDP Deflator)',
      'Module 2: Aggregate Demand & Supply (Short-run vs Long-run equilibrium, Stagflation)',
      'Module 3: Fiscal Policy & Multiplier (Spending multiplier, Tax multiplier, Crowding out)',
      'Module 4: Monetary Policy & Banking (Money multiplier, Reserve requirements, Taylor Rule)',
    ].join('\n'),
  },
];

const WALKTHROUGH_DATA = {
  dsa: {
    meta: '6 days left · 3h/day',
    rawTitle: 'CS101 · End-Sem Syllabus Snippet',
    rawSyllabus: 'Unit 1: Recurrence Relations, Big-O & Master Theorem\nUnit 2: Stacks, Queues, Infix-to-Postfix & Circular Buffers\nUnit 3: Binary Search Trees, AVL Rotations & Binary Heaps\nUnit 4: Graph Traversals (BFS/DFS), Dijkstra & Kruskal MST',
    plan: [
      { day: 'Day 1', topic: 'Master Theorem & Recurrences', duration: '45m', tag: 'High Priority', cls: 'is-amber' },
      { day: 'Day 2', topic: 'AVL Rotations (LL, RR, LR, RL)', duration: '60m', tag: 'High Priority', cls: 'is-amber' },
      { day: 'Day 4', topic: 'Dijkstra vs Bellman-Ford Edge Cases', duration: '50m', tag: 'Scheduled', cls: '' },
      { day: 'Day 6', topic: 'Past-Paper Timed Mock (Units 1-4)', duration: '75m', tag: 'Final Drill', cls: 'is-lime' },
    ],
    formulaTitle: 'Master Theorem & AVL Balance',
    formulaNote: 'Check Case 2 log factor carefully on midterm proofs.',
    formulas: [
      { label: 'Master Theorem (Case 2)', expr: 'T(n) = aT(n/b) + Θ(n^c log^k n) -> Θ(n^c log^(k+1) n) when c = log_b(a)' },
      { label: 'AVL Balance Factor', expr: 'BF(node) = height(left) - height(right) in {-1, 0, +1}' },
    ],
    pitfall: 'Common mark-loser: forgetting that Dijkstra fails when any reachable edge has a negative weight.',
    quiz: {
      question: 'Which recurrence gives T(n) = Θ(n log n) under the Master Theorem?',
      options: ['T(n) = 2T(n/2) + n', 'T(n) = 4T(n/2) + n', 'T(n) = 2T(n/2) + n^2', 'T(n) = T(n-1) + n'],
      correctIndex: 0,
      explanation: 'a = 2, b = 2 so log_2(2) = 1. Since f(n) = Θ(n^1), Case 2 applies and gives Θ(n log n).',
    },
  },
  discrete: {
    meta: '4 days left · 2.5h/day',
    rawTitle: 'MA102 · Discrete Math Outline',
    rawSyllabus: 'Mod 1: Predicate Quantifiers, Contrapositive & Contradiction\nMod 2: Equivalence Relations, Reflexive/Symmetric/Transitive Proofs\nMod 3: Strong Induction & Linear Homogeneous Recurrences\nMod 4: Pigeonhole Principle & Inclusion-Exclusion Counting',
    plan: [
      { day: 'Day 1', topic: 'Quantifier Negation & Proof Patterns', duration: '40m', tag: 'High Priority', cls: 'is-amber' },
      { day: 'Day 2', topic: 'Equivalence Classes & Hasse Diagrams', duration: '50m', tag: 'Scheduled', cls: '' },
      { day: 'Day 3', topic: 'Pigeonhole & Inclusion-Exclusion Sets', duration: '55m', tag: 'High Priority', cls: 'is-amber' },
      { day: 'Day 4', topic: 'Mixed Proof & Counting Drill', duration: '60m', tag: 'Final Drill', cls: 'is-lime' },
    ],
    formulaTitle: 'Counting & Recurrence Rules',
    formulaNote: 'Always define your pigeons vs holes explicitly on paper.',
    formulas: [
      { label: 'Generalized Pigeonhole', expr: 'At least ceil(N / k) objects share one of k boxes' },
      { label: 'Inclusion-Exclusion (3 sets)', expr: '|A U B U C| = Sum|A| - Sum|A n B| + |A n B n C|' },
    ],
    pitfall: 'Common mark-loser: claiming a relation is transitive without testing pairs (a, b) and (b, c) where a = c.',
    quiz: {
      question: 'Minimum students needed to guarantee at least 3 were born in the same month?',
      options: ['24', '25', '26', '36'],
      correctIndex: 1,
      explanation: 'With 12 months, at most 2 * 12 = 24 avoid 3 per month. Adding 1 more (25) guarantees 3 in one month.',
    },
  },
};

// ── 3. Application State & Small Utilities ──────────────────────────────────
const state = {
  user: null,
  authReady: false,
  wtCourse: 'dsa',
  wtStep: 0,
  wtPicked: null,
  subjects: [],
  subjectsLoaded: false,
  activeSubjectId: null,
  activeTab: 'overview',
  planFilter: 'all',
  tasks: [],
  summaries: [],
  activeSummaryId: null,
  quizzes: [],
  activeQuizId: null,
  draftAnswers: [],
  uploadedFile: null,
  unsubSubjects: null,
  unsubChildren: [],
};

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const activeSubject = () => state.subjects.find((s) => s.id === state.activeSubjectId) || state.subjects[0] || null;
const daysLeft = (d) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const t = new Date(`${d}T00:00:00`);
  return Number.isNaN(t.getTime()) ? 0 : Math.max(0, Math.ceil((t - today) / 86400000));
};
const shortDate = (d) => (!d || Number.isNaN(new Date(`${d}T00:00:00`).getTime()))
  ? (d || '') : new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const defaultExamDate = () => new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10);

function setBanner(id, msg) {
  const el = $(id);
  if (!el) return;
  el.textContent = msg || '';
  el.hidden = !msg;
}

async function postJson(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// ── 4. Firestore Mutations ──────────────────────────────────────────────────
async function ensureProfile(user) {
  const ref = doc(db, 'users', user.uid);
  try {
    if (!(await getDoc(ref)).exists()) {
      await setDoc(ref, {
        uid: user.uid,
        displayName: clampText(user.displayName, 120, 'Student'),
        email: clampText(user.email, 200, 'student@example.com'),
        dailyStudyHours: 3,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) { handleDbError(err, 'write', `users/${user.uid}`); }
}

async function createSubject(uid, title, examDate, hours, parsed) {
  const subjectId = makeId('sub');
  const topics = (parsed.topics || []).slice(0, 35).map((t) => clampText(t, 150, 'Topic'));
  const tasks = (parsed.tasks || []).slice(0, 30);

  try {
    await setDoc(doc(db, 'subjects', subjectId), {
      userId: uid,
      title: clampText(title, 120, 'Untitled Subject'),
      examDate: clampText(examDate, 40, defaultExamDate()),
      dailyHours: clampNum(hours, 0.5, 16, true),
      syllabusOverview: clampText(parsed.syllabusOverview, 1500, 'Exam revision syllabus'),
      topics,
      totalTasks: tasks.length,
      completedTasks: 0,
      averageQuizScore: -1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    if (tasks.length) {
      const batch = writeBatch(db);
      tasks.forEach((t, i) => {
        const pri = ['high', 'medium', 'normal'].includes(t.priority) ? t.priority : 'medium';
        batch.set(doc(db, 'studyTasks', makeId('tsk')), {
          userId: uid,
          subjectId,
          topicTitle: clampText(t.topicTitle, 160, 'Revision Topic'),
          description: clampText(t.description, 400, 'Review core concepts and practice problems.'),
          scheduledDate: clampText(t.scheduledDate, 40, examDate),
          durationMinutes: clampNum(t.durationMinutes, 10, 480),
          priority: pri,
          status: 'pending',
          orderIndex: i,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
    }
    return subjectId;
  } catch (err) { handleDbError(err, 'create', `subjects/${subjectId}`); }
}

async function toggleTask(task) {
  const next = task.status === 'completed' ? 'pending' : 'completed';
  try {
    await updateDoc(doc(db, 'studyTasks', task.id), { status: next, updatedAt: serverTimestamp() });
    const done = state.tasks.reduce((n, t) => n + ((t.id === task.id ? next : t.status) === 'completed' ? 1 : 0), 0);
    await updateDoc(doc(db, 'subjects', task.subjectId), {
      completedTasks: clampNum(done, 0, 500),
      totalTasks: clampNum(state.tasks.length, 0, 500),
      updatedAt: serverTimestamp(),
    });
  } catch (err) { handleDbError(err, 'update', `studyTasks/${task.id}`); }
}

async function addTask(uid, subjectId, payload) {
  const id = makeId('tsk');
  try {
    await setDoc(doc(db, 'studyTasks', id), {
      userId: uid,
      subjectId,
      topicTitle: clampText(payload.topicTitle, 160, 'Custom Milestone'),
      description: clampText(payload.description, 400, 'Complete focused revision session.'),
      scheduledDate: clampText(payload.scheduledDate, 40, defaultExamDate()),
      durationMinutes: clampNum(payload.durationMinutes, 10, 480),
      priority: payload.priority,
      status: 'pending',
      orderIndex: clampNum(state.tasks.length, 0, 500),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'subjects', subjectId), {
      totalTasks: clampNum(state.tasks.length + 1, 0, 500),
      updatedAt: serverTimestamp(),
    });
  } catch (err) { handleDbError(err, 'create', `studyTasks/${id}`); }
}

async function saveSummary(uid, subjectId, topicTitle, data) {
  const id = makeId('sum');
  try {
    await setDoc(doc(db, 'studySummaries', id), {
      userId: uid,
      subjectId,
      topicTitle: clampText(topicTitle, 160, 'Topic Summary'),
      overview: clampText(data.overview, 2000, 'Summary generated.'),
      coreConcepts: (data.coreConcepts || []).slice(0, 15).map((c) => clampText(c, 500, 'Key point')),
      formulaSheet: (data.formulaSheet || []).slice(0, 15).map((f) => ({
        label: clampText(f.label, 160, 'Rule'),
        expression: clampText(f.expression, 300, '—'),
        note: clampText(f.note, 400, 'Apply directly'),
      })),
      examPitfalls: (data.examPitfalls || []).slice(0, 12).map((p) => clampText(p, 400, 'Check edge cases')),
      memoryAnchor: clampText(data.memoryAnchor, 600, ''),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (err) { handleDbError(err, 'create', `studySummaries/${id}`); }
}

async function saveQuiz(uid, subjectId, topicTitle, difficulty, questions) {
  const id = makeId('quz');
  const qs = (questions || []).slice(0, 15).map((q) => {
    const opts = (q.options || []).slice(0, 4).map((o) => clampText(o, 300, 'Option'));
    while (opts.length < 4) opts.push('None of the above');
    return {
      prompt: clampText(q.prompt, 600, 'Question'),
      options: opts,
      correctIndex: clampNum(q.correctIndex, 0, 3),
      explanation: clampText(q.explanation, 800, 'Review topic notes.'),
    };
  });
  try {
    await setDoc(doc(db, 'quizzes', id), {
      userId: uid,
      subjectId,
      topicTitle: clampText(topicTitle, 160, 'Practice Quiz'),
      difficulty,
      questions: qs,
      userAnswers: qs.map(() => -1),
      scorePercent: -1,
      status: 'in_progress',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (err) { handleDbError(err, 'create', `quizzes/${id}`); }
}

async function gradeQuiz(quiz, answers) {
  const correct = quiz.questions.filter((q, i) => answers[i] === q.correctIndex).length;
  const score = Math.round((correct / Math.max(quiz.questions.length, 1)) * 100);
  try {
    await updateDoc(doc(db, 'quizzes', quiz.id), {
      userAnswers: answers.slice(0, 15).map((a) => clampNum(a, -1, 3)),
      scorePercent: clampNum(score, 0, 100),
      status: 'completed',
      updatedAt: serverTimestamp(),
    });
    const scores = state.quizzes
      .filter((q) => q.id !== quiz.id && q.status === 'completed' && q.scorePercent >= 0)
      .map((q) => q.scorePercent)
      .concat(score);
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    await updateDoc(doc(db, 'subjects', quiz.subjectId), {
      averageQuizScore: clampNum(avg, 0, 100, true),
      updatedAt: serverTimestamp(),
    });
  } catch (err) { handleDbError(err, 'update', `quizzes/${quiz.id}`); }
}

async function removeSubject(subjectId) {
  try {
    await Promise.all([
      ...state.tasks.map((t) => deleteDoc(doc(db, 'studyTasks', t.id))),
      ...state.summaries.map((s) => deleteDoc(doc(db, 'studySummaries', s.id))),
      ...state.quizzes.map((q) => deleteDoc(doc(db, 'quizzes', q.id))),
    ]);
    await deleteDoc(doc(db, 'subjects', subjectId));
  } catch (err) { handleDbError(err, 'delete', `subjects/${subjectId}`); }
}

// ── 5. Real-Time Subscriptions ──────────────────────────────────────────────
function clearChildListeners() {
  state.unsubChildren.forEach((fn) => fn());
  state.unsubChildren = [];
}

function subscribeSubjectData(subjectId) {
  clearChildListeners();
  if (!state.user || !subjectId) {
    state.tasks = []; state.summaries = []; state.quizzes = [];
    return renderWorkspace();
  }
  const uid = state.user.uid;
  const onErr = (err) => setBanner('sync-error-banner', `Cloud sync notice: ${err.message}`);

  state.unsubChildren.push(
    listenCollection('studyTasks', [['userId', uid], ['subjectId', subjectId]], (items) => {
      state.tasks = items.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || a.orderIndex - b.orderIndex);
      renderWorkspace();
    }, onErr),
    listenCollection('studySummaries', [['userId', uid], ['subjectId', subjectId]], (items) => {
      state.summaries = items;
      if (!state.summaries.some((s) => s.id === state.activeSummaryId)) state.activeSummaryId = items[0]?.id || null;
      renderWorkspace();
    }, onErr),
    listenCollection('quizzes', [['userId', uid], ['subjectId', subjectId]], (items) => {
      state.quizzes = items;
      const cur = items.find((q) => q.id === state.activeQuizId) || items[0] || null;
      if (!cur) { state.activeQuizId = null; state.draftAnswers = []; }
      else if (cur.id !== state.activeQuizId) { state.activeQuizId = cur.id; state.draftAnswers = cur.userAnswers.slice(); }
      renderWorkspace();
    }, onErr),
  );
}

// ── 6. Landing Walkthrough & Workspace Renderers ────────────────────────────
function renderWalkthrough() {
  const c = WALKTHROUGH_DATA[state.wtCourse];
  $('wt-meta-tag').textContent = c.meta;
  document.querySelectorAll('.wt-course-btn').forEach((b) => b.classList.toggle('is-active', b.dataset.wtCourse === state.wtCourse));
  document.querySelectorAll('.wt-step-btn').forEach((b) => b.classList.toggle('is-active', Number(b.dataset.wtStep) === state.wtStep));

  const nextBtn = state.wtStep < 3
    ? `<button type="button" class="btn-primary-sm" data-wt-next>Next step &rarr;</button>`
    : `<button type="button" class="btn-primary-sm" id="wt-start-btn">Try with your syllabus &rarr;</button>`;

  let body = '';
  if (state.wtStep === 0) {
    body = `<p class="small-strong">${esc(c.rawTitle)}</p><pre class="wt-raw-box">${esc(c.rawSyllabus)}</pre><p class="meta-text">No need to format bullets manually. Gemini extracts topics and weights priority.</p>`;
  } else if (state.wtStep === 1) {
    body = `<p class="small-strong">Generated Milestones</p><div class="stack-sm">${c.plan.map((p) =>
      `<div class="wt-plan-row"><span class="mono-index ${p.cls}">${esc(p.day)}</span><span class="small-strong">${esc(p.topic)}</span><span class="meta-text tabular-nums">${esc(p.duration)} · ${esc(p.tag)}</span></div>`
    ).join('')}</div>`;
  } else if (state.wtStep === 2) {
    body = `<div class="card-header"><span class="small-strong">${esc(c.formulaTitle)}</span><span class="meta-text">${esc(c.formulaNote)}</span></div>
      ${c.formulas.map((f) => `<div class="formula-card"><span class="small-strong">${esc(f.label)}</span><div class="formula-expr">${esc(f.expr)}</div></div>`).join('')}
      <p class="meta-text is-amber">${esc(c.pitfall)}</p>`;
  } else {
    const q = c.quiz;
    body = `<p class="small-strong">${esc(q.question)}</p><div class="stack-sm">${q.options.map((opt, i) => {
      let cls = 'quiz-option-btn';
      if (state.wtPicked !== null) {
        if (i === q.correctIndex) cls += ' is-correct';
        else if (i === state.wtPicked) cls += ' is-wrong';
      }
      return `<button type="button" class="${cls}" data-wt-opt="${i}"><span class="mono-index">${String.fromCharCode(65 + i)}.</span><span>${esc(opt)}</span></button>`;
    }).join('')}</div>${state.wtPicked !== null ? `<div class="explanation-box">${esc(q.explanation)}</div>` : '<p class="meta-text">Pick an option to test instant grading.</p>'}`;
  }

  $('walkthrough-stage').innerHTML = `<div class="stack-sm">${body}</div>
    <div class="wt-stage-footer"><span class="meta-text">Step 0${state.wtStep + 1} of 04</span>${nextBtn}</div>`;
}

function renderApp() {
  $('boot-loader').hidden = state.authReady;
  if (!state.authReady) { $('landing-view').hidden = true; $('workspace-view').hidden = true; return; }

  const signedIn = Boolean(state.user);
  $('landing-view').hidden = signedIn;
  $('workspace-view').hidden = !signedIn;
  $('landing-nav').hidden = signedIn;
  $('workspace-nav').hidden = !signedIn;
  $('mobile-workspace-nav').hidden = !signedIn;
  $('primary-action-btn').textContent = signedIn ? '+ New Subject' : 'Sign In';

  if (!signedIn) renderWalkthrough();
  else {
    $('user-display-name').textContent = state.user.displayName || 'Student';
    $('user-email').textContent = state.user.email || '';
    $('mobile-user-email').textContent = state.user.email || '';
    $('welcome-heading').textContent = `Ready to plan, ${(state.user.displayName || 'Student').split(' ')[0]}?`;
    renderWorkspace();
  }
}

function renderWorkspace() {
  if (!state.user) return;
  const sub = activeSubject();
  $('subject-count').textContent = String(state.subjects.length);

  // Sidebar subjects
  $('subject-list').innerHTML = state.subjects.map((s) => {
    const pct = s.totalTasks > 0 ? Math.round((s.completedTasks / s.totalTasks) * 100) : 0;
    return `<button type="button" class="subject-item ${sub?.id === s.id ? 'is-selected' : ''}" data-select-subject="${esc(s.id)}">
      <div class="subject-item-top"><span class="subject-item-name">${esc(s.title)}</span><span class="mono-index ${daysLeft(s.examDate) <= 3 ? 'is-amber' : 'is-lime'}">${daysLeft(s.examDate)}d</span></div>
      <div class="progress-track progress-track-sm"><div class="progress-fill" style="width:${pct}%"></div></div>
      <div class="subject-item-meta"><span>${s.completedTasks}/${s.totalTasks} done</span><span>${s.averageQuizScore >= 0 ? `${Math.round(s.averageQuizScore)}% avg` : 'no quiz'}</span></div>
    </button>`;
  }).join('') || `<p class="meta-text">No subjects yet.</p>`;

  const hasSub = Boolean(sub);
  $('empty-subjects-state').hidden = !state.subjectsLoaded || hasSub;
  $('subject-workspace').hidden = !hasSub;
  document.querySelectorAll('.nav-tab, .mobile-tab').forEach((b) => {
    b.disabled = !hasSub;
    b.classList.toggle('is-active', b.dataset.tab === state.activeTab);
  });
  if (!sub) return;

  // Header & 3 KPIs
  const done = state.tasks.filter((t) => t.status === 'completed').length;
  const total = state.tasks.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const graded = state.quizzes.filter((q) => q.status === 'completed' && q.scorePercent >= 0);
  const avgQuiz = graded.length ? `${Math.round(graded.reduce((a, q) => a + q.scorePercent, 0) / graded.length)}%` : '—';

  $('subject-title-heading').textContent = sub.title;
  $('subject-meta-line').textContent = `Exam ${shortDate(sub.examDate)} · ${sub.dailyHours}h/day · ${sub.topics.length} topics`;
  $('readiness-percent').textContent = `${pct}%`;
  $('readiness-bar-fill').style.width = `${pct}%`;
  $('kpi-days').textContent = `${daysLeft(sub.examDate)}d`;
  $('kpi-milestones').textContent = `${done}/${total}`;
  $('kpi-quiz-avg').textContent = avgQuiz;

  // Toggle active tab panel
  ['overview', 'plan', 'summaries', 'quizzes'].forEach((t) => { $(`panel-${t}`).hidden = state.activeTab !== t; });

  if (state.activeTab === 'overview') renderOverview(sub);
  else if (state.activeTab === 'plan') renderPlan();
  else if (state.activeTab === 'summaries') renderSummaries(sub);
  else renderQuizzes(sub);
}

function renderOverview(sub) {
  $('overview-syllabus-text').textContent = sub.syllabusOverview || 'No overview saved.';
  $('overview-sheets-count').textContent = `${state.summaries.length} sheets saved`;

  $('overview-topics-list').innerHTML = sub.topics.map((t, i) => `
    <div class="topic-row">
      <div class="topic-left"><span class="mono-index">${String(i + 1).padStart(2, '0')}</span><span class="topic-name">${esc(t)}</span></div>
      <div class="btn-group">
        <button type="button" class="link-btn" data-jump-summary="${esc(t)}">Sheet</button>
        <span class="sep">·</span>
        <button type="button" class="link-btn is-amber" data-jump-quiz="${esc(t)}">Quiz</button>
      </div>
    </div>`).join('') || `<p class="muted-text" style="padding:18px 22px">No topics parsed.</p>`;

  const upcoming = state.tasks.filter((t) => t.status === 'pending').slice(0, 5);
  $('overview-next-tasks').innerHTML = upcoming.map((t) => `
    <div class="task-row">
      <div class="task-main">
        <button type="button" class="task-check-btn" data-toggle-task="${esc(t.id)}" aria-label="Mark done"></button>
        <div><p class="task-title">${esc(t.topicTitle)}</p><p class="meta-text">${esc(shortDate(t.scheduledDate))} · ${t.durationMinutes}m</p></div>
      </div>
    </div>`).join('') || `<p class="muted-text" style="padding:18px 22px">All milestones finished.</p>`;
}

function renderPlan() {
  document.querySelectorAll('#plan-filter-group .seg-btn').forEach((b) => b.classList.toggle('is-active', b.dataset.filter === state.planFilter));
  const list = state.tasks.filter((t) => state.planFilter === 'all' || t.status === state.planFilter);

  $('plan-tasks-list').innerHTML = list.map((t) => {
    const done = t.status === 'completed';
    const priCls = t.priority === 'high' ? 'is-amber' : t.priority === 'medium' ? 'is-lime' : '';
    return `<div class="task-row">
      <div class="task-main">
        <button type="button" class="task-check-btn ${done ? 'is-done' : ''}" data-toggle-task="${esc(t.id)}" aria-label="Toggle milestone">${done ? '&#10003;' : ''}</button>
        <div>
          <p class="task-title ${done ? 'is-done' : ''}">${esc(t.topicTitle)}</p>
          <p class="muted-text">${esc(t.description)}</p>
        </div>
      </div>
      <div class="btn-group" style="flex-shrink:0">
        <span class="mono-index ${priCls}">${esc(t.priority)}</span>
        <span class="mono-index">${esc(shortDate(t.scheduledDate))} · ${t.durationMinutes}m</span>
      </div>
    </div>`;
  }).join('') || `<p class="muted-text" style="padding:24px 22px">No milestones match this filter.</p>`;
}

function populateTopics(selectId, sub, includeAll = false) {
  const el = $(selectId);
  const prev = el.value;
  const opts = [];
  if (includeAll) opts.push(`<option value="Comprehensive Subject Mock">All Topics (Mock)</option>`);
  sub.topics.forEach((t) => opts.push(`<option value="${esc(t)}">${esc(t)}</option>`));
  if (!includeAll) opts.push(`<option value="__custom__">Custom Topic...</option>`);
  el.innerHTML = opts.join('');
  if (prev && [...el.options].some((o) => o.value === prev)) el.value = prev;
}

function renderSummaries(sub) {
  populateTopics('summary-topic-select', sub);
  $('summary-custom-topic').hidden = $('summary-topic-select').value !== '__custom__';

  if (!state.summaries.length) {
    $('summaries-container').innerHTML = `<div class="card"><p class="muted-text">Pick a topic above and click Make Study Sheet to generate concepts, formulas, and exam pitfalls.</p></div>`;
    return;
  }

  const active = state.summaries.find((s) => s.id === state.activeSummaryId) || state.summaries[0];
  $('summaries-container').innerHTML = `<div class="split-workspace">
    <div class="history-list">
      <div class="history-header">Saved Sheets (${state.summaries.length})</div>
      ${state.summaries.map((s) => `<button type="button" class="history-item ${s.id === active.id ? 'is-selected' : ''}" data-select-summary="${esc(s.id)}">
        <span class="small-strong">${esc(s.topicTitle)}</span>
        <span class="meta-text">${s.formulaSheet.length} formulas · ${s.coreConcepts.length} concepts</span>
      </button>`).join('')}
    </div>
    <article class="card">
      <h3 class="section-title-sm">${esc(active.topicTitle)}</h3>
      <p class="body-copy">${esc(active.overview)}</p>
      <div class="stack-sm">
        <span class="small-strong">Core Concepts</span>
        ${active.coreConcepts.map((c, i) => `<p class="muted-text"><span class="mono-index is-lime">${i + 1}.</span> ${esc(c)}</p>`).join('')}
      </div>
      ${active.formulaSheet.length ? `<div class="stack-sm"><span class="small-strong">Formula &amp; Rule Sheet</span>
        <div class="formula-grid">${active.formulaSheet.map((f) => `<div class="formula-card"><span class="small-strong">${esc(f.label)}</span><div class="formula-expr">${esc(f.expression)}</div><span class="meta-text">${esc(f.note)}</span></div>`).join('')}</div>
      </div>` : ''}
      <div class="pitfall-anchor-grid">
        <div class="stack-sm"><span class="small-strong is-amber">Exam Pitfalls</span>${active.examPitfalls.map((p) => `<p class="muted-text">- ${esc(p)}</p>`).join('')}</div>
        <div class="memory-box stack-sm"><span class="small-strong is-lime">Quick Memory Hook</span><p class="body-copy">${esc(active.memoryAnchor || 'Review step-by-step derivations.')}</p></div>
      </div>
    </article>
  </div>`;
}

function renderQuizzes(sub) {
  populateTopics('quiz-topic-select', sub, true);
  const weakTopics = [...new Set(state.quizzes.filter((q) => q.status === 'completed').flatMap((q) =>
    q.questions.some((qs, i) => q.userAnswers[i] !== qs.correctIndex) ? [q.topicTitle] : []
  ))];
  $('drill-weak-btn').hidden = !weakTopics.length;

  if (!state.quizzes.length) {
    $('quizzes-container').innerHTML = `<div class="card"><p class="muted-text">Choose a topic and click Start Quiz to test yourself with instant grading.</p></div>`;
    return;
  }

  const active = state.quizzes.find((q) => q.id === state.activeQuizId) || state.quizzes[0];
  const done = active.status === 'completed';
  const allPicked = active.questions.every((_, i) => state.draftAnswers[i] >= 0);

  $('quizzes-container').innerHTML = `<div class="split-workspace">
    <div class="history-list">
      <div class="history-header">Quiz Attempts (${state.quizzes.length})</div>
      ${state.quizzes.map((q) => `<button type="button" class="history-item ${q.id === active.id ? 'is-selected' : ''}" data-select-quiz="${esc(q.id)}">
        <span class="small-strong">${esc(q.topicTitle)}</span>
        <span class="meta-text">${q.status === 'completed' ? `Score: ${q.scorePercent}%` : 'In progress'} · ${q.questions.length} Qs</span>
      </button>`).join('')}
    </div>
    <div class="card">
      <div class="card-header">
        <div><h3 class="section-title-sm">${esc(active.topicTitle)}</h3><p class="meta-text">${esc(active.difficulty)} · ${active.questions.length} questions</p></div>
        ${done ? `<span class="kpi-value ${active.scorePercent >= 70 ? 'is-lime' : 'is-amber'}">${active.scorePercent}%</span>` : ''}
      </div>
      <div class="stack-md">
        ${active.questions.map((q, qi) => {
          const picked = done ? active.userAnswers[qi] : state.draftAnswers[qi];
          return `<div class="stack-sm" style="padding-top:14px;border-top:1px solid var(--border-soft)">
            <p class="small-strong"><span class="mono-index">Q${qi + 1}.</span> ${esc(q.prompt)}</p>
            ${q.options.map((opt, oi) => {
              let cls = 'quiz-option-btn';
              if (done) cls += oi === q.correctIndex ? ' is-correct' : oi === picked ? ' is-wrong' : '';
              else if (picked === oi) cls += ' is-selected';
              return `<button type="button" class="${cls}" ${done ? 'disabled' : `data-quiz-q="${qi}" data-quiz-o="${oi}"`}><span class="mono-index">${String.fromCharCode(65 + oi)}.</span><span>${esc(opt)}</span></button>`;
            }).join('')}
            ${done ? `<div class="explanation-box">${esc(q.explanation)}</div>` : ''}
          </div>`;
        }).join('')}
      </div>
      ${done ? '' : `<div class="form-actions"><button type="button" id="submit-quiz-btn" class="btn-primary" ${allPicked ? '' : 'disabled'}>Grade Quiz</button></div>`}
    </div>
  </div>`;
}

// ── 7. Actions & Event Handlers ─────────────────────────────────────────────
async function handleSignIn() {
  setBanner('auth-error-msg', '');
  try { await signInWithPopup(auth, googleProvider); }
  catch (err) { setBanner('auth-error-msg', err.message || 'Sign in failed.'); }
}

function openModal(show) {
  $('add-subject-modal').hidden = !show;
  if (show) {
    $('new-subject-date').value = defaultExamDate();
    $('new-subject-title').focus();
    setBanner('modal-error', ''); setBanner('modal-status', '');
  } else {
    $('add-subject-form').reset();
    state.uploadedFile = null;
    $('uploaded-file-name').textContent = 'No file attached (up to 10 MB)';
    $('clear-file-btn').hidden = true;
  }
}

async function generateSummaryFor(topic) {
  const sub = activeSubject();
  if (!sub || !topic) return;
  const btn = $('generate-summary-btn');
  btn.disabled = true; btn.textContent = 'Generating...'; setBanner('summary-error', '');
  try {
    const res = await postJson('/api/ai/generate-summary', { subjectTitle: sub.title, topicTitle: topic, syllabusContext: sub.syllabusOverview });
    state.activeSummaryId = await saveSummary(state.user.uid, sub.id, topic, res);
  } catch (err) { setBanner('summary-error', err.message); }
  finally { btn.disabled = false; btn.textContent = 'Make Study Sheet'; }
}

async function startQuizFor(topic, weaknesses = []) {
  const sub = activeSubject();
  if (!sub || !topic) return;
  const btn = $('start-quiz-btn');
  btn.disabled = true; btn.textContent = 'Building...'; setBanner('quiz-error', '');
  try {
    const difficulty = $('quiz-difficulty-select').value;
    const res = await postJson('/api/ai/generate-quiz', {
      subjectTitle: sub.title, topicTitle: topic, difficulty,
      questionCount: Number($('quiz-count-select').value),
      syllabusContext: sub.syllabusOverview, focusWeaknesses: weaknesses,
    });
    const questions = res.questions || [];
    if (!questions.length) throw new Error('No questions returned. Try again.');
    const id = await saveQuiz(state.user.uid, sub.id, topic, difficulty, questions);
    state.activeQuizId = id;
    state.draftAnswers = questions.map(() => -1);
  } catch (err) { setBanner('quiz-error', err.message); }
  finally { btn.disabled = false; btn.textContent = 'Start Quiz'; }
}

// Single delegated click listener keeps DOM wiring concise
document.addEventListener('click', async (e) => {
  const target = e.target.closest('button, [data-wt-course], [data-wt-step]');
  if (!target) return;

  if (target.id === 'landing-signin-btn') return handleSignIn();
  if (target.id === 'primary-action-btn') return state.user ? openModal(true) : handleSignIn();
  if (target.id === 'signout-btn' || target.id === 'mobile-signout-btn') return signOut(auth);
  if (target.id === 'sidebar-add-btn' || target.id === 'empty-add-subject-btn' || target.id === 'wt-start-btn') {
    return state.user ? openModal(true) : handleSignIn();
  }
  if (target.id === 'close-modal-btn' || target.id === 'cancel-modal-btn') return openModal(false);

  // Walkthrough controls
  if (target.dataset.wtCourse) { state.wtCourse = target.dataset.wtCourse; state.wtPicked = null; return renderWalkthrough(); }
  if (target.dataset.wtStep !== undefined) { state.wtStep = Number(target.dataset.wtStep); state.wtPicked = null; return renderWalkthrough(); }
  if (target.hasAttribute('data-wt-next')) { state.wtStep = Math.min(3, state.wtStep + 1); state.wtPicked = null; return renderWalkthrough(); }
  if (target.dataset.wtOpt !== undefined) { state.wtPicked = Number(target.dataset.wtOpt); return renderWalkthrough(); }

  // Workspace navigation & subjects
  if (target.dataset.tab && activeSubject()) { state.activeTab = target.dataset.tab; return renderWorkspace(); }
  if (target.dataset.selectSubject) {
    state.activeSubjectId = target.dataset.selectSubject;
    state.activeSummaryId = null; state.activeQuizId = null;
    return subscribeSubjectData(state.activeSubjectId);
  }
  if (target.id === 'jump-full-schedule-btn') { state.activeTab = 'plan'; return renderWorkspace(); }
  if (target.dataset.jumpSummary) {
    state.activeTab = 'summaries'; renderWorkspace();
    $('summary-topic-select').value = target.dataset.jumpSummary;
    return generateSummaryFor(target.dataset.jumpSummary);
  }
  if (target.dataset.jumpQuiz) {
    state.activeTab = 'quizzes'; renderWorkspace();
    $('quiz-topic-select').value = target.dataset.jumpQuiz;
    return startQuizFor(target.dataset.jumpQuiz);
  }

  // Delete subject confirmation
  if (target.id === 'ask-delete-subject-btn') { $('delete-prompt-default').hidden = true; $('delete-prompt-confirm').hidden = false; }
  if (target.id === 'cancel-delete-subject-btn') { $('delete-prompt-default').hidden = false; $('delete-prompt-confirm').hidden = true; }
  if (target.id === 'confirm-delete-subject-btn' && activeSubject()) {
    await removeSubject(activeSubject().id);
    $('delete-prompt-default').hidden = false; $('delete-prompt-confirm').hidden = true;
  }

  // Study plan controls
  if (target.dataset.filter) { state.planFilter = target.dataset.filter; return renderPlan(); }
  if (target.id === 'toggle-add-task-btn' || target.id === 'cancel-add-task-btn') {
    const f = $('add-milestone-form');
    f.hidden = !f.hidden;
    if (!f.hidden) $('milestone-date').value = defaultExamDate();
  }
  if (target.dataset.toggleTask) {
    const task = state.tasks.find((t) => t.id === target.dataset.toggleTask);
    if (task) return toggleTask(task);
  }

  // Summaries & Quizzes controls
  if (target.id === 'generate-summary-btn') {
    const sel = $('summary-topic-select').value;
    return generateSummaryFor(sel === '__custom__' ? $('summary-custom-topic').value.trim() : sel);
  }
  if (target.dataset.selectSummary) { state.activeSummaryId = target.dataset.selectSummary; return renderWorkspace(); }
  if (target.id === 'start-quiz-btn') return startQuizFor($('quiz-topic-select').value);
  if (target.id === 'drill-weak-btn') {
    const missed = [...new Set(state.quizzes.filter((q) => q.status === 'completed').flatMap((q) =>
      q.questions.some((qs, i) => q.userAnswers[i] !== qs.correctIndex) ? [q.topicTitle] : []
    ))];
    if (missed.length) return startQuizFor(`Weak Area Drill: ${missed[0]}`, missed);
  }
  if (target.dataset.selectQuiz) {
    const q = state.quizzes.find((x) => x.id === target.dataset.selectQuiz);
    if (q) { state.activeQuizId = q.id; state.draftAnswers = q.userAnswers.slice(); return renderWorkspace(); }
  }
  if (target.dataset.quizQ !== undefined) {
    state.draftAnswers[Number(target.dataset.quizQ)] = Number(target.dataset.quizO);
    return renderWorkspace();
  }
  if (target.id === 'submit-quiz-btn') {
    const q = state.quizzes.find((x) => x.id === state.activeQuizId);
    if (q) return gradeQuiz(q, state.draftAnswers);
  }

  // Sample syllabus fill & file clear
  if (target.dataset.sample !== undefined) {
    const s = SAMPLE_SYLLABI[Number(target.dataset.sample)];
    if (s) { $('new-subject-title').value = s.title; $('new-subject-syllabus').value = s.syllabus; }
  }
  if (target.id === 'clear-file-btn') {
    state.uploadedFile = null; $('syllabus-file-input').value = '';
    $('uploaded-file-name').textContent = 'No file attached (up to 10 MB)'; $('clear-file-btn').hidden = true;
  }
});

// Form submissions & file input
$('summary-topic-select').addEventListener('change', (e) => {
  $('summary-custom-topic').hidden = e.target.value !== '__custom__';
});

$('add-milestone-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const sub = activeSubject();
  if (!sub || !state.user) return;
  await addTask(state.user.uid, sub.id, {
    topicTitle: $('milestone-topic').value,
    scheduledDate: $('milestone-date').value,
    durationMinutes: $('milestone-duration').value,
    priority: $('milestone-priority').value,
    description: $('milestone-desc').value,
  });
  e.target.reset();
  e.target.hidden = true;
});

$('syllabus-file-input').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  setBanner('modal-error', '');
  if (file.size > 10 * 1024 * 1024) return setBanner('modal-error', 'File exceeds the 10 MB limit.');

  if (file.type.startsWith('text/') || /\.(txt|md)$/i.test(file.name)) {
    $('new-subject-syllabus').value = (await file.text()).slice(0, 20000);
    state.uploadedFile = null;
  } else {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read file.'));
      reader.readAsDataURL(file);
    });
    state.uploadedFile = { mimeType: file.type || 'application/pdf', base64: dataUrl.split(',')[1] || '' };
  }
  $('uploaded-file-name').textContent = file.name;
  $('clear-file-btn').hidden = false;
});

$('add-subject-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!state.user) return;
  const btn = $('submit-subject-btn');
  btn.disabled = true; btn.textContent = 'Generating...';
  setBanner('modal-error', ''); setBanner('modal-status', 'Reading syllabus and building milestones...');

  try {
    const title = $('new-subject-title').value.trim();
    const examDate = $('new-subject-date').value;
    const hours = Number($('new-subject-hours').value) || 3;
    const parsed = await postJson('/api/ai/parse-syllabus', {
      subjectTitle: title, examDate, dailyHours: hours,
      currentDate: new Date().toISOString().slice(0, 10),
      syllabusText: $('new-subject-syllabus').value,
      fileData: state.uploadedFile,
    });
    const newId = await createSubject(state.user.uid, title, examDate, hours, parsed);
    state.activeSubjectId = newId; state.activeTab = 'overview';
    openModal(false);
    subscribeSubjectData(newId);
  } catch (err) {
    setBanner('modal-status', ''); setBanner('modal-error', err.message);
  } finally { btn.disabled = false; btn.textContent = 'Build Study Plan'; }
});

// ── 8. Boot Auth Listener ───────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  state.unsubSubjects?.(); state.unsubSubjects = null; clearChildListeners();
  state.user = user; state.authReady = true;
  state.subjects = []; state.subjectsLoaded = false; state.activeSubjectId = null;

  if (user) {
    await ensureProfile(user).catch((err) => setBanner('sync-error-banner', err.message));
    state.unsubSubjects = listenCollection('subjects', [['userId', user.uid]], (items) => {
      state.subjects = items.sort((a, b) => a.examDate.localeCompare(b.examDate));
      state.subjectsLoaded = true;
      if (!state.subjects.some((s) => s.id === state.activeSubjectId)) {
        state.activeSubjectId = state.subjects[0]?.id || null;
        subscribeSubjectData(state.activeSubjectId);
      } else renderWorkspace();
    }, (err) => setBanner('sync-error-banner', err.message));
  }
  renderApp();
});
