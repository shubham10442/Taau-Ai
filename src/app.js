// 1. App Data, Samples & Storage Key
var STORE_KEY = 'taau_ai_v1';

var SAMPLES = [
  {
    title: 'Data Structures & Algorithms',
    text: 'Unit 1: Big-O, Recurrence Relations, Master Theorem\nUnit 2: Stacks, Queues, Linked Lists\nUnit 3: BSTs, AVL Rotations, Heaps\nUnit 4: BFS, DFS, Dijkstra, Kruskal MST',
  },
  {
    title: 'Discrete Mathematics',
    text: 'Mod 1: Quantifiers & Proofs\nMod 2: Equivalence Relations\nMod 3: Strong Induction & Recurrences\nMod 4: Pigeonhole & Inclusion-Exclusion',
  },
];

var state = {
  subjects: [],
  tasks: [],
  summaries: [],
  quizzes: [],
  subId: null,
  sumId: null,
  quizId: null,
  draft: [],
  tab: 'overview',
  filter: 'all',
  fileData: null,
};

// 2. Simple DOM & Formatting Helpers
function getEl(id) {
  return document.getElementById(id);
}

function makeId(prefix) {
  var randomPart = Math.random().toString(36).slice(2, 8);
  return prefix + '_' + Date.now() + '_' + randomPart;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function plusDays(days) {
  var futureMs = Date.now() + days * 86400000;
  return new Date(futureMs).toISOString().slice(0, 10);
}

function getDaysLeft(dateText) {
  var examMs = new Date(dateText + 'T00:00:00').getTime();
  var todayMs = new Date().setHours(0, 0, 0, 0);
  var diff = Math.ceil((examMs - todayMs) / 86400000);
  if (isNaN(diff) || diff < 0) {
    return 0;
  }
  return diff;
}

function formatShortDate(dateText) {
  var parsed = Date.parse(dateText + 'T00:00:00');
  if (isNaN(parsed)) {
    return dateText || '';
  }
  return new Date(parsed).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function showBanner(id, message) {
  var element = getEl(id);
  if (message) {
    element.textContent = message;
    element.hidden = false;
  } else {
    element.textContent = '';
    element.hidden = true;
  }
}

async function postJson(url, bodyData) {
  var response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bodyData),
  });
  var data = await response.json().catch(function () {
    return {};
  });
  if (!response.ok) {
    throw new Error(data.error || 'Request failed (' + response.status + ')');
  }
  return data;
}

// 3. Browser LocalStorage Load & Save
function saveState() {
  try {
    var payload = {
      subjects: state.subjects,
      tasks: state.tasks,
      summaries: state.summaries,
      quizzes: state.quizzes,
      subId: state.subId,
      tab: state.tab,
    };
    localStorage.setItem(STORE_KEY, JSON.stringify(payload));
  } catch (err) {
    // Ignore storage quota errors
  }
}

function loadState() {
  try {
    var raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      var saved = JSON.parse(raw);
      if (Array.isArray(saved.subjects)) state.subjects = saved.subjects;
      if (Array.isArray(saved.tasks)) state.tasks = saved.tasks;
      if (Array.isArray(saved.summaries)) state.summaries = saved.summaries;
      if (Array.isArray(saved.quizzes)) state.quizzes = saved.quizzes;
      if (typeof saved.subId === 'string') state.subId = saved.subId;
      if (saved.tab === 'overview' || saved.tab === 'plan' || saved.tab === 'summaries' || saved.tab === 'quizzes') {
        state.tab = saved.tab;
      }
    }
  } catch (err) {
    // Ignore corrupted storage data
  }
  syncActiveItems();
}

// 4. Filter Helpers for Active Subject
function getCurrentSubject() {
  for (var i = 0; i < state.subjects.length; i += 1) {
    if (state.subjects[i].id === state.subId) {
      return state.subjects[i];
    }
  }
  if (state.subjects.length > 0) {
    return state.subjects[0];
  }
  return null;
}

function getSubjectTasks(subjectId) {
  var list = [];
  for (var i = 0; i < state.tasks.length; i += 1) {
    if (state.tasks[i].subjectId === subjectId) {
      list.push(state.tasks[i]);
    }
  }
  list.sort(function (a, b) {
    var dateCompare = a.scheduledDate.localeCompare(b.scheduledDate);
    if (dateCompare !== 0) {
      return dateCompare;
    }
    return a.orderIndex - b.orderIndex;
  });
  return list;
}

function getSubjectSummaries(subjectId) {
  var list = [];
  for (var i = 0; i < state.summaries.length; i += 1) {
    if (state.summaries[i].subjectId === subjectId) {
      list.push(state.summaries[i]);
    }
  }
  return list;
}

function getSubjectQuizzes(subjectId) {
  var list = [];
  for (var i = 0; i < state.quizzes.length; i += 1) {
    if (state.quizzes[i].subjectId === subjectId) {
      list.push(state.quizzes[i]);
    }
  }
  return list;
}

function syncActiveItems() {
  var sub = getCurrentSubject();
  if (!sub) {
    state.subId = null;
    state.sumId = null;
    state.quizId = null;
    state.draft = [];
    return;
  }

  state.subId = sub.id;
  var sums = getSubjectSummaries(sub.id);
  var foundSum = false;
  for (var i = 0; i < sums.length; i += 1) {
    if (sums[i].id === state.sumId) {
      foundSum = true;
    }
  }
  if (!foundSum) {
    state.sumId = sums.length > 0 ? sums[0].id : null;
  }

  var quzs = getSubjectQuizzes(sub.id);
  var activeQuiz = null;
  for (var j = 0; j < quzs.length; j += 1) {
    if (quzs[j].id === state.quizId) {
      activeQuiz = quzs[j];
    }
  }
  if (!activeQuiz && quzs.length > 0) {
    activeQuiz = quzs[0];
  }
  if (activeQuiz) {
    state.quizId = activeQuiz.id;
    state.draft = activeQuiz.userAnswers.slice();
  } else {
    state.quizId = null;
    state.draft = [];
  }
}

// 5. Data Mutations (Create, Update, Delete)
function createSubject(title, examDate, hours, parsed) {
  var id = makeId('sub');
  var cleanHours = Number(hours) || 3;
  if (cleanHours < 0.5) cleanHours = 0.5;

  state.subjects.push({
    id: id,
    title: title || 'Subject',
    examDate: examDate || plusDays(6),
    dailyHours: cleanHours,
    syllabusOverview: parsed.syllabusOverview || 'Exam syllabus',
    topics: Array.isArray(parsed.topics) ? parsed.topics.slice(0, 35) : [],
  });

  var parsedTasks = Array.isArray(parsed.tasks) ? parsed.tasks.slice(0, 30) : [];
  for (var i = 0; i < parsedTasks.length; i += 1) {
    var item = parsedTasks[i];
    state.tasks.push({
      id: makeId('tsk'),
      subjectId: id,
      topicTitle: item.topicTitle || 'Revision',
      description: item.description || 'Review and solve problems.',
      scheduledDate: item.scheduledDate || examDate,
      durationMinutes: Number(item.durationMinutes) || 45,
      priority: item.priority || 'medium',
      status: 'pending',
      orderIndex: i,
    });
  }

  state.subjects.sort(function (a, b) {
    return a.examDate.localeCompare(b.examDate);
  });
  state.subId = id;
  state.tab = 'overview';
  syncActiveItems();
  saveState();
  renderWorkspace();
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
  for (var i = 0; i < state.tasks.length; i += 1) {
    if (state.tasks[i].id === taskId) {
      if (state.tasks[i].status === 'completed') {
        state.tasks[i].status = 'pending';
      } else {
        state.tasks[i].status = 'completed';
      }
      break;
    }
  }
  saveState();
  renderWorkspace();
}

function addTask(subjectId, input) {
  var minutes = Number(input.mins) || 45;
  if (minutes < 10) minutes = 10;

  state.tasks.push({
    id: makeId('tsk'),
    subjectId: subjectId,
    topicTitle: input.topic.trim() || 'Milestone',
    description: input.desc.trim() || 'Focused practice',
    scheduledDate: input.date || plusDays(6),
    durationMinutes: minutes,
    priority: input.pri || 'medium',
    status: 'pending',
    orderIndex: getSubjectTasks(subjectId).length,
  });
  saveState();
  renderWorkspace();
}

function saveSummary(subjectId, topic, data) {
  var id = makeId('sum');
  state.summaries.unshift({
    id: id,
    subjectId: subjectId,
    topicTitle: topic,
    overview: data.overview || 'Summary generated.',
    coreConcepts: Array.isArray(data.coreConcepts) ? data.coreConcepts.slice(0, 15) : [],
    formulaSheet: Array.isArray(data.formulaSheet) ? data.formulaSheet.slice(0, 15) : [],
    examPitfalls: Array.isArray(data.examPitfalls) ? data.examPitfalls.slice(0, 12) : [],
    memoryAnchor: data.memoryAnchor || '',
  });
  state.sumId = id;
  saveState();
  renderWorkspace();
}

function saveQuiz(subjectId, topic, difficulty, rawQuestions) {
  var id = makeId('quz');
  var cleanQuestions = [];
  var limit = Math.min(rawQuestions.length, 15);

  for (var i = 0; i < limit; i += 1) {
    var q = rawQuestions[i];
    var options = Array.isArray(q.options) ? q.options.slice(0, 4) : [];
    while (options.length < 4) {
      options.push('None of the above');
    }
    var correct = Number(q.correctIndex) || 0;
    if (correct < 0) correct = 0;
    if (correct > 3) correct = 3;

    cleanQuestions.push({
      prompt: q.prompt,
      options: options,
      correctIndex: correct,
      explanation: q.explanation || 'Review notes.',
    });
  }

  var blankAnswers = [];
  for (var j = 0; j < cleanQuestions.length; j += 1) {
    blankAnswers.push(-1);
  }

  state.quizzes.unshift({
    id: id,
    subjectId: subjectId,
    topicTitle: topic,
    difficulty: difficulty,
    questions: cleanQuestions,
    userAnswers: blankAnswers,
    scorePercent: -1,
    status: 'in_progress',
  });
  state.quizId = id;
  state.draft = blankAnswers.slice();
  saveState();
  renderWorkspace();
}

function gradeQuiz(quiz, answers) {
  var correctCount = 0;
  for (var i = 0; i < quiz.questions.length; i += 1) {
    if (answers[i] === quiz.questions[i].correctIndex) {
      correctCount += 1;
    }
  }
  var total = Math.max(quiz.questions.length, 1);
  quiz.userAnswers = answers.slice();
  quiz.scorePercent = Math.round((correctCount / total) * 100);
  quiz.status = 'completed';
  saveState();
  renderWorkspace();
}

function removeSubject(subjectId) {
  state.subjects = state.subjects.filter(function (s) { return s.id !== subjectId; });
  state.tasks = state.tasks.filter(function (t) { return t.subjectId !== subjectId; });
  state.summaries = state.summaries.filter(function (s) { return s.subjectId !== subjectId; });
  state.quizzes = state.quizzes.filter(function (q) { return q.subjectId !== subjectId; });
  state.subId = state.subjects.length > 0 ? state.subjects[0].id : null;
  syncActiveItems();
  saveState();
  renderWorkspace();
}

// 6. UI Rendering Functions
function fillTopicSelect(selectId, subject, includeAllOption) {
  var select = getEl(selectId);
  var previous = select.value;
  var html = '';

  if (includeAllOption) {
    html += '<option value="Comprehensive Mock">All Topics (Mock)</option>';
  }
  for (var i = 0; i < subject.topics.length; i += 1) {
    var topic = escapeHtml(subject.topics[i]);
    html += '<option value="' + topic + '">' + topic + '</option>';
  }
  if (!includeAllOption) {
    html += '<option value="__custom__">Custom Topic...</option>';
  }

  select.innerHTML = html;
  for (var j = 0; j < select.options.length; j += 1) {
    if (select.options[j].value === previous) {
      select.value = previous;
      break;
    }
  }
}

function getQuizAverageText(quizzes) {
  var totalScore = 0;
  var count = 0;
  for (var i = 0; i < quizzes.length; i += 1) {
    if (quizzes[i].status === 'completed' && quizzes[i].scorePercent >= 0) {
      totalScore += quizzes[i].scorePercent;
      count += 1;
    }
  }
  if (count === 0) {
    return null;
  }
  return Math.round(totalScore / count) + '%';
}

function renderSidebar(activeSubject) {
  getEl('subject-count').textContent = String(state.subjects.length);

  if (state.subjects.length === 0) {
    getEl('subject-list').innerHTML = '<p class="meta">No subjects yet.</p>';
    return;
  }

  var html = '';
  for (var i = 0; i < state.subjects.length; i += 1) {
    var sub = state.subjects[i];
    var tasks = getSubjectTasks(sub.id);
    var doneCount = 0;
    for (var j = 0; j < tasks.length; j += 1) {
      if (tasks[j].status === 'completed') {
        doneCount += 1;
      }
    }
    var percent = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;
    var avg = getQuizAverageText(getSubjectQuizzes(sub.id)) || 'no quiz';
    var left = getDaysLeft(sub.examDate);
    var dayColor = left <= 3 ? 'amber' : 'lime';
    var selectedClass = activeSubject && activeSubject.id === sub.id ? 'is-selected' : '';

    html += '<button type="button" class="subject-item ' + selectedClass + '" data-select-subject="' + escapeHtml(sub.id) + '">';
    html += '<div class="row between"><span class="small-strong truncate">' + escapeHtml(sub.title) + '</span><span class="mono ' + dayColor + '">' + left + 'd</span></div>';
    html += '<div class="track"><div class="fill" data-progress="' + percent + '"></div></div>';
    html += '<div class="row between meta mono"><span>' + doneCount + '/' + tasks.length + '</span><span>' + avg + '</span></div>';
    html += '</button>';
  }

  getEl('subject-list').innerHTML = html;
  var fills = getEl('subject-list').querySelectorAll('.fill');
  for (var k = 0; k < fills.length; k += 1) {
    fills[k].style.width = fills[k].dataset.progress + '%';
  }
}

function renderOverview(sub, tasks, summaries) {
  getEl('overview-syllabus-text').textContent = sub.syllabusOverview || 'No overview.';
  getEl('overview-sheets-count').textContent = summaries.length + ' sheets';

  if (sub.topics.length === 0) {
    getEl('overview-topics-list').innerHTML = '<p class="muted card-pad">No topics.</p>';
  } else {
    var topicsHtml = '';
    for (var i = 0; i < sub.topics.length; i += 1) {
      var num = String(i + 1).padStart(2, '0');
      var topic = escapeHtml(sub.topics[i]);
      topicsHtml += '<div class="list-row"><span class="truncate small-strong"><span class="mono muted">' + num + '</span> ' + topic + '</span>';
      topicsHtml += '<div class="row"><button type="button" class="link-btn" data-jump-sum="' + topic + '">Sheet</button><span class="meta">·</span><button type="button" class="link-btn amber" data-jump-quiz="' + topic + '">Quiz</button></div></div>';
    }
    getEl('overview-topics-list').innerHTML = topicsHtml;
  }

  var pendingTasks = [];
  for (var j = 0; j < tasks.length; j += 1) {
    if (tasks[j].status === 'pending' && pendingTasks.length < 5) {
      pendingTasks.push(tasks[j]);
    }
  }

  if (pendingTasks.length === 0) {
    getEl('overview-next-tasks').innerHTML = '<p class="muted card-pad">All milestones done.</p>';
  } else {
    var nextHtml = '';
    for (var k = 0; k < pendingTasks.length; k += 1) {
      var task = pendingTasks[k];
      nextHtml += '<div class="list-row"><div class="row">';
      nextHtml += '<button type="button" class="check-btn" data-toggle-task="' + escapeHtml(task.id) + '" aria-label="Mark done"></button>';
      nextHtml += '<div><p class="small-strong">' + escapeHtml(task.topicTitle) + '</p><p class="meta">' + formatShortDate(task.scheduledDate) + ' · ' + task.durationMinutes + 'm</p></div>';
      nextHtml += '</div></div>';
    }
    getEl('overview-next-tasks').innerHTML = nextHtml;
  }
}

function renderPlan(tasks) {
  var filterButtons = document.querySelectorAll('#plan-filter-group .seg');
  for (var i = 0; i < filterButtons.length; i += 1) {
    filterButtons[i].classList.toggle('is-active', filterButtons[i].dataset.filter === state.filter);
  }

  var filtered = [];
  for (var j = 0; j < tasks.length; j += 1) {
    if (state.filter === 'all' || tasks[j].status === state.filter) {
      filtered.push(tasks[j]);
    }
  }

  if (filtered.length === 0) {
    getEl('plan-tasks-list').innerHTML = '<p class="muted card-pad">No milestones match.</p>';
    return;
  }

  var html = '';
  for (var k = 0; k < filtered.length; k += 1) {
    var task = filtered[k];
    var isDone = task.status === 'completed';
    var checkClass = isDone ? 'check-btn is-done' : 'check-btn';
    var checkMark = isDone ? '&#10003;' : '';
    var titleClass = isDone ? 'small-strong is-done-text' : 'small-strong';

    html += '<div class="list-row"><div class="row align-start">';
    html += '<button type="button" class="' + checkClass + '" data-toggle-task="' + escapeHtml(task.id) + '">' + checkMark + '</button>';
    html += '<div><p class="' + titleClass + '">' + escapeHtml(task.topicTitle) + '</p><p class="muted">' + escapeHtml(task.description) + '</p></div>';
    html += '</div><span class="meta mono">' + escapeHtml(task.priority) + ' · ' + formatShortDate(task.scheduledDate) + ' · ' + task.durationMinutes + 'm</span></div>';
  }
  getEl('plan-tasks-list').innerHTML = html;
}

function renderSummaries(sub, summaries) {
  fillTopicSelect('summary-topic-select', sub, false);
  getEl('summary-custom-topic').hidden = getEl('summary-topic-select').value !== '__custom__';

  if (summaries.length === 0) {
    getEl('summaries-container').innerHTML = '<div class="card"><p class="muted">Pick a topic above and click Make Study Sheet.</p></div>';
    return;
  }

  var current = summaries[0];
  for (var i = 0; i < summaries.length; i += 1) {
    if (summaries[i].id === state.sumId) {
      current = summaries[i];
      break;
    }
  }

  var historyHtml = '';
  for (var j = 0; j < summaries.length; j += 1) {
    var item = summaries[j];
    var cls = item.id === current.id ? 'history-item is-selected' : 'history-item';
    historyHtml += '<button type="button" class="' + cls + '" data-sel-sum="' + escapeHtml(item.id) + '">';
    historyHtml += '<span class="small-strong">' + escapeHtml(item.topicTitle) + '</span>';
    historyHtml += '<span class="meta">' + item.formulaSheet.length + ' formulas</span></button>';
  }

  var conceptsHtml = '';
  for (var c = 0; c < current.coreConcepts.length; c += 1) {
    conceptsHtml += '<p class="muted"><span class="mono lime">' + (c + 1) + '.</span> ' + escapeHtml(current.coreConcepts[c]) + '</p>';
  }

  var formulasHtml = '';
  if (current.formulaSheet.length > 0) {
    formulasHtml += '<div class="grid-2">';
    for (var f = 0; f < current.formulaSheet.length; f += 1) {
      var fm = current.formulaSheet[f];
      formulasHtml += '<div class="formula-card"><span class="small-strong">' + escapeHtml(fm.label) + '</span>';
      formulasHtml += '<div class="formula-expr">' + escapeHtml(fm.expression) + '</div>';
      formulasHtml += '<span class="meta">' + escapeHtml(fm.note) + '</span></div>';
    }
    formulasHtml += '</div>';
  }

  var pitfallsHtml = '';
  for (var p = 0; p < current.examPitfalls.length; p += 1) {
    pitfallsHtml += '<p class="muted">- ' + escapeHtml(current.examPitfalls[p]) + '</p>';
  }

  var anchor = escapeHtml(current.memoryAnchor || 'Review derivations.');
  var html = '<div class="split">';
  html += '<div class="card flush">' + historyHtml + '</div>';
  html += '<article class="card">';
  html += '<h3 class="h2">' + escapeHtml(current.topicTitle) + '</h3><p class="body-copy">' + escapeHtml(current.overview) + '</p>';
  html += '<div class="stack-sm"><span class="small-strong">Core Concepts</span>' + conceptsHtml + '</div>';
  html += formulasHtml;
  html += '<div class="grid-2 divider-top"><div class="stack-sm"><span class="small-strong amber">Exam Pitfalls</span>' + pitfallsHtml + '</div>';
  html += '<div class="formula-card"><span class="small-strong lime">Memory Hook</span><p class="muted">' + anchor + '</p></div></div>';
  html += '</article></div>';

  getEl('summaries-container').innerHTML = html;
}

function getMissedQuizTopics(quizzes) {
  var topics = [];
  for (var i = 0; i < quizzes.length; i += 1) {
    var quiz = quizzes[i];
    if (quiz.status !== 'completed') continue;
    for (var j = 0; j < quiz.questions.length; j += 1) {
      if (quiz.userAnswers[j] !== quiz.questions[j].correctIndex) {
        if (topics.indexOf(quiz.topicTitle) === -1) {
          topics.push(quiz.topicTitle);
        }
        break;
      }
    }
  }
  return topics;
}

function renderQuizzes(sub, quizzes) {
  fillTopicSelect('quiz-topic-select', sub, true);
  var weakTopics = getMissedQuizTopics(quizzes);
  getEl('drill-weak-btn').hidden = weakTopics.length === 0;

  if (quizzes.length === 0) {
    getEl('quizzes-container').innerHTML = '<div class="card"><p class="muted">Pick a topic and click Start Quiz.</p></div>';
    return;
  }

  var current = quizzes[0];
  for (var i = 0; i < quizzes.length; i += 1) {
    if (quizzes[i].id === state.quizId) {
      current = quizzes[i];
      break;
    }
  }

  var historyHtml = '';
  for (var j = 0; j < quizzes.length; j += 1) {
    var item = quizzes[j];
    var cls = item.id === current.id ? 'history-item is-selected' : 'history-item';
    var statusLabel = item.status === 'completed' ? item.scorePercent + '%' : 'In progress';
    historyHtml += '<button type="button" class="' + cls + '" data-sel-quiz="' + escapeHtml(item.id) + '">';
    historyHtml += '<span class="small-strong">' + escapeHtml(item.topicTitle) + '</span>';
    historyHtml += '<span class="meta">' + statusLabel + ' · ' + item.questions.length + ' Qs</span></button>';
  }

  var isDone = current.status === 'completed';
  var allAnswered = true;
  for (var a = 0; a < current.questions.length; a += 1) {
    if (state.draft[a] === undefined || state.draft[a] < 0) {
      allAnswered = false;
      break;
    }
  }

  var questionsHtml = '';
  for (var qi = 0; qi < current.questions.length; qi += 1) {
    var q = current.questions[qi];
    var picked = isDone ? current.userAnswers[qi] : state.draft[qi];
    questionsHtml += '<div class="stack-sm divider-top"><p class="small-strong"><span class="mono">Q' + (qi + 1) + '.</span> ' + escapeHtml(q.prompt) + '</p>';

    for (var oi = 0; oi < q.options.length; oi += 1) {
      var optClass = 'quiz-opt';
      if (isDone) {
        if (oi === q.correctIndex) optClass += ' is-correct';
        else if (oi === picked) optClass += ' is-wrong';
      } else if (picked === oi) {
        optClass += ' is-selected';
      }

      var letter = String.fromCharCode(65 + oi);
      var attrs = isDone ? 'disabled' : 'data-qq="' + qi + '" data-qo="' + oi + '"';
      questionsHtml += '<button type="button" class="' + optClass + '" ' + attrs + '><span class="mono">' + letter + '.</span><span>' + escapeHtml(q.options[oi]) + '</span></button>';
    }

    if (isDone) {
      questionsHtml += '<p class="meta">' + escapeHtml(q.explanation) + '</p>';
    }
    questionsHtml += '</div>';
  }

  var scoreHtml = '';
  if (isDone) {
    var scoreColor = current.scorePercent >= 70 ? 'lime' : 'amber';
    scoreHtml = '<span class="kpi ' + scoreColor + '">' + current.scorePercent + '%</span>';
  }

  var footerHtml = '';
  if (!isDone) {
    var disabledAttr = allAnswered ? '' : 'disabled';
    footerHtml = '<div class="row end"><button type="button" id="submit-quiz-btn" class="btn primary" ' + disabledAttr + '>Grade Quiz</button></div>';
  }

  var html = '<div class="split">';
  html += '<div class="card flush">' + historyHtml + '</div>';
  html += '<div class="card">';
  html += '<div class="row between"><div><h3 class="h2">' + escapeHtml(current.topicTitle) + '</h3><p class="meta">' + escapeHtml(current.difficulty) + ' · ' + current.questions.length + ' Qs</p></div>' + scoreHtml + '</div>';
  html += questionsHtml + footerHtml;
  html += '</div></div>';

  getEl('quizzes-container').innerHTML = html;
}

function renderWorkspace() {
  var sub = getCurrentSubject();
  renderSidebar(sub);

  getEl('empty-subjects-state').hidden = Boolean(sub);
  getEl('subject-workspace').hidden = !sub;

  var tabs = document.querySelectorAll('.tab');
  for (var i = 0; i < tabs.length; i += 1) {
    tabs[i].disabled = !sub;
    tabs[i].classList.toggle('is-active', tabs[i].dataset.tab === state.tab);
  }

  if (!sub) {
    return;
  }

  var tasks = getSubjectTasks(sub.id);
  var summaries = getSubjectSummaries(sub.id);
  var quizzes = getSubjectQuizzes(sub.id);

  var doneCount = 0;
  for (var j = 0; j < tasks.length; j += 1) {
    if (tasks[j].status === 'completed') {
      doneCount += 1;
    }
  }
  var percent = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;

  getEl('subject-title-heading').textContent = sub.title;
  getEl('subject-meta-line').textContent = 'Exam ' + formatShortDate(sub.examDate) + ' · ' + sub.dailyHours + 'h/day · ' + sub.topics.length + ' topics';
  getEl('readiness-percent').textContent = percent + '%';
  getEl('readiness-bar-fill').style.width = percent + '%';
  getEl('kpi-days').textContent = getDaysLeft(sub.examDate) + 'd';
  getEl('kpi-milestones').textContent = doneCount + '/' + tasks.length;
  getEl('kpi-quiz-avg').textContent = getQuizAverageText(quizzes) || '—';

  var panelNames = ['overview', 'plan', 'summaries', 'quizzes'];
  for (var p = 0; p < panelNames.length; p += 1) {
    getEl('panel-' + panelNames[p]).hidden = state.tab !== panelNames[p];
  }

  if (state.tab === 'overview') {
    renderOverview(sub, tasks, summaries);
  } else if (state.tab === 'plan') {
    renderPlan(tasks);
  } else if (state.tab === 'summaries') {
    renderSummaries(sub, summaries);
  } else {
    renderQuizzes(sub, quizzes);
  }
}

// 7. Modal & AI Actions
function openModal(show) {
  getEl('add-subject-modal').hidden = !show;
  if (show) {
    getEl('new-subject-date').value = plusDays(6);
    getEl('new-subject-title').focus();
    showBanner('modal-error', '');
    showBanner('modal-status', '');
  } else {
    getEl('add-subject-form').reset();
    state.fileData = null;
    getEl('uploaded-file-name').textContent = 'No file attached (PDF/PNG/JPG/TXT, 10 MB max)';
    getEl('clear-file-btn').hidden = true;
  }
}

async function runSummary(topic) {
  var sub = getCurrentSubject();
  var button = getEl('generate-summary-btn');
  if (!sub || !topic) return;

  button.disabled = true;
  button.textContent = 'Generating...';
  showBanner('summary-error', '');
  try {
    var result = await postJson('/api/ai/generate-summary', {
      subjectTitle: sub.title,
      topicTitle: topic,
      syllabusContext: sub.syllabusOverview,
    });
    saveSummary(sub.id, topic, result);
  } catch (err) {
    showBanner('summary-error', err.message);
  } finally {
    button.disabled = false;
    button.textContent = 'Make Study Sheet';
  }
}

async function runQuiz(topic, weakTopics) {
  var sub = getCurrentSubject();
  var button = getEl('start-quiz-btn');
  var difficulty = getEl('quiz-difficulty-select').value;
  if (!sub || !topic) return;

  button.disabled = true;
  button.textContent = 'Building...';
  showBanner('quiz-error', '');
  try {
    var result = await postJson('/api/ai/generate-quiz', {
      subjectTitle: sub.title,
      topicTitle: topic,
      difficulty: difficulty,
      questionCount: Number(getEl('quiz-count-select').value),
      syllabusContext: sub.syllabusOverview,
      focusWeaknesses: weakTopics || [],
    });
    if (!result.questions || result.questions.length === 0) {
      throw new Error('No questions returned.');
    }
    saveQuiz(sub.id, topic, difficulty, result.questions);
  } catch (err) {
    showBanner('quiz-error', err.message);
  } finally {
    button.disabled = false;
    button.textContent = 'Start Quiz';
  }
}

// 8. Event Listeners & Startup
document.addEventListener('click', function (event) {
  var btn = event.target.closest('button');
  if (!btn) return;

  if (btn.id === 'primary-action-btn' || btn.id === 'sidebar-add-btn' || btn.id === 'empty-add-subject-btn') {
    openModal(true);
    return;
  }
  if (btn.id === 'load-sample-btn') {
    loadSampleSubject();
    return;
  }
  if (btn.id === 'close-modal-btn' || btn.id === 'cancel-modal-btn') {
    openModal(false);
    return;
  }

  if (btn.dataset.tab && getCurrentSubject()) {
    state.tab = btn.dataset.tab;
    saveState();
    renderWorkspace();
    return;
  }
  if (btn.dataset.selectSubject) {
    state.subId = btn.dataset.selectSubject;
    syncActiveItems();
    saveState();
    renderWorkspace();
    return;
  }
  if (btn.id === 'jump-full-schedule-btn') {
    state.tab = 'plan';
    saveState();
    renderWorkspace();
    return;
  }
  if (btn.dataset.jumpSum) {
    state.tab = 'summaries';
    renderWorkspace();
    getEl('summary-topic-select').value = btn.dataset.jumpSum;
    runSummary(btn.dataset.jumpSum);
    return;
  }
  if (btn.dataset.jumpQuiz) {
    state.tab = 'quizzes';
    renderWorkspace();
    getEl('quiz-topic-select').value = btn.dataset.jumpQuiz;
    runQuiz(btn.dataset.jumpQuiz);
    return;
  }

  if (btn.id === 'ask-delete-subject-btn') {
    getEl('delete-prompt-default').hidden = true;
    getEl('delete-prompt-confirm').hidden = false;
    return;
  }
  if (btn.id === 'cancel-delete-subject-btn') {
    getEl('delete-prompt-default').hidden = false;
    getEl('delete-prompt-confirm').hidden = true;
    return;
  }
  if (btn.id === 'confirm-delete-subject-btn' && getCurrentSubject()) {
    removeSubject(getCurrentSubject().id);
    getEl('delete-prompt-default').hidden = false;
    getEl('delete-prompt-confirm').hidden = true;
    return;
  }

  if (btn.dataset.filter) {
    state.filter = btn.dataset.filter;
    renderWorkspace();
    return;
  }
  if (btn.id === 'toggle-add-task-btn' || btn.id === 'cancel-add-task-btn') {
    var form = getEl('add-milestone-form');
    form.hidden = !form.hidden;
    if (!form.hidden) {
      getEl('milestone-date').value = plusDays(6);
    }
    return;
  }
  if (btn.dataset.toggleTask) {
    toggleTask(btn.dataset.toggleTask);
    return;
  }

  if (btn.id === 'generate-summary-btn') {
    var selectedTopic = getEl('summary-topic-select').value;
    var finalTopic = selectedTopic === '__custom__' ? getEl('summary-custom-topic').value.trim() : selectedTopic;
    runSummary(finalTopic);
    return;
  }
  if (btn.dataset.selSum) {
    state.sumId = btn.dataset.selSum;
    renderWorkspace();
    return;
  }
  if (btn.id === 'start-quiz-btn') {
    runQuiz(getEl('quiz-topic-select').value);
    return;
  }
  if (btn.id === 'drill-weak-btn' && getCurrentSubject()) {
    var missed = getMissedQuizTopics(getSubjectQuizzes(getCurrentSubject().id));
    if (missed.length > 0) {
      runQuiz('Weak Drill: ' + missed[0], missed);
    }
    return;
  }
  if (btn.dataset.selQuiz) {
    for (var i = 0; i < state.quizzes.length; i += 1) {
      if (state.quizzes[i].id === btn.dataset.selQuiz) {
        state.quizId = state.quizzes[i].id;
        state.draft = state.quizzes[i].userAnswers.slice();
        renderWorkspace();
        break;
      }
    }
    return;
  }
  if (btn.dataset.qq !== undefined) {
    state.draft[Number(btn.dataset.qq)] = Number(btn.dataset.qo);
    renderWorkspace();
    return;
  }
  if (btn.id === 'submit-quiz-btn') {
    for (var j = 0; j < state.quizzes.length; j += 1) {
      if (state.quizzes[j].id === state.quizId) {
        gradeQuiz(state.quizzes[j], state.draft);
        break;
      }
    }
    return;
  }

  if (btn.dataset.sample !== undefined) {
    var sample = SAMPLES[Number(btn.dataset.sample)];
    if (sample) {
      getEl('new-subject-title').value = sample.title;
      getEl('new-subject-syllabus').value = sample.text;
    }
    return;
  }
  if (btn.id === 'clear-file-btn') {
    state.fileData = null;
    getEl('syllabus-file-input').value = '';
    getEl('uploaded-file-name').textContent = 'No file attached (PDF/PNG/JPG/TXT, 10 MB max)';
    getEl('clear-file-btn').hidden = true;
  }
});

getEl('summary-topic-select').addEventListener('change', function (event) {
  getEl('summary-custom-topic').hidden = event.target.value !== '__custom__';
});

getEl('add-milestone-form').addEventListener('submit', function (event) {
  event.preventDefault();
  var sub = getCurrentSubject();
  if (!sub) return;

  addTask(sub.id, {
    topic: getEl('milestone-topic').value,
    date: getEl('milestone-date').value,
    mins: getEl('milestone-duration').value,
    pri: getEl('milestone-priority').value,
    desc: getEl('milestone-desc').value,
  });
  event.target.reset();
  event.target.hidden = true;
});

getEl('syllabus-file-input').addEventListener('change', async function (event) {
  var file = event.target.files ? event.target.files[0] : null;
  if (!file) return;

  showBanner('modal-error', '');
  if (file.size > 10 * 1024 * 1024) {
    showBanner('modal-error', 'File exceeds 10 MB.');
    return;
  }

  if (file.type.indexOf('text/') === 0 || /\.(txt|md)$/i.test(file.name)) {
    var text = await file.text();
    getEl('new-subject-syllabus').value = text.slice(0, 20000);
    state.fileData = null;
  } else {
    var dataUrl = await new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || '')); };
      reader.onerror = function () { reject(new Error('Read failed')); };
      reader.readAsDataURL(file);
    });
    state.fileData = {
      mimeType: file.type || 'application/pdf',
      base64: dataUrl.split(',')[1] || '',
    };
  }

  getEl('uploaded-file-name').textContent = file.name;
  getEl('clear-file-btn').hidden = false;
});

getEl('add-subject-form').addEventListener('submit', async function (event) {
  event.preventDefault();
  var button = getEl('submit-subject-btn');
  button.disabled = true;
  button.textContent = 'Generating...';
  showBanner('modal-error', '');
  showBanner('modal-status', 'Reading syllabus...');

  try {
    var title = getEl('new-subject-title').value.trim();
    var examDate = getEl('new-subject-date').value;
    var hours = Number(getEl('new-subject-hours').value) || 3;
    var parsed = await postJson('/api/ai/parse-syllabus', {
      subjectTitle: title,
      examDate: examDate,
      dailyHours: hours,
      currentDate: plusDays(0),
      syllabusText: getEl('new-subject-syllabus').value,
      fileData: state.fileData,
    });
    createSubject(title, examDate, hours, parsed);
    openModal(false);
  } catch (err) {
    showBanner('modal-status', '');
    showBanner('modal-error', err.message);
  } finally {
    button.disabled = false;
    button.textContent = 'Build Study Plan';
  }
});

loadState();
renderWorkspace();
