import {
  addCustomStudyTask,
  createFlashcardsBatch,
  createQuiz,
  createSubjectWithTasks,
  deleteSubjectAndChildren,
  ensureUserProfile,
  reviewFlashcardSpacedRepetition,
  saveStudySummary,
  signInWithGoogle,
  signOutUser,
  submitQuizCompletion,
  subscribeSubjectFlashcards,
  subscribeSubjectQuizzes,
  subscribeSubjects,
  subscribeSubjectSummaries,
  subscribeSubjectTasks,
  toggleStudyTask,
  watchAuth,
} from './firebase-client.js';

// Built-in sample syllabi (including 1st-year CSE subjects)
const SAMPLE_SYLLABI = [
  {
    title: 'Data Structures & Algorithms',
    syllabus: [
      'Unit 1: Time & Space Complexity (Big-O, Big-Omega, Recurrence Relations, Master Theorem)',
      'Unit 2: Arrays, Linked Lists, Stacks & Queues (Infix to Postfix, Circular Queues, Doubly Linked Lists)',
      'Unit 3: Trees & Binary Search Trees (Traversals, AVL Rotations, Heap Sort & Priority Queues)',
      'Unit 4: Hashing & Graphs (Collision Resolution, BFS, DFS, Dijkstra, Kruskal & Prim MST)',
      'Unit 5: Searching & Sorting (Merge Sort, Quick Sort, Binary Search edge cases)',
    ].join('\n'),
  },
  {
    title: 'Discrete Mathematics',
    syllabus: [
      'Module 1: Propositional & Predicate Logic (Truth Tables, Equivalences, Quantifiers, Proof by Contradiction)',
      'Module 2: Sets, Relations & Functions (Equivalence Relations, Partial Orders, Bijections)',
      'Module 3: Mathematical Induction & Recursion (Strong Induction, Recurrence Solving)',
      'Module 4: Combinatorics & Counting (Permutations, Combinations, Pigeonhole Principle, Inclusion-Exclusion)',
      'Module 5: Graph Theory Basics (Eulerian & Hamiltonian Paths, Planar Graphs, Chromatic Number)',
    ].join('\n'),
  },
  {
    title: 'Macroeconomics Finals',
    syllabus: [
      'Module 1: National Income Accounting (GDP, GNP, CPI vs GDP Deflator, Real vs Nominal)',
      'Module 2: Aggregate Demand & Aggregate Supply (Short-run vs Long-run equilibrium, Stagflation shocks)',
      'Module 3: Fiscal Policy & Multiplier Effect (Government spending multiplier, Tax multiplier, Crowding out)',
      'Module 4: Monetary Policy & Banking (Money multiplier, Reserve requirements, Taylor Rule)',
      'Module 5: Open-Economy Macroeconomics (Exchange rates, Balance of payments)',
    ].join('\n'),
  },
];

// Application state
const state = {
  user: null,
  authReady: false,
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
  draftQuizAnswers: [],
  flashcards: [],
  flashcardMode: 'due',
  flashcardIndex: 0,
  flashcardFlipped: false,
  flashcardShowHint: false,
  uploadedFileData: null,
  unsubSubjects: null,
  unsubChildren: [],
};

// Utility functions
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getDaysRemaining(examDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${examDate}T00:00:00`);
  if (Number.isNaN(target.getTime())) return 0;
  return Math.max(0, Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
}

function formatShortDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getDefaultExamDate() {
  const d = new Date();
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0, 10);
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

function getActiveSubject() {
  return state.subjects.find((s) => s.id === state.activeSubjectId) || state.subjects[0] || null;
}

function showBanner(elId, message) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (message) {
    el.textContent = message;
    el.hidden = false;
  } else {
    el.textContent = '';
    el.hidden = true;
  }
}

// Clear subject-level Firestore listeners
function clearSubjectSubscriptions() {
  state.unsubChildren.forEach((fn) => fn());
  state.unsubChildren = [];
}

function subscribeToActiveSubject(subjectId) {
  clearSubjectSubscriptions();
  if (!state.user || !subjectId) {
    state.tasks = [];
    state.summaries = [];
    state.quizzes = [];
    state.flashcards = [];
    renderWorkspace();
    return;
  }

  const uid = state.user.uid;
  const onErr = (err) => showBanner('sync-error-banner', `Cloud sync notice: ${err.message}`);

  state.unsubChildren.push(
    subscribeSubjectTasks(
      uid,
      subjectId,
      (tasks) => {
        state.tasks = tasks;
        renderWorkspace();
      },
      onErr,
    ),
    subscribeSubjectSummaries(
      uid,
      subjectId,
      (summaries) => {
        state.summaries = summaries;
        if (!state.activeSummaryId || !summaries.some((s) => s.id === state.activeSummaryId)) {
          state.activeSummaryId = summaries[0]?.id ?? null;
        }
        renderWorkspace();
      },
      onErr,
    ),
    subscribeSubjectQuizzes(
      uid,
      subjectId,
      (quizzes) => {
        state.quizzes = quizzes;
        if (!state.activeQuizId || !quizzes.some((q) => q.id === state.activeQuizId)) {
          state.activeQuizId = quizzes[0]?.id ?? null;
          const activeQ = quizzes.find((q) => q.id === state.activeQuizId);
          state.draftQuizAnswers = activeQ ? activeQ.questions.map(() => -1) : [];
        }
        renderWorkspace();
      },
      onErr,
    ),
    subscribeSubjectFlashcards(
      uid,
      subjectId,
      (cards) => {
        state.flashcards = cards;
        renderWorkspace();
      },
      onErr,
    ),
  );
}

// Switch active tab and optionally pre-select a topic
function setActiveTab(tab, preselectTopic) {
  state.activeTab = tab;

  document.querySelectorAll('.nav-tab, .mobile-tab').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.tab === tab);
  });

  ['overview', 'plan', 'summaries', 'quizzes', 'flashcards'].forEach((panelId) => {
    const panel = document.getElementById(`panel-${panelId}`);
    if (panel) panel.hidden = panelId !== tab;
  });

  if (preselectTopic) {
    if (tab === 'summaries') {
      const sel = document.getElementById('summary-topic-select');
      if (sel && Array.from(sel.options).some((o) => o.value === preselectTopic)) {
        sel.value = preselectTopic;
      }
      const match = state.summaries.find(
        (s) => s.topicTitle.toLowerCase() === preselectTopic.toLowerCase(),
      );
      if (match) state.activeSummaryId = match.id;
    } else if (tab === 'quizzes') {
      const sel = document.getElementById('quiz-topic-select');
      if (sel && Array.from(sel.options).some((o) => o.value === preselectTopic)) {
        sel.value = preselectTopic;
      }
    } else if (tab === 'flashcards') {
      const sel = document.getElementById('flashcard-topic-select');
      if (sel && Array.from(sel.options).some((o) => o.value === preselectTopic)) {
        sel.value = preselectTopic;
      }
    }
  }

  renderWorkspace();
}

// Populate topic dropdowns for Summaries, Quizzes, and Flashcards
function syncTopicSelects(subject) {
  const topics = subject.topics || [];

  const sumSel = document.getElementById('summary-topic-select');
  if (sumSel) {
    const prev = sumSel.value;
    sumSel.innerHTML =
      topics.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('') +
      '<option value="__custom__">Custom Topic...</option>';
    if (prev && Array.from(sumSel.options).some((o) => o.value === prev)) {
      sumSel.value = prev;
    }
  }

  const quizSel = document.getElementById('quiz-topic-select');
  if (quizSel) {
    const prev = quizSel.value;
    quizSel.innerHTML =
      `<option value="Full ${escapeHtml(subject.title)} Review">Full Subject Review</option>` +
      topics.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
    if (prev && Array.from(quizSel.options).some((o) => o.value === prev)) {
      quizSel.value = prev;
    }
  }

  const cardSel = document.getElementById('flashcard-topic-select');
  if (cardSel) {
    const prev = cardSel.value;
    cardSel.innerHTML =
      topics.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('') +
      `<option value="${escapeHtml(subject.title)}">General ${escapeHtml(subject.title)}</option>`;
    if (prev && Array.from(cardSel.options).some((o) => o.value === prev)) {
      cardSel.value = prev;
    }
  }
}

// Main UI Render Dispatcher
function renderApp() {
  const bootLoader = document.getElementById('boot-loader');
  const landingView = document.getElementById('landing-view');
  const workspaceView = document.getElementById('workspace-view');
  const landingNav = document.getElementById('landing-nav');
  const workspaceNav = document.getElementById('workspace-nav');
  const mobileNav = document.getElementById('mobile-workspace-nav');
  const primaryBtn = document.getElementById('primary-action-btn');

  if (!state.authReady) {
    bootLoader.hidden = false;
    landingView.hidden = true;
    workspaceView.hidden = true;
    return;
  }

  bootLoader.hidden = true;

  if (!state.user) {
    landingView.hidden = false;
    workspaceView.hidden = true;
    landingNav.hidden = false;
    workspaceNav.hidden = true;
    mobileNav.hidden = true;
    primaryBtn.textContent = 'Sign In';
    return;
  }

  landingView.hidden = true;
  workspaceView.hidden = false;
  landingNav.hidden = true;
  workspaceNav.hidden = false;
  mobileNav.hidden = state.subjects.length === 0;
  primaryBtn.textContent = '+ Add Subject';

  document.getElementById('user-display-name').textContent = state.user.displayName || 'Student';
  document.getElementById('user-email').textContent = state.user.email || '';
  document.getElementById('mobile-user-email').textContent = state.user.email || '';

  const firstName = (state.user.displayName || 'Student').split(' ')[0];
  document.getElementById('welcome-heading').textContent = `Welcome to your revision desk, ${firstName}`;

  renderWorkspace();
}

function renderWorkspace() {
  if (!state.user) return;

  // Render sidebar subjects
  document.getElementById('subject-count').textContent = String(state.subjects.length);
  const subjectListEl = document.getElementById('subject-list');

  if (state.subjects.length === 0) {
    subjectListEl.innerHTML =
      '<p class="meta-text">No subjects added yet. Add your first syllabus to generate a revision schedule.</p>';
  } else {
    subjectListEl.innerHTML = state.subjects
      .map((subj) => {
        const isSelected = subj.id === state.activeSubjectId;
        const daysLeft = getDaysRemaining(subj.examDate);
        const pct = subj.totalTasks > 0 ? Math.round((subj.completedTasks / subj.totalTasks) * 100) : 0;
        return `
          <button type="button" class="subject-item ${isSelected ? 'is-selected' : ''}" data-subject-id="${escapeHtml(subj.id)}">
            <div class="subject-item-top">
              <span class="subject-item-name">${escapeHtml(subj.title)}</span>
              <span class="subject-item-days ${daysLeft <= 2 ? 'is-urgent' : ''}">${daysLeft}d</span>
            </div>
            <div class="subject-item-meta">
              <span>${escapeHtml(formatShortDate(subj.examDate))}</span>
              <span>${pct}% done</span>
            </div>
            <div class="progress-track progress-track-sm">
              <div class="progress-fill" style="width: ${pct}%"></div>
            </div>
          </button>
        `;
      })
      .join('');
  }

  document.querySelectorAll('.nav-tab').forEach((btn) => {
    btn.disabled = state.subjects.length === 0 && btn.dataset.tab !== 'overview';
  });
  document.getElementById('mobile-workspace-nav').hidden = state.subjects.length === 0;

  const subject = getActiveSubject();
  const emptyState = document.getElementById('empty-subjects-state');
  const subjectWorkspace = document.getElementById('subject-workspace');

  if (!state.subjectsLoaded) {
    emptyState.hidden = true;
    subjectWorkspace.hidden = true;
    return;
  }

  if (!subject) {
    emptyState.hidden = false;
    subjectWorkspace.hidden = true;
    return;
  }

  emptyState.hidden = true;
  subjectWorkspace.hidden = false;

  syncTopicSelects(subject);

  // Header & KPI Strip
  const daysLeft = getDaysRemaining(subject.examDate);
  const completedTasks = state.tasks.filter((t) => t.status === 'completed').length;
  const totalTasks = state.tasks.length;
  const milestoneRatio = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const completedQuizzes = state.quizzes.filter((q) => q.status === 'completed' && q.scorePercent >= 0);
  const avgQuiz =
    completedQuizzes.length > 0
      ? Math.round(completedQuizzes.reduce((sum, q) => sum + q.scorePercent, 0) / completedQuizzes.length)
      : null;

  const masteredCards = state.flashcards.filter((c) => c.masteryState === 'mastered').length;
  const totalCards = state.flashcards.length;

  const quizScoreFactor = avgQuiz !== null ? avgQuiz : milestoneRatio;
  const cardScoreFactor =
    totalCards > 0 ? Math.round((masteredCards / totalCards) * 100) : milestoneRatio;
  const readinessPercent =
    totalTasks === 0 && completedQuizzes.length === 0 && totalCards === 0
      ? 0
      : Math.round(milestoneRatio * 0.6 + quizScoreFactor * 0.25 + cardScoreFactor * 0.15);

  document.getElementById('subject-meta-line').textContent =
    `Exam ${formatShortDate(subject.examDate)} · ${subject.dailyHours}h/day pace · ${subject.topics.length} syllabus topics`;
  document.getElementById('subject-title-heading').textContent = subject.title;
  document.getElementById('readiness-percent').textContent = `${readinessPercent}%`;
  document.getElementById('readiness-bar-fill').style.width = `${readinessPercent}%`;

  const kpiDays = document.getElementById('kpi-days');
  kpiDays.textContent = `${daysLeft}d`;
  kpiDays.style.color = daysLeft <= 2 ? 'var(--amber)' : 'var(--ink)';
  document.getElementById('kpi-urgent-label').hidden = daysLeft > 2;
  document.getElementById('kpi-milestones').textContent = `${completedTasks}/${totalTasks}`;
  document.getElementById('kpi-quiz-avg').textContent = avgQuiz !== null ? `${avgQuiz}%` : '—';
  document.getElementById('kpi-cards-mastered').textContent = `${masteredCards}/${totalCards}`;

  if (state.activeTab === 'overview') renderOverviewTab(subject);
  if (state.activeTab === 'plan') renderPlanTab();
  if (state.activeTab === 'summaries') renderSummariesTab();
  if (state.activeTab === 'quizzes') renderQuizzesTab();
  if (state.activeTab === 'flashcards') renderFlashcardsTab();
}

function renderOverviewTab(subject) {
  document.getElementById('overview-sheets-count').textContent = `${state.summaries.length} sheets saved`;
  document.getElementById('overview-syllabus-text').textContent = subject.syllabusOverview;

  const topicsEl = document.getElementById('overview-topics-list');
  if (!subject.topics.length) {
    topicsEl.innerHTML = '<p class="task-row muted-text">No topics extracted yet.</p>';
  } else {
    topicsEl.innerHTML = subject.topics
      .map(
        (topic, idx) => `
        <div class="topic-row">
          <div class="topic-left">
            <span class="mono-index">${String(idx + 1).padStart(2, '0')}.</span>
            <span class="topic-name">${escapeHtml(topic)}</span>
          </div>
          <div class="topic-actions">
            <button type="button" class="link-btn jump-tool-btn" data-tab="summaries" data-topic="${escapeHtml(topic)}">Summary</button>
            <span class="sep" aria-hidden="true">·</span>
            <button type="button" class="link-btn jump-tool-btn" data-tab="quizzes" data-topic="${escapeHtml(topic)}">Quiz</button>
            <span class="sep" aria-hidden="true">·</span>
            <button type="button" class="link-btn jump-tool-btn" data-tab="flashcards" data-topic="${escapeHtml(topic)}">Cards</button>
          </div>
        </div>
      `,
      )
      .join('');
  }

  const nextTasksEl = document.getElementById('overview-next-tasks');
  const pending = state.tasks.filter((t) => t.status === 'pending').slice(0, 5);
  if (pending.length === 0) {
    nextTasksEl.innerHTML =
      '<div class="task-row"><p class="muted-text">All scheduled milestones completed! Try an intensive practice quiz.</p></div>';
  } else {
    nextTasksEl.innerHTML = pending
      .map(
        (task) => `
        <div class="task-row">
          <div class="task-main">
            <button type="button" class="task-check-btn" data-task-id="${escapeHtml(task.id)}" aria-label="Mark ${escapeHtml(task.topicTitle)} complete"></button>
            <div>
              <p class="task-title">${escapeHtml(task.topicTitle)}</p>
              <p class="task-desc">${escapeHtml(task.description)}</p>
              <p class="task-meta">${escapeHtml(formatShortDate(task.scheduledDate))} · ${task.durationMinutes} min · ${escapeHtml(task.priority)} priority</p>
            </div>
          </div>
        </div>
      `,
      )
      .join('');
  }
}

function renderPlanTab() {
  const listEl = document.getElementById('plan-tasks-list');
  const filtered = state.tasks.filter((t) => {
    if (state.planFilter === 'pending') return t.status === 'pending';
    if (state.planFilter === 'completed') return t.status === 'completed';
    return true;
  });

  if (filtered.length === 0) {
    listEl.innerHTML = '<div class="task-row"><p class="muted-text">No milestones match this filter.</p></div>';
    return;
  }

  listEl.innerHTML = filtered
    .map((task) => {
      const done = task.status === 'completed';
      return `
        <div class="task-row">
          <div class="task-main">
            <button
              type="button"
              class="task-check-btn ${done ? 'is-done' : ''}"
              data-task-id="${escapeHtml(task.id)}"
              aria-label="Toggle ${escapeHtml(task.topicTitle)}"
            >${done ? '&#10003;' : ''}</button>
            <div>
              <p class="task-title ${done ? 'is-done' : ''}">${escapeHtml(task.topicTitle)}</p>
              <p class="task-desc">${escapeHtml(task.description)}</p>
              <p class="task-meta">
                ${escapeHtml(formatShortDate(task.scheduledDate))} · ${task.durationMinutes} min ·
                <span class="${task.priority === 'high' && !done ? 'priority-high' : ''}">${escapeHtml(task.priority)} priority</span>
              </p>
            </div>
          </div>
          <div class="topic-actions">
            <button type="button" class="link-btn jump-tool-btn" data-tab="summaries" data-topic="${escapeHtml(task.topicTitle)}">Study Sheet</button>
            <span class="sep" aria-hidden="true">·</span>
            <button type="button" class="link-btn jump-tool-btn" data-tab="quizzes" data-topic="${escapeHtml(task.topicTitle)}">Practice Quiz</button>
          </div>
        </div>
      `;
    })
    .join('');
}

function renderSummariesTab() {
  const container = document.getElementById('summaries-container');
  if (state.summaries.length === 0) {
    container.innerHTML = `
      <div class="empty-card">
        <h3 class="card-title">No study sheets saved yet</h3>
        <p class="muted-text max-w-prose">Pick a syllabus topic above and click Generate Study Sheet for key concepts, formulas, common traps, and memory anchors.</p>
      </div>
    `;
    return;
  }

  const active =
    state.summaries.find((s) => s.id === state.activeSummaryId) || state.summaries[0];

  container.innerHTML = `
    <div class="split-workspace">
      <div class="history-list">
        <div class="history-header">Saved Sheets (${state.summaries.length})</div>
        ${state.summaries
          .map(
            (s) => `
          <button type="button" class="history-item ${s.id === active.id ? 'is-selected' : ''}" data-summary-id="${escapeHtml(s.id)}">
            <span class="small-strong">${escapeHtml(s.topicTitle)}</span>
            <span class="meta-text tabular-nums">${s.coreConcepts.length} concepts · ${s.formulaSheet.length} formulas</span>
          </button>
        `,
          )
          .join('')}
      </div>

      <article class="card">
        <div class="card-header" style="border-bottom: 1px solid var(--border); padding-bottom: 16px;">
          <div>
            <p class="accent-label">High-Yield Revision Brief</p>
            <h3 class="section-title-sm">${escapeHtml(active.topicTitle)}</h3>
          </div>
          <div class="btn-group">
            <button type="button" class="btn-secondary-sm jump-tool-btn" data-tab="quizzes" data-topic="${escapeHtml(active.topicTitle)}">Quiz Topic</button>
            <button type="button" class="btn-secondary-sm jump-tool-btn" data-tab="flashcards" data-topic="${escapeHtml(active.topicTitle)}">Make Cards</button>
          </div>
        </div>

        <div>
          <p class="small-strong" style="margin-bottom: 6px;">Executive Overview</p>
          <p class="body-copy">${escapeHtml(active.overview)}</p>
        </div>

        <div>
          <p class="small-strong" style="margin-bottom: 8px;">Core Exam Concepts</p>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${active.coreConcepts
              .map(
                (c, i) => `
              <div style="display: flex; gap: 10px; font-size: 0.9rem;">
                <span class="mono-index">${String(i + 1).padStart(2, '0')}.</span>
                <span>${escapeHtml(c)}</span>
              </div>
            `,
              )
              .join('')}
          </div>
        </div>

        ${
          active.formulaSheet.length > 0
            ? `
          <div>
            <p class="small-strong" style="margin-bottom: 10px;">Key Formulas &amp; Decision Rules</p>
            <div class="formula-grid">
              ${active.formulaSheet
                .map(
                  (f) => `
                <div class="formula-card">
                  <span class="meta-text">${escapeHtml(f.label)}</span>
                  <code class="formula-expr">${escapeHtml(f.expression)}</code>
                  <span class="meta-text">${escapeHtml(f.note)}</span>
                </div>
              `,
                )
                .join('')}
            </div>
          </div>
        `
            : ''
        }

        <div class="pitfall-anchor-grid">
          <div>
            <p class="small-strong" style="color: var(--amber); margin-bottom: 8px;">Common Exam Pitfalls</p>
            <ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; font-size: 0.875rem;">
              ${active.examPitfalls.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}
            </ul>
          </div>
          ${
            active.memoryAnchor
              ? `
            <div class="memory-box">
              <p class="small-strong" style="color: var(--accent); margin-bottom: 6px;">Memory Anchor</p>
              <p style="font-size: 0.875rem;">${escapeHtml(active.memoryAnchor)}</p>
            </div>
          `
              : ''
          }
        </div>
      </article>
    </div>
  `;
}

function renderQuizzesTab() {
  const drillBtn = document.getElementById('drill-weak-btn');
  const hasMissed = state.quizzes.some(
    (q) => q.status === 'completed' && q.questions.some((qq, idx) => q.userAnswers[idx] !== qq.correctIndex),
  );
  drillBtn.hidden = !hasMissed;

  const container = document.getElementById('quizzes-container');
  if (state.quizzes.length === 0) {
    container.innerHTML = `
      <div class="empty-card">
        <h3 class="card-title">Test your recall before exam day</h3>
        <p class="muted-text max-w-prose">Generate an adaptive practice quiz for any topic or run a full-subject mock with instant step-by-step explanations.</p>
      </div>
    `;
    return;
  }

  const active = state.quizzes.find((q) => q.id === state.activeQuizId) || state.quizzes[0];
  const isCompleted = active.status === 'completed';
  if (!isCompleted && state.draftQuizAnswers.length !== active.questions.length) {
    state.draftQuizAnswers = active.questions.map(() => -1);
  }
  const answeredCount = state.draftQuizAnswers.filter((a) => a >= 0).length;

  container.innerHTML = `
    <div class="split-workspace">
      <div class="history-list">
        <div class="history-header">Quiz Sessions (${state.quizzes.length})</div>
        ${state.quizzes
          .map(
            (q) => `
          <button type="button" class="history-item ${q.id === active.id ? 'is-selected' : ''}" data-quiz-id="${escapeHtml(q.id)}">
            <div class="history-item-top">
              <span class="small-strong truncate">${escapeHtml(q.topicTitle)}</span>
              <span class="mono-index" style="color: var(--accent); font-weight: 600;">${
                q.status === 'completed' ? `${q.scorePercent}%` : 'Active'
              }</span>
            </div>
            <span class="meta-text" style="text-transform: capitalize;">${escapeHtml(q.difficulty)} · ${q.questions.length} questions</span>
          </button>
        `,
          )
          .join('')}
      </div>

      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div class="card" style="flex-direction: row; align-items: center; justify-content: space-between;">
          <div>
            <h3 class="card-title">${escapeHtml(active.topicTitle)}</h3>
            <p class="meta-text tabular-nums" style="text-transform: capitalize;">${escapeHtml(active.difficulty)} mode · ${active.questions.length} questions</p>
          </div>
          ${
            isCompleted
              ? `
            <div class="btn-group">
              <div style="text-align: right;">
                <p class="meta-text">Final Score</p>
                <p class="kpi-value" style="color: var(--accent);">${active.scorePercent}%</p>
              </div>
              <button type="button" class="btn-secondary-sm jump-tool-btn" data-tab="summaries" data-topic="${escapeHtml(active.topicTitle)}">Review Notes</button>
            </div>
          `
              : `
            <div style="text-align: right;">
              <p class="meta-text">Progress</p>
              <p class="mono-value tabular-nums">${answeredCount}/${active.questions.length} answered</p>
            </div>
          `
          }
        </div>

        ${active.questions
          .map((question, qIdx) => {
            const chosen = isCompleted ? active.userAnswers[qIdx] : state.draftQuizAnswers[qIdx];
            const isCorrect = isCompleted && chosen === question.correctIndex;
            return `
            <div class="quiz-question-card">
              <div class="card-header" style="align-items: flex-start;">
                <div style="display: flex; gap: 10px; align-items: baseline;">
                  <span class="mono-index">Q${qIdx + 1}.</span>
                  <p style="font-weight: 500; font-size: 0.95rem;">${escapeHtml(question.prompt)}</p>
                </div>
                ${
                  isCompleted
                    ? `<span style="font-size: 0.78rem; font-weight: 600; color: ${
                        isCorrect ? 'var(--accent)' : 'var(--amber)'
                      }; white-space: nowrap;">${isCorrect ? '&#10003; Correct' : '&#10005; Missed'}</span>`
                    : ''
                }
              </div>

              <div style="display: flex; flex-direction: column; gap: 8px;">
                ${question.options
                  .map((opt, optIdx) => {
                    let cls = '';
                    if (isCompleted) {
                      if (optIdx === question.correctIndex) cls = 'is-correct';
                      else if (chosen === optIdx) cls = 'is-wrong';
                    } else if (chosen === optIdx) {
                      cls = 'is-selected';
                    }
                    return `
                    <button
                      type="button"
                      class="quiz-option-btn ${cls}"
                      data-q-idx="${qIdx}"
                      data-opt-idx="${optIdx}"
                      ${isCompleted ? 'disabled' : ''}
                    >
                      <span class="mono-index">${String.fromCharCode(65 + optIdx)}.</span>
                      <span>${escapeHtml(opt)}</span>
                    </button>
                  `;
                  })
                  .join('')}
              </div>

              ${
                isCompleted
                  ? `<div class="explanation-box"><strong>Explanation:</strong> ${escapeHtml(question.explanation)}</div>`
                  : ''
              }
            </div>
          `;
          })
          .join('')}

        ${
          !isCompleted
            ? `
          <div style="display: flex; justify-content: flex-end;">
            <button type="button" id="submit-quiz-btn" class="btn-primary btn-lg">Submit &amp; Grade Quiz</button>
          </div>
        `
            : ''
        }
      </div>
    </div>
  `;
}

function renderFlashcardsTab() {
  const container = document.getElementById('flashcards-container');
  if (state.flashcards.length === 0) {
    container.innerHTML = `
      <div class="empty-card">
        <h3 class="card-title">No flashcards in this subject yet</h3>
        <p class="muted-text max-w-prose">Pick a syllabus topic above and generate an 8-card spaced-repetition deck.</p>
      </div>
    `;
    return;
  }

  const now = Date.now();
  const dueCards = state.flashcards.filter((c) => c.nextReviewAt <= now);
  const deck =
    state.flashcardMode === 'due' && dueCards.length > 0 ? dueCards : state.flashcards;

  if (state.flashcardIndex >= deck.length) state.flashcardIndex = 0;
  const card = deck[state.flashcardIndex];
  const masteredCount = state.flashcards.filter((c) => c.masteryState === 'mastered').length;

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 24px;">
      <div class="card-header" style="flex-wrap: wrap;">
        <div class="segmented-control">
          <button type="button" class="seg-btn flashcard-mode-btn ${state.flashcardMode === 'due' ? 'is-active' : ''}" data-mode="due">
            Due Now (${dueCards.length})
          </button>
          <button type="button" class="seg-btn flashcard-mode-btn ${state.flashcardMode === 'all' ? 'is-active' : ''}" data-mode="all">
            All Cards (${state.flashcards.length})
          </button>
        </div>
        <span class="meta-text tabular-nums" style="font-family: var(--font-mono);">
          Card ${state.flashcardIndex + 1} of ${deck.length} · ${masteredCount}/${state.flashcards.length} mastered
        </span>
      </div>

      ${
        state.flashcardMode === 'due' && dueCards.length === 0
          ? `<div class="status-banner">All due cards reviewed! Showing full deck for extra practice.</div>`
          : ''
      }

      <div class="flashcard-stage-wrap">
        <div class="flashcard-scene" id="flashcard-flip-stage" tabindex="0" role="button" aria-label="Flip flashcard">
          <div class="flashcard-card ${state.flashcardFlipped ? 'is-flipped' : ''}">
            <div class="flashcard-face">
              <div class="card-header">
                <span class="meta-text">${escapeHtml(card.topicTitle)}</span>
                <span class="mono-index">Prompt · Box ${card.boxLevel}</span>
              </div>
              <p class="flashcard-prompt">${escapeHtml(card.front)}</p>
              <div class="card-header">
                ${
                  card.hint
                    ? `<button type="button" id="toggle-hint-btn" class="link-btn">${
                        state.flashcardShowHint ? escapeHtml(card.hint) : 'Show Hint'
                      }</button>`
                    : '<span></span>'
                }
                <span class="meta-text">Click or Space to flip</span>
              </div>
            </div>

            <div class="flashcard-face flashcard-face-back">
              <div class="card-header">
                <span class="meta-text">${escapeHtml(card.topicTitle)}</span>
                <span class="small-strong" style="color: var(--accent);">Answer</span>
              </div>
              <p class="flashcard-answer">${escapeHtml(card.back)}</p>
              <span class="meta-text" style="text-align: center;">Rate recall below to schedule next review</span>
            </div>
          </div>
        </div>

        <div class="rating-grid">
          <button type="button" class="rating-btn is-again" data-rate="again"><strong>Again</strong><span>5 min</span></button>
          <button type="button" class="rating-btn" data-rate="hard"><strong>Hard</strong><span>8 hrs</span></button>
          <button type="button" class="rating-btn is-good" data-rate="good"><strong>Good</strong><span>1–2 days</span></button>
          <button type="button" class="rating-btn is-easy" data-rate="easy"><strong>Easy</strong><span>4+ days</span></button>
        </div>
      </div>

      <div class="history-list">
        <div class="history-header">Deck Index (${state.flashcards.length} cards)</div>
        <div style="max-height: 280px; overflow-y: auto;">
          ${state.flashcards
            .map(
              (c, idx) => `
            <button type="button" class="history-item flashcard-jump-btn" data-card-index="${idx}">
              <div class="history-item-top">
                <span class="small-strong truncate">${escapeHtml(c.front)}</span>
                <span class="meta-text tabular-nums" style="font-family: var(--font-mono);">Box ${c.boxLevel} · ${escapeHtml(c.masteryState)}</span>
              </div>
              <span class="meta-text">${escapeHtml(c.topicTitle)}</span>
            </button>
          `,
            )
            .join('')}
        </div>
      </div>
    </div>
  `;
}

// Modal Controls
function openAddSubjectModal() {
  document.getElementById('new-subject-date').value = getDefaultExamDate();
  showBanner('modal-error', null);
  showBanner('modal-status', null);
  document.getElementById('add-subject-modal').hidden = false;
}

function closeAddSubjectModal() {
  document.getElementById('add-subject-modal').hidden = true;
}

// Event Listeners Setup
function bindEvents() {
  // Image fallbacks
  const heroImg = document.getElementById('hero-desk-img');
  if (heroImg) {
    heroImg.addEventListener('error', () => {
      heroImg.hidden = true;
      document.getElementById('hero-desk-fallback').hidden = false;
    });
  }
  const flatImg = document.getElementById('flatlay-img');
  if (flatImg) {
    flatImg.addEventListener('error', () => {
      flatImg.hidden = true;
      document.getElementById('flatlay-fallback').hidden = false;
    });
  }

  // Sign in & primary header action
  async function triggerSignIn() {
    showBanner('auth-error-msg', null);
    try {
      await signInWithGoogle();
    } catch (err) {
      showBanner('auth-error-msg', err instanceof Error ? err.message : 'Sign-in cancelled.');
    }
  }

  document.getElementById('landing-signin-btn').addEventListener('click', triggerSignIn);
  document.getElementById('primary-action-btn').addEventListener('click', () => {
    if (state.user) openAddSubjectModal();
    else void triggerSignIn();
  });
  document.getElementById('sidebar-add-btn').addEventListener('click', openAddSubjectModal);
  document.getElementById('empty-add-subject-btn').addEventListener('click', openAddSubjectModal);

  document.getElementById('brand-link').addEventListener('click', (e) => {
    e.preventDefault();
    if (state.user) setActiveTab('overview');
  });

  // Sign out
  document.getElementById('signout-btn').addEventListener('click', () => void signOutUser());
  document.getElementById('mobile-signout-btn').addEventListener('click', () => void signOutUser());

  // Tab navigation
  document.querySelectorAll('.nav-tab, .mobile-tab').forEach((btn) => {
    btn.addEventListener('click', () => setActiveTab(btn.dataset.tab));
  });

  document.getElementById('jump-full-schedule-btn').addEventListener('click', () => {
    setActiveTab('plan');
  });

  // Sidebar subject selection (event delegation)
  document.getElementById('subject-list').addEventListener('click', (e) => {
    const btn = e.target.closest('.subject-item');
    if (!btn) return;
    const id = btn.dataset.subjectId;
    if (id && id !== state.activeSubjectId) {
      state.activeSubjectId = id;
      state.activeSummaryId = null;
      state.activeQuizId = null;
      state.flashcardIndex = 0;
      subscribeToActiveSubject(id);
      renderWorkspace();
    }
  });

  // Workspace delegated clicks (task toggle, jump-to-tool, summaries, quizzes, flashcards)
  document.getElementById('subject-workspace').addEventListener('click', async (e) => {
    const jumpBtn = e.target.closest('.jump-tool-btn');
    if (jumpBtn) {
      setActiveTab(jumpBtn.dataset.tab, jumpBtn.dataset.topic);
      return;
    }

    const checkBtn = e.target.closest('.task-check-btn');
    if (checkBtn) {
      const task = state.tasks.find((t) => t.id === checkBtn.dataset.taskId);
      const subj = getActiveSubject();
      if (task && subj) {
        try {
          await toggleStudyTask(task, state.tasks, subj.id);
        } catch (err) {
          showBanner('sync-error-banner', err.message);
        }
      }
      return;
    }

    const sumItem = e.target.closest('[data-summary-id]');
    if (sumItem) {
      state.activeSummaryId = sumItem.dataset.summaryId;
      renderSummariesTab();
      return;
    }

    const quizItem = e.target.closest('[data-quiz-id]');
    if (quizItem) {
      state.activeQuizId = quizItem.dataset.quizId;
      const q = state.quizzes.find((item) => item.id === state.activeQuizId);
      state.draftQuizAnswers = q ? q.questions.map(() => -1) : [];
      renderQuizzesTab();
      return;
    }

    const optBtn = e.target.closest('.quiz-option-btn');
    if (optBtn && !optBtn.disabled) {
      const qIdx = Number(optBtn.dataset.qIdx);
      const optIdx = Number(optBtn.dataset.optIdx);
      state.draftQuizAnswers[qIdx] = optIdx;
      renderQuizzesTab();
      return;
    }

    if (e.target.closest('#submit-quiz-btn')) {
      const activeQuiz = state.quizzes.find((q) => q.id === state.activeQuizId) || state.quizzes[0];
      if (!activeQuiz) return;
      if (state.draftQuizAnswers.some((a) => a < 0)) {
        showBanner('quiz-error', 'Please answer every question before submitting.');
        return;
      }
      showBanner('quiz-error', null);
      const btn = document.getElementById('submit-quiz-btn');
      btn.disabled = true;
      btn.textContent = 'Grading...';
      try {
        await submitQuizCompletion(activeQuiz, state.draftQuizAnswers, state.quizzes);
      } catch (err) {
        showBanner('quiz-error', err.message);
      }
      return;
    }

    if (e.target.closest('#toggle-hint-btn')) {
      e.stopPropagation();
      state.flashcardShowHint = !state.flashcardShowHint;
      renderFlashcardsTab();
      return;
    }

    if (e.target.closest('#flashcard-flip-stage')) {
      state.flashcardFlipped = !state.flashcardFlipped;
      renderFlashcardsTab();
      return;
    }

    const modeBtn = e.target.closest('.flashcard-mode-btn');
    if (modeBtn) {
      state.flashcardMode = modeBtn.dataset.mode;
      state.flashcardIndex = 0;
      state.flashcardFlipped = false;
      state.flashcardShowHint = false;
      renderFlashcardsTab();
      return;
    }

    const rateBtn = e.target.closest('.rating-btn');
    if (rateBtn) {
      const now = Date.now();
      const due = state.flashcards.filter((c) => c.nextReviewAt <= now);
      const deck = state.flashcardMode === 'due' && due.length > 0 ? due : state.flashcards;
      const card = deck[state.flashcardIndex];
      if (!card) return;
      try {
        await reviewFlashcardSpacedRepetition(card, rateBtn.dataset.rate);
        state.flashcardFlipped = false;
        state.flashcardShowHint = false;
        state.flashcardIndex = state.flashcardIndex + 1 < deck.length ? state.flashcardIndex + 1 : 0;
        renderFlashcardsTab();
      } catch (err) {
        showBanner('flashcards-error', err.message);
      }
      return;
    }

    const jumpCard = e.target.closest('.flashcard-jump-btn');
    if (jumpCard) {
      state.flashcardMode = 'all';
      state.flashcardIndex = Number(jumpCard.dataset.cardIndex) || 0;
      state.flashcardFlipped = false;
      state.flashcardShowHint = false;
      renderFlashcardsTab();
    }
  });

  // Delete subject inline confirmation
  document.getElementById('ask-delete-subject-btn').addEventListener('click', () => {
    document.getElementById('delete-prompt-default').hidden = true;
    document.getElementById('delete-prompt-confirm').hidden = false;
  });
  document.getElementById('cancel-delete-subject-btn').addEventListener('click', () => {
    document.getElementById('delete-prompt-confirm').hidden = true;
    document.getElementById('delete-prompt-default').hidden = false;
  });
  document.getElementById('confirm-delete-subject-btn').addEventListener('click', async () => {
    const subj = getActiveSubject();
    if (!subj) return;
    const btn = document.getElementById('confirm-delete-subject-btn');
    btn.disabled = true;
    btn.textContent = 'Deleting...';
    try {
      await deleteSubjectAndChildren(
        subj.id,
        state.tasks,
        state.summaries,
        state.quizzes,
        state.flashcards,
      );
      document.getElementById('delete-prompt-confirm').hidden = true;
      document.getElementById('delete-prompt-default').hidden = false;
      setActiveTab('overview');
    } catch (err) {
      showBanner('sync-error-banner', err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Confirm Delete';
    }
  });

  // Study Plan filters & add milestone form
  document.getElementById('plan-filter-group').addEventListener('click', (e) => {
    const btn = e.target.closest('.seg-btn');
    if (!btn) return;
    state.planFilter = btn.dataset.filter;
    document.querySelectorAll('#plan-filter-group .seg-btn').forEach((b) => {
      b.classList.toggle('is-active', b === btn);
    });
    renderPlanTab();
  });

  document.getElementById('toggle-add-task-btn').addEventListener('click', () => {
    const form = document.getElementById('add-milestone-form');
    form.hidden = !form.hidden;
    if (!form.hidden) {
      document.getElementById('milestone-date').value = new Date().toISOString().slice(0, 10);
    }
  });
  document.getElementById('cancel-add-task-btn').addEventListener('click', () => {
    document.getElementById('add-milestone-form').hidden = true;
  });

  document.getElementById('add-milestone-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const subj = getActiveSubject();
    if (!subj || !state.user) return;
    const btn = document.getElementById('save-task-btn');
    btn.disabled = true;
    try {
      await addCustomStudyTask(
        state.user.uid,
        subj.id,
        {
          topicTitle: document.getElementById('milestone-topic').value,
          description: document.getElementById('milestone-desc').value,
          scheduledDate: document.getElementById('milestone-date').value,
          durationMinutes: Number(document.getElementById('milestone-duration').value) || 30,
          priority: document.getElementById('milestone-priority').value,
        },
        state.tasks.length,
      );
      document.getElementById('milestone-desc').value = '';
      document.getElementById('add-milestone-form').hidden = true;
    } catch (err) {
      showBanner('sync-error-banner', err.message);
    } finally {
      btn.disabled = false;
    }
  });

  // Summary generator
  document.getElementById('summary-topic-select').addEventListener('change', (e) => {
    document.getElementById('summary-custom-topic').hidden = e.target.value !== '__custom__';
  });

  document.getElementById('generate-summary-btn').addEventListener('click', async () => {
    const subj = getActiveSubject();
    if (!subj || !state.user) return;
    const sel = document.getElementById('summary-topic-select').value;
    const topicTitle =
      sel === '__custom__' ? document.getElementById('summary-custom-topic').value.trim() : sel;
    if (!topicTitle) {
      showBanner('summary-error', 'Please enter a topic name.');
      return;
    }
    showBanner('summary-error', null);
    const btn = document.getElementById('generate-summary-btn');
    btn.disabled = true;
    btn.textContent = 'Synthesizing...';
    try {
      const generated = await postJson('/api/ai/generate-summary', {
        subjectTitle: subj.title,
        topicTitle,
        syllabusContext: subj.syllabusOverview,
      });
      const id = await saveStudySummary(state.user.uid, subj.id, topicTitle, generated);
      state.activeSummaryId = id;
    } catch (err) {
      showBanner('summary-error', err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Generate Study Sheet';
    }
  });

  // Quiz generator
  async function startQuizFlow(focusWeak) {
    const subj = getActiveSubject();
    if (!subj || !state.user) return;
    showBanner('quiz-error', null);
    const btn = document.getElementById('start-quiz-btn');
    btn.disabled = true;
    btn.textContent = 'Drafting Quiz...';

    const topicLabel = focusWeak
      ? 'Weak Topics Drill'
      : document.getElementById('quiz-topic-select').value;
    const difficulty = document.getElementById('quiz-difficulty-select').value;
    const questionCount = Number(document.getElementById('quiz-count-select').value) || 5;

    const missed = [];
    if (focusWeak) {
      state.quizzes.forEach((q) => {
        if (q.status === 'completed') {
          q.questions.forEach((qq, idx) => {
            if (q.userAnswers[idx] !== qq.correctIndex) missed.push(qq.prompt);
          });
        }
      });
    }

    try {
      const generated = await postJson('/api/ai/generate-quiz', {
        subjectTitle: subj.title,
        topicTitle: topicLabel,
        difficulty,
        questionCount,
        syllabusContext: subj.syllabusOverview,
        focusWeaknesses: focusWeak ? missed.slice(0, 5) : undefined,
      });
      const id = await createQuiz(
        state.user.uid,
        subj.id,
        topicLabel,
        difficulty,
        generated.questions,
      );
      state.activeQuizId = id;
      state.draftQuizAnswers = generated.questions.map(() => -1);
    } catch (err) {
      showBanner('quiz-error', err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Start Quiz';
    }
  }

  document.getElementById('start-quiz-btn').addEventListener('click', () => void startQuizFlow(false));
  document.getElementById('drill-weak-btn').addEventListener('click', () => void startQuizFlow(true));

  // Flashcards generator & Spacebar flip
  document.getElementById('generate-cards-btn').addEventListener('click', async () => {
    const subj = getActiveSubject();
    if (!subj || !state.user) return;
    showBanner('flashcards-error', null);
    const btn = document.getElementById('generate-cards-btn');
    btn.disabled = true;
    btn.textContent = 'Creating Deck...';
    const topicTitle = document.getElementById('flashcard-topic-select').value;

    try {
      const generated = await postJson('/api/ai/generate-flashcards', {
        subjectTitle: subj.title,
        topicTitle,
        syllabusContext: subj.syllabusOverview,
        cardCount: 8,
      });
      await createFlashcardsBatch(state.user.uid, subj.id, topicTitle, generated.cards);
      state.flashcardIndex = 0;
      state.flashcardFlipped = false;
      state.flashcardShowHint = false;
    } catch (err) {
      showBanner('flashcards-error', err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Generate 8 Cards';
    }
  });

  window.addEventListener('keydown', (e) => {
    if (state.activeTab !== 'flashcards' || state.flashcards.length === 0) return;
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.code === 'Space') {
      e.preventDefault();
      state.flashcardFlipped = !state.flashcardFlipped;
      renderFlashcardsTab();
    }
  });

  // Add Subject Modal Events
  document.getElementById('close-modal-btn').addEventListener('click', closeAddSubjectModal);
  document.getElementById('cancel-modal-btn').addEventListener('click', closeAddSubjectModal);

  document.querySelectorAll('.sample-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sample = SAMPLE_SYLLABI[Number(btn.dataset.sample)];
      if (!sample) return;
      document.getElementById('new-subject-title').value = sample.title;
      document.getElementById('new-subject-syllabus').value = sample.syllabus;
      state.uploadedFileData = null;
      document.getElementById('uploaded-file-name').textContent =
        'Upload a syllabus PDF or photo (up to 10 MB)';
      document.getElementById('clear-file-btn').hidden = true;
      showBanner('modal-error', null);
    });
  });

  document.getElementById('clear-file-btn').addEventListener('click', () => {
    state.uploadedFileData = null;
    document.getElementById('syllabus-file-input').value = '';
    document.getElementById('uploaded-file-name').textContent =
      'Upload a syllabus PDF or photo (up to 10 MB)';
    document.getElementById('clear-file-btn').hidden = true;
  });

  document.getElementById('syllabus-file-input').addEventListener('change', async (e) => {
    showBanner('modal-error', null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showBanner('modal-error', 'Please choose a syllabus file smaller than 10 MB.');
      return;
    }

    if (file.type === 'text/plain' || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
      const text = await file.text();
      const ta = document.getElementById('new-subject-syllabus');
      ta.value = ta.value ? `${ta.value}\n\n${text}` : text;
      state.uploadedFileData = null;
      return;
    }

    const supported = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
    if (!supported.includes(file.type)) {
      showBanner('modal-error', 'Supported files: PDF, PNG, JPG, TXT, or Markdown (.md).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const raw = typeof reader.result === 'string' ? reader.result : '';
      const base64 = raw.includes(',') ? raw.split(',')[1] : raw;
      state.uploadedFileData = { mimeType: file.type, base64, fileName: file.name };
      document.getElementById('uploaded-file-name').textContent = `Attached: ${file.name}`;
      document.getElementById('clear-file-btn').hidden = false;
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('add-subject-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!state.user) return;
    showBanner('modal-error', null);

    const title = document.getElementById('new-subject-title').value.trim();
    const examDate = document.getElementById('new-subject-date').value;
    const dailyHours = Number(document.getElementById('new-subject-hours').value) || 3;
    const syllabusText = document.getElementById('new-subject-syllabus').value.trim();

    if (!title || !examDate) {
      showBanner('modal-error', 'Subject name and exam date are required.');
      return;
    }
    if (!syllabusText && !state.uploadedFileData) {
      showBanner('modal-error', 'Please paste your syllabus or upload a PDF/image.');
      return;
    }

    const submitBtn = document.getElementById('submit-subject-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Building Plan...';
    showBanner('modal-status', 'Analyzing syllabus topics and scheduling revision milestones...');

    try {
      const parsed = await postJson('/api/ai/parse-syllabus', {
        subjectTitle: title,
        examDate,
        currentDate: new Date().toISOString().slice(0, 10),
        dailyHours,
        syllabusText: syllabusText || undefined,
        fileData: state.uploadedFileData || undefined,
      });

      showBanner('modal-status', 'Syncing personalized study plan to your cloud workspace...');
      const newId = await createSubjectWithTasks(
        state.user.uid,
        title,
        examDate,
        dailyHours,
        parsed,
      );

      document.getElementById('new-subject-title').value = '';
      document.getElementById('new-subject-syllabus').value = '';
      state.uploadedFileData = null;
      document.getElementById('uploaded-file-name').textContent =
        'Upload a syllabus PDF or photo (up to 10 MB)';
      document.getElementById('clear-file-btn').hidden = true;

      state.activeSubjectId = newId;
      closeAddSubjectModal();
      setActiveTab('overview');
      subscribeToActiveSubject(newId);
    } catch (err) {
      showBanner('modal-error', err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Generate Study Plan';
      showBanner('modal-status', null);
    }
  });
}

// Initialize App
function init() {
  bindEvents();

  watchAuth(async (nextUser) => {
    state.user = nextUser;
    state.authReady = true;

    if (state.unsubSubjects) {
      state.unsubSubjects();
      state.unsubSubjects = null;
    }
    clearSubjectSubscriptions();

    if (nextUser) {
      try {
        await ensureUserProfile(nextUser);
      } catch (err) {
        showBanner('sync-error-banner', err.message);
      }

      state.unsubSubjects = subscribeSubjects(
        nextUser.uid,
        (items) => {
          state.subjects = items;
          state.subjectsLoaded = true;
          const prevId = state.activeSubjectId;
          const nextId =
            prevId && items.some((s) => s.id === prevId) ? prevId : items[0]?.id ?? null;
          state.activeSubjectId = nextId;
          if (nextId !== prevId || state.unsubChildren.length === 0) {
            subscribeToActiveSubject(nextId);
          }
          renderApp();
        },
        (err) => {
          showBanner('sync-error-banner', err.message);
          state.subjectsLoaded = true;
          renderApp();
        },
      );
    } else {
      state.subjects = [];
      state.subjectsLoaded = false;
      state.activeSubjectId = null;
      state.tasks = [];
      state.summaries = [];
      state.quizzes = [];
      state.flashcards = [];
      renderApp();
    }
  });
}

init();
