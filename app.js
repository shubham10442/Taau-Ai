import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

// ── 1. Firebase Setup & Validation Helpers ──────────────────────────────────

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(firebaseApp);
const googleProvider = new GoogleAuthProvider();

function clampNumber(value, min, max, allowDecimal = false) {
  const num = Number(value);
  if (Number.isNaN(num)) {
    return min;
  }
  const bounded = Math.min(Math.max(num, min), max);
  return allowDecimal ? bounded : Math.round(bounded);
}

function trimText(value, maxLength, fallback = '') {
  const cleaned = String(value ?? '').trim();
  if (!cleaned) {
    return fallback;
  }
  return cleaned.slice(0, maxLength);
}

function createDocId(prefix) {
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${randomPart}`;
}

function handleFirestoreError(error, operationType, path) {
  const user = auth.currentUser;
  const details = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: user ? user.uid : null,
      email: user ? user.email : null,
    },
  };
  console.error('Firestore Error:', JSON.stringify(details));
  throw new Error(JSON.stringify(details));
}

// Verify Firestore connectivity on startup
getDocFromServer(doc(db, 'test', 'connection')).catch((error) => {
  if (String(error?.message).includes('offline')) {
    console.error('Firestore appears offline. Check firebase-applet-config.json.');
  }
});

function listenToCollection(collectionName, fieldFilters, onData, onError) {
  const constraints = fieldFilters.map(([field, value]) => where(field, '==', value));
  const collectionQuery = query(collection(db, collectionName), ...constraints);

  return onSnapshot(
    collectionQuery,
    (snapshot) => {
      const items = snapshot.docs.map((snapshotDoc) => ({
        id: snapshotDoc.id,
        ...snapshotDoc.data(),
      }));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, 'list', collectionName);
      } catch (wrappedError) {
        onError(wrappedError);
      }
    },
  );
}

// ── 2. Application State & Utility Helpers ──────────────────────────────────

const state = {
  user: null,
  authReady: false,
  subjects: [],
  subjectsLoaded: false,
  selectedSubjectId: null,
  activeTab: 'overview',
  planFilter: 'all',
  tasks: [],
  summaries: [],
  selectedSummaryId: null,
  quizzes: [],
  selectedQuizId: null,
  draftQuizAnswers: [],
  uploadedFileData: null,
  unsubSubjects: null,
  unsubChildren: [],
};

function getEl(id) {
  return document.getElementById(id);
}

function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(text ?? '').replace(/[&<>"']/g, (char) => map[char]);
}

function getSelectedSubject() {
  const match = state.subjects.find((subject) => subject.id === state.selectedSubjectId);
  return match || state.subjects[0] || null;
}

function getDaysRemaining(dateString) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const examDate = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(examDate.getTime())) {
    return 0;
  }
  const diffDays = Math.ceil((examDate.getTime() - today.getTime()) / 86400000);
  return Math.max(0, diffDays);
}

function formatShortDate(dateString) {
  if (!dateString) {
    return '';
  }
  const parsed = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return dateString;
  }
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getDateOffset(daysFromToday) {
  const target = new Date(Date.now() + daysFromToday * 86400000);
  return target.toISOString().slice(0, 10);
}

function showBanner(elementId, message) {
  const el = getEl(elementId);
  if (!el) {
    return;
  }
  el.textContent = message || '';
  el.hidden = !message;
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

// ── 4. Firestore Read & Write Functions ─────────────────────────────────────

async function ensureUserProfile(user) {
  const userPath = `users/${user.uid}`;
  try {
    const userRef = doc(db, 'users', user.uid);
    const snapshot = await getDoc(userRef);
    if (!snapshot.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        displayName: trimText(user.displayName, 120, 'Student'),
        email: trimText(user.email, 200, 'student@example.com'),
        dailyStudyHours: 3,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, 'write', userPath);
  }
}

async function createSubjectWithPlan(uid, title, examDate, hours, parsedPlan) {
  const subjectId = createDocId('sub');
  const tasks = (parsedPlan.tasks || []).slice(0, 30);
  const topics = (parsedPlan.topics || []).slice(0, 35).map((topic) => trimText(topic, 150, 'Topic'));

  try {
    await setDoc(doc(db, 'subjects', subjectId), {
      userId: uid,
      title: trimText(title, 120, 'Subject'),
      examDate: trimText(examDate, 40, getDateOffset(6)),
      dailyHours: clampNumber(hours, 0.5, 16, true),
      syllabusOverview: trimText(parsedPlan.syllabusOverview, 1500, 'Exam syllabus'),
      topics,
      totalTasks: tasks.length,
      completedTasks: 0,
      averageQuizScore: -1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (tasks.length > 0) {
      const batch = writeBatch(db);
      tasks.forEach((task, index) => {
        const validPriorities = ['high', 'medium', 'normal'];
        const priority = validPriorities.includes(task.priority) ? task.priority : 'medium';
        const taskRef = doc(db, 'studyTasks', createDocId('tsk'));

        batch.set(taskRef, {
          userId: uid,
          subjectId,
          topicTitle: trimText(task.topicTitle, 160, 'Revision'),
          description: trimText(task.description, 400, 'Review concepts and solve problems.'),
          scheduledDate: trimText(task.scheduledDate, 40, examDate),
          durationMinutes: clampNumber(task.durationMinutes, 10, 480),
          priority,
          status: 'pending',
          orderIndex: index,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
    }

    return subjectId;
  } catch (error) {
    handleFirestoreError(error, 'create', `subjects/${subjectId}`);
  }
}

async function toggleStudyTask(task) {
  const nextStatus = task.status === 'completed' ? 'pending' : 'completed';
  try {
    await updateDoc(doc(db, 'studyTasks', task.id), {
      status: nextStatus,
      updatedAt: serverTimestamp(),
    });

    const completedCount = state.tasks.filter((item) => {
      const status = item.id === task.id ? nextStatus : item.status;
      return status === 'completed';
    }).length;

    await updateDoc(doc(db, 'subjects', task.subjectId), {
      completedTasks: clampNumber(completedCount, 0, 500),
      totalTasks: clampNumber(state.tasks.length, 0, 500),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, 'update', `studyTasks/${task.id}`);
  }
}

async function addCustomTask(uid, subjectId, input) {
  const taskId = createDocId('tsk');
  try {
    await setDoc(doc(db, 'studyTasks', taskId), {
      userId: uid,
      subjectId,
      topicTitle: trimText(input.topic, 160, 'Milestone'),
      description: trimText(input.description, 400, 'Focused practice'),
      scheduledDate: trimText(input.date, 40, getDateOffset(6)),
      durationMinutes: clampNumber(input.minutes, 10, 480),
      priority: input.priority,
      status: 'pending',
      orderIndex: clampNumber(state.tasks.length, 0, 500),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await updateDoc(doc(db, 'subjects', subjectId), {
      totalTasks: clampNumber(state.tasks.length + 1, 0, 500),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, 'create', `studyTasks/${taskId}`);
  }
}

async function saveTopicSummary(uid, subjectId, topicTitle, data) {
  const summaryId = createDocId('sum');
  try {
    await setDoc(doc(db, 'studySummaries', summaryId), {
      userId: uid,
      subjectId,
      topicTitle: trimText(topicTitle, 160, 'Summary'),
      overview: trimText(data.overview, 2000, 'Summary generated.'),
      coreConcepts: (data.coreConcepts || []).slice(0, 15).map((concept) => trimText(concept, 500, 'Key point')),
      formulaSheet: (data.formulaSheet || []).slice(0, 15).map((formula) => ({
        label: trimText(formula.label, 160, 'Rule'),
        expression: trimText(formula.expression, 300, '—'),
        note: trimText(formula.note, 400, ''),
      })),
      examPitfalls: (data.examPitfalls || []).slice(0, 12).map((pitfall) => trimText(pitfall, 400, 'Check edge cases')),
      memoryAnchor: trimText(data.memoryAnchor, 600, ''),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return summaryId;
  } catch (error) {
    handleFirestoreError(error, 'create', `studySummaries/${summaryId}`);
  }
}

async function savePracticeQuiz(uid, subjectId, topicTitle, difficulty, rawQuestions) {
  const quizId = createDocId('quz');
  const questions = rawQuestions.slice(0, 15).map((question) => {
    const options = (question.options || []).slice(0, 4).map((opt) => trimText(opt, 300, 'Option'));
    while (options.length < 4) {
      options.push('None of the above');
    }
    return {
      prompt: trimText(question.prompt, 600, 'Question'),
      options,
      correctIndex: clampNumber(question.correctIndex, 0, 3),
      explanation: trimText(question.explanation, 800, 'Review topic notes.'),
    };
  });

  try {
    await setDoc(doc(db, 'quizzes', quizId), {
      userId: uid,
      subjectId,
      topicTitle: trimText(topicTitle, 160, 'Quiz'),
      difficulty,
      questions,
      userAnswers: questions.map(() => -1),
      scorePercent: -1,
      status: 'in_progress',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return quizId;
  } catch (error) {
    handleFirestoreError(error, 'create', `quizzes/${quizId}`);
  }
}

async function submitQuizAnswers(quiz, userAnswers) {
  try {
    const correctCount = quiz.questions.filter((question, index) => userAnswers[index] === question.correctIndex).length;
    const scorePercent = Math.round((correctCount / Math.max(quiz.questions.length, 1)) * 100);

    await updateDoc(doc(db, 'quizzes', quiz.id), {
      userAnswers: userAnswers.slice(0, 15).map((answer) => clampNumber(answer, -1, 3)),
      scorePercent: clampNumber(scorePercent, 0, 100),
      status: 'completed',
      updatedAt: serverTimestamp(),
    });

    const previousScores = state.quizzes
      .filter((item) => item.id !== quiz.id && item.status === 'completed' && item.scorePercent >= 0)
      .map((item) => item.scorePercent);
    const allScores = previousScores.concat(scorePercent);
    const averageScore = allScores.reduce((sum, score) => sum + score, 0) / allScores.length;

    await updateDoc(doc(db, 'subjects', quiz.subjectId), {
      averageQuizScore: clampNumber(averageScore, 0, 100, true),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, 'update', `quizzes/${quiz.id}`);
  }
}

async function deleteSubjectAndData(subjectId) {
  try {
    const taskDeletes = state.tasks.map((task) => deleteDoc(doc(db, 'studyTasks', task.id)));
    const summaryDeletes = state.summaries.map((summary) => deleteDoc(doc(db, 'studySummaries', summary.id)));
    const quizDeletes = state.quizzes.map((quiz) => deleteDoc(doc(db, 'quizzes', quiz.id)));
    await Promise.all([...taskDeletes, ...summaryDeletes, ...quizDeletes]);
    await deleteDoc(doc(db, 'subjects', subjectId));
  } catch (error) {
    handleFirestoreError(error, 'delete', `subjects/${subjectId}`);
  }
}

// ── 5. Real-Time Subscriptions ──────────────────────────────────────────────

function clearSubjectListeners() {
  state.unsubChildren.forEach((unsubscribe) => unsubscribe());
  state.unsubChildren = [];
}

function subscribeToSubjectData(subjectId) {
  clearSubjectListeners();

  if (!state.user || !subjectId) {
    state.tasks = [];
    state.summaries = [];
    state.quizzes = [];
    renderWorkspace();
    return;
  }

  const uid = state.user.uid;
  const onSyncError = (error) => showBanner('sync-error-banner', `Cloud sync notice: ${error.message}`);

  const unsubTasks = listenToCollection(
    'studyTasks',
    [['userId', uid], ['subjectId', subjectId]],
    (items) => {
      state.tasks = items.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || a.orderIndex - b.orderIndex);
      renderWorkspace();
    },
    onSyncError,
  );

  const unsubSummaries = listenToCollection(
    'studySummaries',
    [['userId', uid], ['subjectId', subjectId]],
    (items) => {
      state.summaries = items;
      const stillExists = items.some((summary) => summary.id === state.selectedSummaryId);
      if (!stillExists) {
        state.selectedSummaryId = items[0]?.id || null;
      }
      renderWorkspace();
    },
    onSyncError,
  );

  const unsubQuizzes = listenToCollection(
    'quizzes',
    [['userId', uid], ['subjectId', subjectId]],
    (items) => {
      state.quizzes = items;
      const currentQuiz = items.find((quiz) => quiz.id === state.selectedQuizId) || items[0] || null;
      if (!currentQuiz) {
        state.selectedQuizId = null;
        state.draftQuizAnswers = [];
      } else if (currentQuiz.id !== state.selectedQuizId) {
        state.selectedQuizId = currentQuiz.id;
        state.draftQuizAnswers = currentQuiz.userAnswers.slice();
      }
      renderWorkspace();
    },
    onSyncError,
  );

  state.unsubChildren = [unsubTasks, unsubSummaries, unsubQuizzes];
}

// ── 5. Small Focused Render Helpers ─────────────────────────────────────────

function renderSidebar(activeSubject) {
  getEl('subject-count').textContent = String(state.subjects.length);

  if (state.subjects.length === 0) {
    getEl('subject-list').innerHTML = '<p class="meta">No subjects yet.</p>';
    return;
  }

  const cardsHtml = state.subjects.map((subject) => {
    const progress = subject.totalTasks > 0
      ? Math.round((subject.completedTasks / subject.totalTasks) * 100)
      : 0;
    const days = getDaysRemaining(subject.examDate);
    const daysClass = days <= 3 ? 'amber' : 'lime';
    const selectedClass = activeSubject?.id === subject.id ? 'is-selected' : '';
    const quizLabel = subject.averageQuizScore >= 0 ? `${Math.round(subject.averageQuizScore)}%` : 'no quiz';

    return `
      <button type="button" class="subject-item ${selectedClass}" data-select-subject="${escapeHtml(subject.id)}">
        <div class="row between">
          <span class="small-strong truncate">${escapeHtml(subject.title)}</span>
          <span class="mono ${daysClass}">${days}d</span>
        </div>
        <div class="track"><div class="fill" style="width: ${progress}%"></div></div>
        <div class="row between meta mono">
          <span>${subject.completedTasks}/${subject.totalTasks}</span>
          <span>${quizLabel}</span>
        </div>
      </button>
    `;
  }).join('');

  getEl('subject-list').innerHTML = cardsHtml;
}

function renderOverviewTab(subject) {
  getEl('overview-syllabus-text').textContent = subject.syllabusOverview || 'No overview.';
  getEl('overview-sheets-count').textContent = `${state.summaries.length} sheets`;

  if (subject.topics.length === 0) {
    getEl('overview-topics-list').innerHTML = '<p class="muted card-pad">No topics.</p>';
  } else {
    getEl('overview-topics-list').innerHTML = subject.topics.map((topic, index) => `
      <div class="list-row">
        <span class="truncate small-strong">
          <span class="mono muted">${String(index + 1).padStart(2, '0')}</span> ${escapeHtml(topic)}
        </span>
        <div class="row">
          <button type="button" class="link-btn" data-jump-sum="${escapeHtml(topic)}">Sheet</button>
          <span class="meta">·</span>
          <button type="button" class="link-btn amber" data-jump-quiz="${escapeHtml(topic)}">Quiz</button>
        </div>
      </div>
    `).join('');
  }

  const pendingTasks = state.tasks.filter((task) => task.status === 'pending').slice(0, 5);
  if (pendingTasks.length === 0) {
    getEl('overview-next-tasks').innerHTML = '<p class="muted card-pad">All milestones done.</p>';
  } else {
    getEl('overview-next-tasks').innerHTML = pendingTasks.map((task) => `
      <div class="list-row">
        <div class="row">
          <button type="button" class="check-btn" data-toggle-task="${escapeHtml(task.id)}"></button>
          <div>
            <p class="small-strong">${escapeHtml(task.topicTitle)}</p>
            <p class="meta">${formatShortDate(task.scheduledDate)} · ${task.durationMinutes}m</p>
          </div>
        </div>
      </div>
    `).join('');
  }
}

function renderStudyPlanTab() {
  document.querySelectorAll('#plan-filter-group .seg').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.filter === state.planFilter);
  });

  const filteredTasks = state.tasks.filter((task) => {
    return state.planFilter === 'all' || task.status === state.planFilter;
  });

  if (filteredTasks.length === 0) {
    getEl('plan-tasks-list').innerHTML = '<p class="muted card-pad">No milestones match this filter.</p>';
    return;
  }

  getEl('plan-tasks-list').innerHTML = filteredTasks.map((task) => {
    const isDone = task.status === 'completed';
    const checkIcon = isDone ? '&#10003;' : '';
    return `
      <div class="list-row">
        <div class="row align-top">
          <button type="button" class="check-btn ${isDone ? 'is-done' : ''}" data-toggle-task="${escapeHtml(task.id)}">${checkIcon}</button>
          <div>
            <p class="small-strong ${isDone ? 'is-done-text' : ''}">${escapeHtml(task.topicTitle)}</p>
            <p class="muted">${escapeHtml(task.description)}</p>
          </div>
        </div>
        <span class="meta mono">${escapeHtml(task.priority)} · ${formatShortDate(task.scheduledDate)} · ${task.durationMinutes}m</span>
      </div>
    `;
  }).join('');
}

function populateTopicSelect(selectId, subject, includeAllOption) {
  const selectEl = getEl(selectId);
  const previousValue = selectEl.value;
  const options = [];

  if (includeAllOption) {
    options.push('<option value="Comprehensive Mock">All Topics (Mock)</option>');
  }
  subject.topics.forEach((topic) => {
    options.push(`<option value="${escapeHtml(topic)}">${escapeHtml(topic)}</option>`);
  });
  if (!includeAllOption) {
    options.push('<option value="__custom__">Custom Topic...</option>');
  }

  selectEl.innerHTML = options.join('');
  if (previousValue && Array.from(selectEl.options).some((opt) => opt.value === previousValue)) {
    selectEl.value = previousValue;
  }
}

function renderSummariesTab(subject) {
  populateTopicSelect('summary-topic-select', subject, false);
  getEl('summary-custom-topic').hidden = getEl('summary-topic-select').value !== '__custom__';

  const current = state.summaries.find((item) => item.id === state.selectedSummaryId) || state.summaries[0];
  if (!current) {
    getEl('summaries-container').innerHTML = '<div class="card"><p class="muted">Pick a topic above and click Make Study Sheet.</p></div>';
    return;
  }

  const historyListHtml = state.summaries.map((item) => `
    <button type="button" class="history-item ${item.id === current.id ? 'is-selected' : ''}" data-sel-sum="${escapeHtml(item.id)}">
      <span class="small-strong">${escapeHtml(item.topicTitle)}</span>
      <span class="meta">${item.formulaSheet.length} formulas</span>
    </button>
  `).join('');

  const conceptsHtml = current.coreConcepts.map((concept, index) => `
    <p class="muted"><span class="mono lime">${index + 1}.</span> ${escapeHtml(concept)}</p>
  `).join('');

  const formulasHtml = current.formulaSheet.length > 0
    ? `<div class="grid-2">${current.formulaSheet.map((formula) => `
        <div class="formula-card">
          <span class="small-strong">${escapeHtml(formula.label)}</span>
          <div class="formula-expr">${escapeHtml(formula.expression)}</div>
          <span class="meta">${escapeHtml(formula.note)}</span>
        </div>
      `).join('')}</div>`
    : '';

  const pitfallsHtml = current.examPitfalls.map((pitfall) => `<p class="muted">- ${escapeHtml(pitfall)}</p>`).join('');

  getEl('summaries-container').innerHTML = `
    <div class="split">
      <div class="card flush">${historyListHtml}</div>
      <article class="card">
        <h3 class="h2">${escapeHtml(current.topicTitle)}</h3>
        <p class="body-copy">${escapeHtml(current.overview)}</p>
        <div class="stack-sm">
          <span class="small-strong">Core Concepts</span>
          ${conceptsHtml}
        </div>
        ${formulasHtml}
        <div class="grid-2 divider-top">
          <div class="stack-sm">
            <span class="small-strong amber">Exam Pitfalls</span>
            ${pitfallsHtml}
          </div>
          <div class="formula-card">
            <span class="small-strong lime">Memory Hook</span>
            <p class="muted">${escapeHtml(current.memoryAnchor || 'Review derivations.')}</p>
          </div>
        </div>
      </article>
    </div>
  `;
}

function getMissedQuizTopics() {
  const missed = state.quizzes
    .filter((quiz) => {
      if (quiz.status !== 'completed') {
        return false;
      }
      return quiz.questions.some((question, index) => quiz.userAnswers[index] !== question.correctIndex);
    })
    .map((quiz) => quiz.topicTitle);
  return [...new Set(missed)];
}

function renderQuizzesTab(subject) {
  populateTopicSelect('quiz-topic-select', subject, true);
  getEl('drill-weak-btn').hidden = getMissedQuizTopics().length === 0;

  const current = state.quizzes.find((item) => item.id === state.selectedQuizId) || state.quizzes[0];
  if (!current) {
    getEl('quizzes-container').innerHTML = '<div class="card"><p class="muted">Pick a topic and click Start Quiz.</p></div>';
    return;
  }

  const isCompleted = current.status === 'completed';
  const allAnswered = current.questions.every((_, index) => state.draftQuizAnswers[index] >= 0);

  const historyListHtml = state.quizzes.map((item) => {
    const statusText = item.status === 'completed' ? `${item.scorePercent}%` : 'In progress';
    return `
      <button type="button" class="history-item ${item.id === current.id ? 'is-selected' : ''}" data-sel-quiz="${escapeHtml(item.id)}">
        <span class="small-strong">${escapeHtml(item.topicTitle)}</span>
        <span class="meta">${statusText} · ${item.questions.length} Qs</span>
      </button>
    `;
  }).join('');

  const questionsHtml = current.questions.map((question, qIndex) => {
    const picked = isCompleted ? current.userAnswers[qIndex] : state.draftQuizAnswers[qIndex];
    const optionsHtml = question.options.map((option, oIndex) => {
      let optionClass = '';
      if (isCompleted) {
        if (oIndex === question.correctIndex) {
          optionClass = 'is-correct';
        } else if (oIndex === picked) {
          optionClass = 'is-wrong';
        }
      } else if (picked === oIndex) {
        optionClass = 'is-selected';
      }

      const letter = String.fromCharCode(65 + oIndex);
      const attrs = isCompleted ? 'disabled' : `data-qq="${qIndex}" data-qo="${oIndex}"`;
      return `
        <button type="button" class="quiz-opt ${optionClass}" ${attrs}>
          <span class="mono">${letter}.</span>
          <span>${escapeHtml(option)}</span>
        </button>
      `;
    }).join('');

    const explanationHtml = isCompleted ? `<p class="meta">${escapeHtml(question.explanation)}</p>` : '';
    return `
      <div class="stack-sm divider-top">
        <p class="small-strong"><span class="mono">Q${qIndex + 1}.</span> ${escapeHtml(question.prompt)}</p>
        ${optionsHtml}
        ${explanationHtml}
      </div>
    `;
  }).join('');

  const scoreHtml = isCompleted
    ? `<span class="kpi ${current.scorePercent >= 70 ? 'lime' : 'amber'}">${current.scorePercent}%</span>`
    : '';
  const submitButtonHtml = isCompleted
    ? ''
    : `<div class="row end"><button type="button" id="submit-quiz-btn" class="btn primary" ${allAnswered ? '' : 'disabled'}>Grade Quiz</button></div>`;

  getEl('quizzes-container').innerHTML = `
    <div class="split">
      <div class="card flush">${historyListHtml}</div>
      <div class="card">
        <div class="row between">
          <div>
            <h3 class="h2">${escapeHtml(current.topicTitle)}</h3>
            <p class="meta">${escapeHtml(current.difficulty)} · ${current.questions.length} Qs</p>
          </div>
          ${scoreHtml}
        </div>
        ${questionsHtml}
        ${submitButtonHtml}
      </div>
    </div>
  `;
}

function renderWorkspace() {
  if (!state.user) {
    return;
  }

  const subject = getSelectedSubject();
  renderSidebar(subject);

  getEl('empty-subjects-state').hidden = !state.subjectsLoaded || Boolean(subject);
  getEl('subject-workspace').hidden = !subject;

  document.querySelectorAll('.tab').forEach((button) => {
    button.disabled = !subject;
    button.classList.toggle('is-active', button.dataset.tab === state.activeTab);
  });

  if (!subject) {
    return;
  }

  const completedTasks = state.tasks.filter((task) => task.status === 'completed').length;
  const progressPercent = state.tasks.length > 0 ? Math.round((completedTasks / state.tasks.length) * 100) : 0;
  const gradedQuizzes = state.quizzes.filter((quiz) => quiz.status === 'completed' && quiz.scorePercent >= 0);
  const averageQuiz = gradedQuizzes.length > 0
    ? `${Math.round(gradedQuizzes.reduce((sum, quiz) => sum + quiz.scorePercent, 0) / gradedQuizzes.length)}%`
    : '—';

  getEl('subject-title-heading').textContent = subject.title;
  getEl('subject-meta-line').textContent = `Exam ${formatShortDate(subject.examDate)} · ${subject.dailyHours}h/day · ${subject.topics.length} topics`;
  getEl('readiness-percent').textContent = `${progressPercent}%`;
  getEl('readiness-bar-fill').style.width = `${progressPercent}%`;
  getEl('kpi-days').textContent = `${getDaysRemaining(subject.examDate)}d`;
  getEl('kpi-milestones').textContent = `${completedTasks}/${state.tasks.length}`;
  getEl('kpi-quiz-avg').textContent = averageQuiz;

  ['overview', 'plan', 'summaries', 'quizzes'].forEach((tabName) => {
    getEl(`panel-${tabName}`).hidden = state.activeTab !== tabName;
  });

  if (state.activeTab === 'overview') {
    renderOverviewTab(subject);
  } else if (state.activeTab === 'plan') {
    renderStudyPlanTab();
  } else if (state.activeTab === 'summaries') {
    renderSummariesTab(subject);
  } else {
    renderQuizzesTab(subject);
  }
}

function renderApp() {
  getEl('boot-loader').hidden = state.authReady;
  if (!state.authReady) {
    return;
  }

  const isSignedIn = Boolean(state.user);
  getEl('landing-view').hidden = isSignedIn;
  getEl('workspace-view').hidden = !isSignedIn;
  getEl('landing-nav').hidden = isSignedIn;
  getEl('workspace-nav').hidden = !isSignedIn;
  getEl('primary-action-btn').textContent = isSignedIn ? '+ New Subject' : 'Sign In';

  if (!isSignedIn) {
    return;
  }

  const firstName = (state.user.displayName || 'Student').split(' ')[0];
  getEl('user-display-name').textContent = state.user.displayName || 'Student';
  getEl('user-email').textContent = state.user.email || '';
  getEl('welcome-heading').textContent = `Ready to plan, ${firstName}?`;
  renderWorkspace();
}

// ── 7. Actions & Event Wiring ───────────────────────────────────────────────

async function signInWithGoogle() {
  showBanner('auth-error-msg', '');
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    showBanner('auth-error-msg', error.message || 'Sign in failed.');
  }
}

function toggleAddSubjectModal(show) {
  getEl('add-subject-modal').hidden = !show;
  if (show) {
    getEl('new-subject-date').value = getDateOffset(6);
    getEl('new-subject-title').focus();
    showBanner('modal-error', '');
    showBanner('modal-status', '');
  } else {
    getEl('add-subject-form').reset();
    state.uploadedFileData = null;
    getEl('uploaded-file-name').textContent = 'No file attached (PDF/PNG/JPG/TXT, 10 MB max)';
    getEl('clear-file-btn').hidden = true;
  }
}

async function generateSummaryForTopic(topicTitle) {
  const subject = getSelectedSubject();
  const button = getEl('generate-summary-btn');
  if (!subject || !topicTitle) {
    return;
  }

  button.disabled = true;
  button.textContent = 'Generating...';
  showBanner('summary-error', '');

  try {
    const result = await postJson('/api/ai/generate-summary', {
      subjectTitle: subject.title,
      topicTitle,
      syllabusContext: subject.syllabusOverview,
    });
    state.selectedSummaryId = await saveTopicSummary(state.user.uid, subject.id, topicTitle, result);
  } catch (error) {
    showBanner('summary-error', error.message);
  } finally {
    button.disabled = false;
    button.textContent = 'Make Study Sheet';
  }
}

async function generateQuizForTopic(topicTitle, focusWeaknesses = []) {
  const subject = getSelectedSubject();
  const button = getEl('start-quiz-btn');
  const difficulty = getEl('quiz-difficulty-select').value;
  if (!subject || !topicTitle) {
    return;
  }

  button.disabled = true;
  button.textContent = 'Building...';
  showBanner('quiz-error', '');

  try {
    const result = await postJson('/api/ai/generate-quiz', {
      subjectTitle: subject.title,
      topicTitle,
      difficulty,
      questionCount: Number(getEl('quiz-count-select').value),
      syllabusContext: subject.syllabusOverview,
      focusWeaknesses,
    });
    if (!result.questions?.length) {
      throw new Error('No questions returned.');
    }
    state.selectedQuizId = await savePracticeQuiz(state.user.uid, subject.id, topicTitle, difficulty, result.questions);
    state.draftQuizAnswers = result.questions.map(() => -1);
  } catch (error) {
    showBanner('quiz-error', error.message);
  } finally {
    button.disabled = false;
    button.textContent = 'Start Quiz';
  }
}

function setupEventListeners() {
  // Static buttons
  getEl('landing-signin-btn').addEventListener('click', signInWithGoogle);
  getEl('primary-action-btn').addEventListener('click', () => (state.user ? toggleAddSubjectModal(true) : signInWithGoogle()));
  getEl('sidebar-add-btn').addEventListener('click', () => toggleAddSubjectModal(true));
  getEl('empty-add-subject-btn').addEventListener('click', () => toggleAddSubjectModal(true));
  getEl('signout-btn').addEventListener('click', () => signOut(auth));
  getEl('close-modal-btn').addEventListener('click', () => toggleAddSubjectModal(false));
  getEl('cancel-modal-btn').addEventListener('click', () => toggleAddSubjectModal(false));

  // Top workspace tabs & sidebar subjects
  getEl('workspace-nav').addEventListener('click', (event) => {
    const tabButton = event.target.closest('[data-tab]');
    if (!tabButton || !getSelectedSubject()) return;
    state.activeTab = tabButton.dataset.tab;
    renderWorkspace();
  });

  getEl('subject-list').addEventListener('click', (event) => {
    const item = event.target.closest('[data-select-subject]');
    if (!item) return;
    state.selectedSubjectId = item.dataset.selectSubject;
    state.selectedSummaryId = null;
    state.selectedQuizId = null;
    subscribeToSubjectData(state.selectedSubjectId);
  });

  // Overview tab actions
  getEl('jump-full-schedule-btn').addEventListener('click', () => {
    state.activeTab = 'plan';
    renderWorkspace();
  });

  getEl('overview-topics-list').addEventListener('click', (event) => {
    const summaryBtn = event.target.closest('[data-jump-sum]');
    if (summaryBtn) {
      const topic = summaryBtn.dataset.jumpSum;
      state.activeTab = 'summaries';
      renderWorkspace();
      getEl('summary-topic-select').value = topic;
      generateSummaryForTopic(topic);
      return;
    }

    const quizBtn = event.target.closest('[data-jump-quiz]');
    if (quizBtn) {
      const topic = quizBtn.dataset.jumpQuiz;
      state.activeTab = 'quizzes';
      renderWorkspace();
      getEl('quiz-topic-select').value = topic;
      generateQuizForTopic(topic);
    }
  });

  getEl('overview-next-tasks').addEventListener('click', (event) => {
    const toggleBtn = event.target.closest('[data-toggle-task]');
    if (!toggleBtn) return;
    const task = state.tasks.find((item) => item.id === toggleBtn.dataset.toggleTask);
    if (task) toggleStudyTask(task);
  });

  getEl('ask-delete-subject-btn').addEventListener('click', () => {
    getEl('delete-prompt-default').hidden = true;
    getEl('delete-prompt-confirm').hidden = false;
  });

  getEl('cancel-delete-subject-btn').addEventListener('click', () => {
    getEl('delete-prompt-default').hidden = false;
    getEl('delete-prompt-confirm').hidden = true;
  });

  getEl('confirm-delete-subject-btn').addEventListener('click', async () => {
    const subject = getSelectedSubject();
    if (!subject) return;
    await deleteSubjectAndData(subject.id);
    getEl('delete-prompt-default').hidden = false;
    getEl('delete-prompt-confirm').hidden = true;
  });

  // Study Plan tab actions
  getEl('plan-filter-group').addEventListener('click', (event) => {
    const filterBtn = event.target.closest('[data-filter]');
    if (!filterBtn) return;
    state.planFilter = filterBtn.dataset.filter;
    renderWorkspace();
  });

  const toggleMilestoneForm = () => {
    const form = getEl('add-milestone-form');
    form.hidden = !form.hidden;
    if (!form.hidden) {
      getEl('milestone-date').value = getDateOffset(6);
    }
  };
  getEl('toggle-add-task-btn').addEventListener('click', toggleMilestoneForm);
  getEl('cancel-add-task-btn').addEventListener('click', toggleMilestoneForm);

  getEl('plan-tasks-list').addEventListener('click', (event) => {
    const toggleBtn = event.target.closest('[data-toggle-task]');
    if (!toggleBtn) return;
    const task = state.tasks.find((item) => item.id === toggleBtn.dataset.toggleTask);
    if (task) toggleStudyTask(task);
  });

  getEl('add-milestone-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const subject = getSelectedSubject();
    if (!subject || !state.user) return;
    await addCustomTask(state.user.uid, subject.id, {
      topic: getEl('milestone-topic').value,
      date: getEl('milestone-date').value,
      minutes: getEl('milestone-duration').value,
      priority: getEl('milestone-priority').value,
      description: getEl('milestone-desc').value,
    });
    event.target.reset();
    event.target.hidden = true;
  });

  // Summaries tab actions
  getEl('summary-topic-select').addEventListener('change', (event) => {
    getEl('summary-custom-topic').hidden = event.target.value !== '__custom__';
  });

  getEl('generate-summary-btn').addEventListener('click', () => {
    const selected = getEl('summary-topic-select').value;
    const topic = selected === '__custom__' ? getEl('summary-custom-topic').value.trim() : selected;
    generateSummaryForTopic(topic);
  });

  getEl('summaries-container').addEventListener('click', (event) => {
    const item = event.target.closest('[data-sel-sum]');
    if (!item) return;
    state.selectedSummaryId = item.dataset.selSum;
    renderWorkspace();
  });

  // Quizzes tab actions
  getEl('start-quiz-btn').addEventListener('click', () => {
    generateQuizForTopic(getEl('quiz-topic-select').value);
  });

  getEl('drill-weak-btn').addEventListener('click', () => {
    const missedTopics = getMissedQuizTopics();
    if (missedTopics.length > 0) {
      generateQuizForTopic(`Weak Drill: ${missedTopics[0]}`, missedTopics);
    }
  });

  getEl('quizzes-container').addEventListener('click', (event) => {
    const historyBtn = event.target.closest('[data-sel-quiz]');
    if (historyBtn) {
      const quiz = state.quizzes.find((item) => item.id === historyBtn.dataset.selQuiz);
      if (quiz) {
        state.selectedQuizId = quiz.id;
        state.draftQuizAnswers = quiz.userAnswers.slice();
        renderWorkspace();
      }
      return;
    }

    const optionBtn = event.target.closest('[data-qq]');
    if (optionBtn) {
      const qIndex = Number(optionBtn.dataset.qq);
      const oIndex = Number(optionBtn.dataset.qo);
      state.draftQuizAnswers[qIndex] = oIndex;
      renderWorkspace();
      return;
    }

    if (event.target.closest('#submit-quiz-btn')) {
      const quiz = state.quizzes.find((item) => item.id === state.selectedQuizId);
      if (quiz) {
        submitQuizAnswers(quiz, state.draftQuizAnswers);
      }
    }
  });

  // Add Subject modal file upload & submit
  getEl('clear-file-btn').addEventListener('click', () => {
    state.uploadedFileData = null;
    getEl('syllabus-file-input').value = '';
    getEl('uploaded-file-name').textContent = 'No file attached (PDF/PNG/JPG/TXT, 10 MB max)';
    getEl('clear-file-btn').hidden = true;
  });

  getEl('syllabus-file-input').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    showBanner('modal-error', '');
    if (file.size > 10 * 1024 * 1024) {
      showBanner('modal-error', 'File exceeds 10 MB limit.');
      return;
    }

    if (file.type.startsWith('text/') || /\.(txt|md)$/i.test(file.name)) {
      const textContent = await file.text();
      getEl('new-subject-syllabus').value = textContent.slice(0, 20000);
      state.uploadedFileData = null;
    } else {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read file.'));
        reader.readAsDataURL(file);
      });
      state.uploadedFileData = {
        mimeType: file.type || 'application/pdf',
        base64: dataUrl.split(',')[1] || '',
      };
    }

    getEl('uploaded-file-name').textContent = file.name;
    getEl('clear-file-btn').hidden = false;
  });

  getEl('add-subject-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!state.user) return;

    const submitBtn = getEl('submit-subject-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Generating...';
    showBanner('modal-error', '');
    showBanner('modal-status', 'Reading syllabus and building milestones...');

    try {
      const title = getEl('new-subject-title').value.trim();
      const examDate = getEl('new-subject-date').value;
      const dailyHours = Number(getEl('new-subject-hours').value) || 3;

      const parsedPlan = await postJson('/api/ai/parse-syllabus', {
        subjectTitle: title,
        examDate,
        dailyHours,
        currentDate: getDateOffset(0),
        syllabusText: getEl('new-subject-syllabus').value,
        fileData: state.uploadedFileData,
      });

      const newSubjectId = await createSubjectWithPlan(state.user.uid, title, examDate, dailyHours, parsedPlan);
      state.selectedSubjectId = newSubjectId;
      state.activeTab = 'overview';
      toggleAddSubjectModal(false);
      subscribeToSubjectData(newSubjectId);
    } catch (error) {
      showBanner('modal-status', '');
      showBanner('modal-error', error.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Build Study Plan';
    }
  });
}

// ── 8. Boot Application ─────────────────────────────────────────────────────

setupEventListeners();

onAuthStateChanged(auth, async (user) => {
  if (state.unsubSubjects) {
    state.unsubSubjects();
    state.unsubSubjects = null;
  }
  clearSubjectListeners();

  state.user = user;
  state.authReady = true;
  state.subjects = [];
  state.subjectsLoaded = false;
  state.selectedSubjectId = null;

  if (user) {
    await ensureUserProfile(user).catch((error) => showBanner('sync-error-banner', error.message));
    state.unsubSubjects = listenToCollection(
      'subjects',
      [['userId', user.uid]],
      (items) => {
        state.subjects = items.sort((a, b) => a.examDate.localeCompare(b.examDate));
        state.subjectsLoaded = true;

        const hasCurrent = state.subjects.some((subject) => subject.id === state.selectedSubjectId);
        if (!hasCurrent) {
          state.selectedSubjectId = state.subjects[0]?.id || null;
          subscribeToSubjectData(state.selectedSubjectId);
        } else {
          renderWorkspace();
        }
      },
      (error) => showBanner('sync-error-banner', error.message),
    );
  }

  renderApp();
});
