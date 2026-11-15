// 1. App Data & Sample Syllabi
var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

var SAMPLES = [
  {
    title: 'Data Structures & Algorithms',
    text: 'Unit 1: Big-O, Recurrence Relations, Master Theorem\nUnit 2: Stacks, Queues, Linked Lists\nUnit 3: BSTs, AVL Rotations, Heaps\nUnit 4: BFS, DFS, Dijkstra, Kruskal MST'
  },
  {
    title: 'Discrete Mathematics',
    text: 'Mod 1: Quantifiers & Proofs\nMod 2: Equivalence Relations\nMod 3: Strong Induction & Recurrences\nMod 4: Pigeonhole & Inclusion-Exclusion'
  }
];

var subjects = [];
var tasks = [];
var summaries = [];
var quizzes = [];
var activeSubId = '';
var activeSumId = '';
var activeQuizId = '';
var quizDraft = [];
var activeTab = 'overview';
var activeFilter = 'all';

// 2. Classic DOM, String & Date Helpers
function getEl(id) {
  return document.getElementById(id);
}

function trimText(str) {
  return String(str || '').replace(/^\s+|\s+$/g, '');
}

function isList(val) {
  return val && typeof val === 'object' && typeof val.length === 'number';
}

function makeId(prefix) {
  var rand = Math.floor(Math.random() * 100000);
  return prefix + '_' + new Date().getTime() + '_' + rand;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toggleClass(id, cls, active) {
  var el = getEl(id);
  var padded = ' ' + el.className + ' ';
  var has = padded.indexOf(' ' + cls + ' ') !== -1;
  if (active && !has) {
    el.className = trimText(el.className + ' ' + cls);
  } else if (!active && has) {
    el.className = trimText(padded.replace(' ' + cls + ' ', ' '));
  }
}

function showEl(id, show) {
  toggleClass(id, 'is-hidden', !show);
}

function showBanner(id, message) {
  var el = getEl(id);
  if (message) {
    el.innerHTML = escapeHtml(message);
    showEl(id, true);
  } else {
    el.innerHTML = '';
    showEl(id, false);
  }
}

function getSelectValue(id) {
  var sel = getEl(id);
  if (sel.selectedIndex >= 0 && sel.options.length > 0) {
    return sel.options[sel.selectedIndex].value;
  }
  return '';
}

function plusDays(days) {
  var d = new Date();
  d.setDate(d.getDate() + days);
  var y = d.getFullYear();
  var m = d.getMonth() + 1;
  var day = d.getDate();
  var mm = m < 10 ? '0' + m : '' + m;
  var dd = day < 10 ? '0' + day : '' + day;
  return y + '-' + mm + '-' + dd;
}

function parseYmd(dateText) {
  var parts = String(dateText || '').split('-');
  if (parts.length !== 3) {
    return null;
  }
  var y = parseInt(parts[0], 10);
  var m = parseInt(parts[1], 10) - 1;
  var d = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) {
    return null;
  }
  return new Date(y, m, d);
}

function getDaysLeft(dateText) {
  var exam = parseYmd(dateText);
  if (!exam) {
    return 0;
  }
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var diff = Math.ceil((exam.getTime() - today.getTime()) / 86400000);
  if (diff < 0) {
    return 0;
  }
  return diff;
}

function formatShortDate(dateText) {
  var d = parseYmd(dateText);
  if (!d) {
    return dateText || '';
  }
  return MONTHS[d.getMonth()] + ' ' + d.getDate();
}

// 3. Single XMLHttpRequest Helper for AI Endpoints
function callAi(url, bodyObj, onDone, onError) {
  var xhr = new XMLHttpRequest();
  xhr.open('POST', url, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.onreadystatechange = function () {
    if (xhr.readyState !== 4) {
      return;
    }
    var data = {};
    try {
      data = JSON.parse(xhr.responseText || '{}');
    } catch (err) {
      data = {};
    }
    if (xhr.status >= 200 && xhr.status < 300) {
      onDone(data);
    } else {
      onError(data.error || ('Request failed (' + xhr.status + ')'));
    }
  };
  xhr.send(JSON.stringify(bodyObj));
}

// 4. Cookie Persistence (setCookie & getCookie from PDF)
function setCookie(c_name, value, expiredays) {
  var exdate = new Date();
  exdate.setDate(exdate.getDate() + expiredays);
  document.cookie = c_name + '=' + escape(value) + ((expiredays == null) ? '' : ';expires=' + exdate.toGMTString()) + ';path=/';
}

function getCookie(c_name) {
  if (document.cookie.length > 0) {
    var c_start = document.cookie.indexOf(c_name + '=');
    if (c_start !== -1) {
      c_start = c_start + c_name.length + 1;
      var c_end = document.cookie.indexOf(';', c_start);
      if (c_end === -1) {
        c_end = document.cookie.length;
      }
      return unescape(document.cookie.substring(c_start, c_end));
    }
  }
  return '';
}

function cleanCookieText(val, maxLen) {
  var clean = String(val || '').replace(/[\^\|\~\r\n]/g, ' ');
  if (maxLen && clean.length > maxLen) {
    return clean.substring(0, maxLen);
  }
  return clean;
}

function saveState() {
  setCookie('taau_meta', activeSubId + '|' + activeTab, 30);

  var subRows = [];
  for (var i = 0; i < subjects.length && i < 6; i += 1) {
    var s = subjects[i];
    var cleanTopics = [];
    for (var t = 0; t < s.topics.length && t < 16; t += 1) {
      cleanTopics.push(cleanCookieText(s.topics[t], 60));
    }
    var row = [
      cleanCookieText(s.id, 40),
      cleanCookieText(s.title, 80),
      cleanCookieText(s.examDate, 12),
      String(s.dailyHours),
      cleanCookieText(s.syllabusOverview, 240),
      cleanTopics.join('^')
    ].join('|');
    if ((subRows.join('~') + '~' + row).length <= 2600) {
      subRows.push(row);
    }
  }
  setCookie('taau_subs', subRows.join('~'), 30);

  var taskRows = [];
  for (var j = 0; j < tasks.length && j < 45; j += 1) {
    var tk = tasks[j];
    var tRow = [
      cleanCookieText(tk.id, 40),
      cleanCookieText(tk.subjectId, 40),
      cleanCookieText(tk.topicTitle, 55),
      cleanCookieText(tk.description, 85),
      cleanCookieText(tk.scheduledDate, 12),
      String(tk.durationMinutes),
      cleanCookieText(tk.priority, 10),
      cleanCookieText(tk.status, 12),
      String(tk.orderIndex)
    ].join('|');
    if ((taskRows.join('~') + '~' + tRow).length <= 2600) {
      taskRows.push(tRow);
    }
  }
  setCookie('taau_tasks', taskRows.join('~'), 30);
}

function loadState() {
  var metaRaw = getCookie('taau_meta');
  if (metaRaw) {
    var metaParts = metaRaw.split('|');
    if (metaParts[0]) {
      activeSubId = metaParts[0];
    }
    if (metaParts[1] === 'overview' || metaParts[1] === 'plan' || metaParts[1] === 'summaries' || metaParts[1] === 'quizzes') {
      activeTab = metaParts[1];
    }
  }

  var subsRaw = getCookie('taau_subs');
  if (subsRaw) {
    var subRows = subsRaw.split('~');
    for (var i = 0; i < subRows.length; i += 1) {
      var p = subRows[i].split('|');
      if (p.length >= 6 && p[0]) {
        var topicList = p[5] ? p[5].split('^') : [];
        subjects.push({
          id: p[0],
          title: p[1],
          examDate: p[2],
          dailyHours: Number(p[3]) || 3,
          syllabusOverview: p[4],
          topics: topicList
        });
      }
    }
  }

  var tasksRaw = getCookie('taau_tasks');
  if (tasksRaw) {
    var taskRows = tasksRaw.split('~');
    for (var j = 0; j < taskRows.length; j += 1) {
      var q = taskRows[j].split('|');
      if (q.length >= 9 && q[0]) {
        tasks.push({
          id: q[0],
          subjectId: q[1],
          topicTitle: q[2],
          description: q[3],
          scheduledDate: q[4],
          durationMinutes: Number(q[5]) || 45,
          priority: q[6] || 'medium',
          status: q[7] === 'completed' ? 'completed' : 'pending',
          orderIndex: Number(q[8]) || 0
        });
      }
    }
  }
  syncActiveItems();
}

// 5. Data Lookups & State Updates
function getCurrentSubject() {
  for (var i = 0; i < subjects.length; i += 1) {
    if (subjects[i].id === activeSubId) {
      return subjects[i];
    }
  }
  if (subjects.length > 0) {
    return subjects[0];
  }
  return null;
}

function getSubjectTasks(subjectId) {
  var list = [];
  for (var i = 0; i < tasks.length; i += 1) {
    if (tasks[i].subjectId === subjectId) {
      list.push(tasks[i]);
    }
  }
  list.sort(function (a, b) {
    if (a.scheduledDate < b.scheduledDate) return -1;
    if (a.scheduledDate > b.scheduledDate) return 1;
    return a.orderIndex - b.orderIndex;
  });
  return list;
}

function getSubjectSummaries(subjectId) {
  var list = [];
  for (var i = 0; i < summaries.length; i += 1) {
    if (summaries[i].subjectId === subjectId) {
      list.push(summaries[i]);
    }
  }
  return list;
}

function getSubjectQuizzes(subjectId) {
  var list = [];
  for (var i = 0; i < quizzes.length; i += 1) {
    if (quizzes[i].subjectId === subjectId) {
      list.push(quizzes[i]);
    }
  }
  return list;
}

function syncActiveItems() {
  var sub = getCurrentSubject();
  if (!sub) {
    activeSubId = '';
    activeSumId = '';
    activeQuizId = '';
    quizDraft = [];
    return;
  }

  activeSubId = sub.id;
  var sums = getSubjectSummaries(sub.id);
  var foundSum = false;
  for (var i = 0; i < sums.length; i += 1) {
    if (sums[i].id === activeSumId) {
      foundSum = true;
    }
  }
  if (!foundSum) {
    activeSumId = sums.length > 0 ? sums[0].id : '';
  }

  var quzs = getSubjectQuizzes(sub.id);
  var currentQuiz = null;
  for (var j = 0; j < quzs.length; j += 1) {
    if (quzs[j].id === activeQuizId) {
      currentQuiz = quzs[j];
    }
  }
  if (!currentQuiz && quzs.length > 0) {
    currentQuiz = quzs[0];
  }
  if (currentQuiz) {
    activeQuizId = currentQuiz.id;
    quizDraft = currentQuiz.userAnswers.slice(0);
  } else {
    activeQuizId = '';
    quizDraft = [];
  }
}

function createSubject(title, examDate, hours, parsed) {
  var id = makeId('sub');
  var cleanHours = Number(hours) || 3;
  if (cleanHours < 0.5) cleanHours = 0.5;

  subjects.push({
    id: id,
    title: title || 'Subject',
    examDate: examDate || plusDays(6),
    dailyHours: cleanHours,
    syllabusOverview: parsed.syllabusOverview || 'Exam syllabus',
    topics: isList(parsed.topics) ? parsed.topics.slice(0, 16) : []
  });

  var parsedTasks = isList(parsed.tasks) ? parsed.tasks.slice(0, 24) : [];
  for (var i = 0; i < parsedTasks.length; i += 1) {
    var item = parsedTasks[i];
    tasks.push({
      id: makeId('tsk'),
      subjectId: id,
      topicTitle: item.topicTitle || 'Revision',
      description: item.description || 'Review and solve problems.',
      scheduledDate: item.scheduledDate || examDate,
      durationMinutes: Number(item.durationMinutes) || 45,
      priority: item.priority || 'medium',
      status: 'pending',
      orderIndex: i
    });
  }

  subjects.sort(function (a, b) {
    if (a.examDate < b.examDate) return -1;
    if (a.examDate > b.examDate) return 1;
    return 0;
  });

  activeSubId = id;
  activeTab = 'overview';
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
      { topicTitle: 'BFS, DFS & Shortest Paths', description: 'Run Dijkstra and Kruskal dry runs on weighted graphs.', scheduledDate: plusDays(5), durationMinutes: 60, priority: 'high' }
    ]
  });
}

function toggleTask(taskId) {
  for (var i = 0; i < tasks.length; i += 1) {
    if (tasks[i].id === taskId) {
      if (tasks[i].status === 'completed') {
        tasks[i].status = 'pending';
      } else {
        tasks[i].status = 'completed';
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

  tasks.push({
    id: makeId('tsk'),
    subjectId: subjectId,
    topicTitle: trimText(input.topic) || 'Milestone',
    description: trimText(input.desc) || 'Focused practice',
    scheduledDate: input.date || plusDays(6),
    durationMinutes: minutes,
    priority: input.pri || 'medium',
    status: 'pending',
    orderIndex: getSubjectTasks(subjectId).length
  });
  saveState();
  renderWorkspace();
}

function saveSummary(subjectId, topic, data) {
  var id = makeId('sum');
  summaries.unshift({
    id: id,
    subjectId: subjectId,
    topicTitle: topic,
    overview: data.overview || 'Summary generated.',
    coreConcepts: isList(data.coreConcepts) ? data.coreConcepts.slice(0, 15) : [],
    formulaSheet: isList(data.formulaSheet) ? data.formulaSheet.slice(0, 15) : [],
    examPitfalls: isList(data.examPitfalls) ? data.examPitfalls.slice(0, 12) : [],
    memoryAnchor: data.memoryAnchor || ''
  });
  activeSumId = id;
  renderWorkspace();
}

function saveQuiz(subjectId, topic, difficulty, rawQuestions) {
  var id = makeId('quz');
  var cleanQuestions = [];
  var limit = Math.min(rawQuestions.length, 15);

  for (var i = 0; i < limit; i += 1) {
    var q = rawQuestions[i];
    var options = isList(q.options) ? q.options.slice(0, 4) : [];
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
      explanation: q.explanation || 'Review notes.'
    });
  }

  var blankAnswers = [];
  for (var j = 0; j < cleanQuestions.length; j += 1) {
    blankAnswers.push(-1);
  }

  quizzes.unshift({
    id: id,
    subjectId: subjectId,
    topicTitle: topic,
    difficulty: difficulty,
    questions: cleanQuestions,
    userAnswers: blankAnswers,
    scorePercent: -1,
    status: 'in_progress'
  });
  activeQuizId = id;
  quizDraft = blankAnswers.slice(0);
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
  quiz.userAnswers = answers.slice(0);
  quiz.scorePercent = Math.round((correctCount / total) * 100);
  quiz.status = 'completed';
  renderWorkspace();
}

function removeSubject(subjectId) {
  var nextSubjects = [];
  for (var i = 0; i < subjects.length; i += 1) {
    if (subjects[i].id !== subjectId) {
      nextSubjects.push(subjects[i]);
    }
  }
  subjects = nextSubjects;

  var nextTasks = [];
  for (var j = 0; j < tasks.length; j += 1) {
    if (tasks[j].subjectId !== subjectId) {
      nextTasks.push(tasks[j]);
    }
  }
  tasks = nextTasks;

  var nextSums = [];
  for (var k = 0; k < summaries.length; k += 1) {
    if (summaries[k].subjectId !== subjectId) {
      nextSums.push(summaries[k]);
    }
  }
  summaries = nextSums;

  var nextQuzs = [];
  for (var m = 0; m < quizzes.length; m += 1) {
    if (quizzes[m].subjectId !== subjectId) {
      nextQuzs.push(quizzes[m]);
    }
  }
  quizzes = nextQuzs;

  activeSubId = subjects.length > 0 ? subjects[0].id : '';
  syncActiveItems();
  saveState();
  renderWorkspace();
}

// 6. Dynamic Click Handlers & UI Rendering
function onSubjectClick() {
  var idx = parseInt(this.id.replace('sub-btn-', ''), 10);
  if (subjects[idx]) {
    activeSubId = subjects[idx].id;
    syncActiveItems();
    saveState();
    renderWorkspace();
  }
}

function onJumpSummaryClick() {
  var idx = parseInt(this.id.replace('jump-sum-', ''), 10);
  var sub = getCurrentSubject();
  if (sub && sub.topics[idx]) {
    activeTab = 'summaries';
    saveState();
    renderWorkspace();
    getEl('summary-topic-select').value = sub.topics[idx];
    runSummary(sub.topics[idx]);
  }
}

function onJumpQuizClick() {
  var idx = parseInt(this.id.replace('jump-quiz-', ''), 10);
  var sub = getCurrentSubject();
  if (sub && sub.topics[idx]) {
    activeTab = 'quizzes';
    saveState();
    renderWorkspace();
    getEl('quiz-topic-select').value = sub.topics[idx];
    runQuiz(sub.topics[idx], []);
  }
}

function onTaskToggleClick() {
  var taskId = this.id.replace('next-tsk__', '').replace('plan-tsk__', '');
  toggleTask(taskId);
}

function onSummarySelectClick() {
  activeSumId = this.id.replace('sum-item__', '');
  renderWorkspace();
}

function onQuizSelectClick() {
  var id = this.id.replace('quiz-item__', '');
  for (var i = 0; i < quizzes.length; i += 1) {
    if (quizzes[i].id === id) {
      activeQuizId = quizzes[i].id;
      quizDraft = quizzes[i].userAnswers.slice(0);
      renderWorkspace();
      break;
    }
  }
}

function onQuizOptionClick() {
  var parts = this.id.split('_');
  var qi = parseInt(parts[1], 10);
  var oi = parseInt(parts[2], 10);
  quizDraft[qi] = oi;
  renderWorkspace();
}

function onSubmitQuizClick() {
  for (var i = 0; i < quizzes.length; i += 1) {
    if (quizzes[i].id === activeQuizId) {
      gradeQuiz(quizzes[i], quizDraft);
      break;
    }
  }
}

function fillTopicSelect(selectId, sub, includeAllOption) {
  var select = getEl(selectId);
  var previous = getSelectValue(selectId);
  var html = '';

  if (includeAllOption) {
    html += '<option value="Comprehensive Mock">All Topics (Mock)</option>';
  }
  for (var i = 0; i < sub.topics.length; i += 1) {
    var topic = escapeHtml(sub.topics[i]);
    html += '<option value="' + topic + '">' + topic + '</option>';
  }
  if (!includeAllOption) {
    html += '<option value="__custom__">Custom Topic...</option>';
  }

  select.innerHTML = html;
  for (var j = 0; j < select.options.length; j += 1) {
    if (select.options[j].value === previous) {
      select.options[j].selected = true;
      break;
    }
  }
}

function getQuizAverageText(subQuizzes) {
  var totalScore = 0;
  var count = 0;
  for (var i = 0; i < subQuizzes.length; i += 1) {
    if (subQuizzes[i].status === 'completed' && subQuizzes[i].scorePercent >= 0) {
      totalScore += subQuizzes[i].scorePercent;
      count += 1;
    }
  }
  if (count === 0) {
    return '';
  }
  return Math.round(totalScore / count) + '%';
}

function getMissedQuizTopics(subQuizzes) {
  var topics = [];
  for (var i = 0; i < subQuizzes.length; i += 1) {
    var quiz = subQuizzes[i];
    if (quiz.status !== 'completed') {
      continue;
    }
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

function renderSidebar(activeSubject) {
  getEl('subject-count').innerHTML = String(subjects.length);

  if (subjects.length === 0) {
    getEl('subject-list').innerHTML = '<p class="meta">No subjects yet.</p>';
    return;
  }

  var html = '';
  var percents = [];
  for (var i = 0; i < subjects.length; i += 1) {
    var sub = subjects[i];
    var subTasks = getSubjectTasks(sub.id);
    var doneCount = 0;
    for (var j = 0; j < subTasks.length; j += 1) {
      if (subTasks[j].status === 'completed') {
        doneCount += 1;
      }
    }
    var percent = subTasks.length > 0 ? Math.round((doneCount / subTasks.length) * 100) : 0;
    percents.push(percent);

    var avg = getQuizAverageText(getSubjectQuizzes(sub.id)) || 'no quiz';
    var left = getDaysLeft(sub.examDate);
    var dayColor = left <= 3 ? 'amber' : 'lime';
    var selectedClass = activeSubject && activeSubject.id === sub.id ? 'is-selected' : '';

    html += '<button type="button" id="sub-btn-' + i + '" class="subject-item ' + selectedClass + '">';
    html += '<div class="row between"><span class="small-strong truncate">' + escapeHtml(sub.title) + '</span><span class="mono ' + dayColor + '">' + left + 'd</span></div>';
    html += '<div class="track"><div id="sub-fill-' + i + '" class="fill"></div></div>';
    html += '<div class="row between meta mono"><span>' + doneCount + '/' + subTasks.length + '</span><span>' + avg + '</span></div>';
    html += '</button>';
  }

  getEl('subject-list').innerHTML = html;
  for (var k = 0; k < subjects.length; k += 1) {
    getEl('sub-fill-' + k).style.width = percents[k] + '%';
    getEl('sub-btn-' + k).onclick = onSubjectClick;
  }
}

function renderOverview(sub, subTasks, subSums) {
  getEl('overview-syllabus-text').innerHTML = escapeHtml(sub.syllabusOverview || 'No overview.');
  getEl('overview-sheets-count').innerHTML = subSums.length + ' sheets';

  if (sub.topics.length === 0) {
    getEl('overview-topics-list').innerHTML = '<p class="muted card-pad">No topics.</p>';
  } else {
    var topicsHtml = '';
    for (var i = 0; i < sub.topics.length; i += 1) {
      var num = (i + 1) < 10 ? '0' + (i + 1) : String(i + 1);
      var topic = escapeHtml(sub.topics[i]);
      topicsHtml += '<div class="list-row"><span class="truncate small-strong"><span class="mono muted">' + num + '</span> ' + topic + '</span>';
      topicsHtml += '<div class="row"><button type="button" id="jump-sum-' + i + '" class="link-btn">Sheet</button><span class="meta">&middot;</span><button type="button" id="jump-quiz-' + i + '" class="link-btn amber">Quiz</button></div></div>';
    }
    getEl('overview-topics-list').innerHTML = topicsHtml;
    for (var ti = 0; ti < sub.topics.length; ti += 1) {
      getEl('jump-sum-' + ti).onclick = onJumpSummaryClick;
      getEl('jump-quiz-' + ti).onclick = onJumpQuizClick;
    }
  }

  var pending = [];
  for (var j = 0; j < subTasks.length; j += 1) {
    if (subTasks[j].status === 'pending' && pending.length < 5) {
      pending.push(subTasks[j]);
    }
  }

  if (pending.length === 0) {
    getEl('overview-next-tasks').innerHTML = '<p class="muted card-pad">All milestones done.</p>';
  } else {
    var nextHtml = '';
    for (var k = 0; k < pending.length; k += 1) {
      var task = pending[k];
      nextHtml += '<div class="list-row"><div class="row">';
      nextHtml += '<button type="button" id="next-tsk__' + escapeHtml(task.id) + '" class="check-btn" aria-label="Mark done"></button>';
      nextHtml += '<div><p class="small-strong">' + escapeHtml(task.topicTitle) + '</p><p class="meta">' + formatShortDate(task.scheduledDate) + ' &middot; ' + task.durationMinutes + 'm</p></div>';
      nextHtml += '</div></div>';
    }
    getEl('overview-next-tasks').innerHTML = nextHtml;
    for (var p = 0; p < pending.length; p += 1) {
      getEl('next-tsk__' + pending[p].id).onclick = onTaskToggleClick;
    }
  }
}

function renderPlan(subTasks) {
  toggleClass('filter-all', 'is-active', activeFilter === 'all');
  toggleClass('filter-pending', 'is-active', activeFilter === 'pending');
  toggleClass('filter-completed', 'is-active', activeFilter === 'completed');

  var filtered = [];
  for (var i = 0; i < subTasks.length; i += 1) {
    if (activeFilter === 'all' || subTasks[i].status === activeFilter) {
      filtered.push(subTasks[i]);
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
    html += '<button type="button" id="plan-tsk__' + escapeHtml(task.id) + '" class="' + checkClass + '">' + checkMark + '</button>';
    html += '<div><p class="' + titleClass + '">' + escapeHtml(task.topicTitle) + '</p><p class="muted">' + escapeHtml(task.description) + '</p></div>';
    html += '</div><span class="meta mono">' + escapeHtml(task.priority) + ' &middot; ' + formatShortDate(task.scheduledDate) + ' &middot; ' + task.durationMinutes + 'm</span></div>';
  }
  getEl('plan-tasks-list').innerHTML = html;

  for (var j = 0; j < filtered.length; j += 1) {
    getEl('plan-tsk__' + filtered[j].id).onclick = onTaskToggleClick;
  }
}

function renderSummaries(sub, subSums) {
  fillTopicSelect('summary-topic-select', sub, false);
  showEl('summary-custom-topic', getSelectValue('summary-topic-select') === '__custom__');

  if (subSums.length === 0) {
    getEl('summaries-container').innerHTML = '<div class="card"><p class="muted">Pick a topic above and click Make Study Sheet.</p></div>';
    return;
  }

  var current = subSums[0];
  for (var i = 0; i < subSums.length; i += 1) {
    if (subSums[i].id === activeSumId) {
      current = subSums[i];
      break;
    }
  }

  var historyHtml = '';
  for (var j = 0; j < subSums.length; j += 1) {
    var item = subSums[j];
    var cls = item.id === current.id ? 'history-item is-selected' : 'history-item';
    historyHtml += '<button type="button" id="sum-item__' + escapeHtml(item.id) + '" class="' + cls + '">';
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
  for (var k = 0; k < subSums.length; k += 1) {
    getEl('sum-item__' + subSums[k].id).onclick = onSummarySelectClick;
  }
}

function renderQuizzes(sub, subQuizzes) {
  fillTopicSelect('quiz-topic-select', sub, true);
  var weakTopics = getMissedQuizTopics(subQuizzes);
  showEl('drill-weak-btn', weakTopics.length > 0);

  if (subQuizzes.length === 0) {
    getEl('quizzes-container').innerHTML = '<div class="card"><p class="muted">Pick a topic and click Start Quiz.</p></div>';
    return;
  }

  var current = subQuizzes[0];
  for (var i = 0; i < subQuizzes.length; i += 1) {
    if (subQuizzes[i].id === activeQuizId) {
      current = subQuizzes[i];
      break;
    }
  }

  var historyHtml = '';
  for (var j = 0; j < subQuizzes.length; j += 1) {
    var item = subQuizzes[j];
    var cls = item.id === current.id ? 'history-item is-selected' : 'history-item';
    var statusLabel = item.status === 'completed' ? item.scorePercent + '%' : 'In progress';
    historyHtml += '<button type="button" id="quiz-item__' + escapeHtml(item.id) + '" class="' + cls + '">';
    historyHtml += '<span class="small-strong">' + escapeHtml(item.topicTitle) + '</span>';
    historyHtml += '<span class="meta">' + statusLabel + ' &middot; ' + item.questions.length + ' Qs</span></button>';
  }

  var isDone = current.status === 'completed';
  var allAnswered = true;
  for (var a = 0; a < current.questions.length; a += 1) {
    if (quizDraft[a] === undefined || quizDraft[a] < 0) {
      allAnswered = false;
      break;
    }
  }

  var questionsHtml = '';
  for (var qi = 0; qi < current.questions.length; qi += 1) {
    var q = current.questions[qi];
    var picked = isDone ? current.userAnswers[qi] : quizDraft[qi];
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
      var optAttrs = isDone ? 'disabled' : 'id="qopt_' + qi + '_' + oi + '"';
      questionsHtml += '<button type="button" class="' + optClass + '" ' + optAttrs + '><span class="mono">' + letter + '.</span><span>' + escapeHtml(q.options[oi]) + '</span></button>';
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
  html += '<div class="row between"><div><h3 class="h2">' + escapeHtml(current.topicTitle) + '</h3><p class="meta">' + escapeHtml(current.difficulty) + ' &middot; ' + current.questions.length + ' Qs</p></div>' + scoreHtml + '</div>';
  html += questionsHtml + footerHtml;
  html += '</div></div>';

  getEl('quizzes-container').innerHTML = html;

  for (var hi = 0; hi < subQuizzes.length; hi += 1) {
    getEl('quiz-item__' + subQuizzes[hi].id).onclick = onQuizSelectClick;
  }
  if (!isDone) {
    for (var qIndex = 0; qIndex < current.questions.length; qIndex += 1) {
      for (var oIndex = 0; oIndex < current.questions[qIndex].options.length; oIndex += 1) {
        getEl('qopt_' + qIndex + '_' + oIndex).onclick = onQuizOptionClick;
      }
    }
    getEl('submit-quiz-btn').onclick = onSubmitQuizClick;
  }
}

function renderWorkspace() {
  var sub = getCurrentSubject();
  renderSidebar(sub);

  showEl('empty-subjects-state', !sub);
  showEl('subject-workspace', !!sub);

  var tabNames = ['overview', 'plan', 'summaries', 'quizzes'];
  for (var i = 0; i < tabNames.length; i += 1) {
    var name = tabNames[i];
    getEl('tab-' + name).disabled = !sub;
    toggleClass('tab-' + name, 'is-active', activeTab === name);
    showEl('panel-' + name, activeTab === name);
  }

  if (!sub) {
    return;
  }

  var subTasks = getSubjectTasks(sub.id);
  var subSums = getSubjectSummaries(sub.id);
  var subQuizzes = getSubjectQuizzes(sub.id);

  var doneCount = 0;
  for (var j = 0; j < subTasks.length; j += 1) {
    if (subTasks[j].status === 'completed') {
      doneCount += 1;
    }
  }
  var percent = subTasks.length > 0 ? Math.round((doneCount / subTasks.length) * 100) : 0;

  getEl('subject-title-heading').innerHTML = escapeHtml(sub.title);
  getEl('subject-meta-line').innerHTML = 'Exam ' + formatShortDate(sub.examDate) + ' &middot; ' + sub.dailyHours + 'h/day &middot; ' + sub.topics.length + ' topics';
  getEl('readiness-percent').innerHTML = percent + '%';
  getEl('readiness-bar-fill').style.width = percent + '%';
  getEl('kpi-days').innerHTML = getDaysLeft(sub.examDate) + 'd';
  getEl('kpi-milestones').innerHTML = doneCount + '/' + subTasks.length;
  getEl('kpi-quiz-avg').innerHTML = getQuizAverageText(subQuizzes) || '&mdash;';

  if (activeTab === 'overview') {
    renderOverview(sub, subTasks, subSums);
  } else if (activeTab === 'plan') {
    renderPlan(subTasks);
  } else if (activeTab === 'summaries') {
    renderSummaries(sub, subSums);
  } else {
    renderQuizzes(sub, subQuizzes);
  }
}

// 7. Modal & AI Actions
function openModal(show) {
  showEl('add-subject-modal', show);
  if (show) {
    getEl('new-subject-date').value = plusDays(6);
    getEl('new-subject-title').focus();
    showBanner('modal-error', '');
    showBanner('modal-status', '');
  } else {
    getEl('add-subject-form').reset();
  }
}

function runSummary(topic) {
  var sub = getCurrentSubject();
  var button = getEl('generate-summary-btn');
  if (!sub || !topic) {
    return;
  }

  button.disabled = true;
  button.innerHTML = 'Generating...';
  showBanner('summary-error', '');

  callAi('/api/ai/generate-summary', {
    subjectTitle: sub.title,
    topicTitle: topic,
    syllabusContext: sub.syllabusOverview
  }, function (result) {
    button.disabled = false;
    button.innerHTML = 'Make Study Sheet';
    saveSummary(sub.id, topic, result);
  }, function (errMsg) {
    button.disabled = false;
    button.innerHTML = 'Make Study Sheet';
    showBanner('summary-error', errMsg);
  });
}

function runQuiz(topic, weakTopics) {
  var sub = getCurrentSubject();
  var button = getEl('start-quiz-btn');
  var difficulty = getSelectValue('quiz-difficulty-select');
  if (!sub || !topic) {
    return;
  }

  button.disabled = true;
  button.innerHTML = 'Building...';
  showBanner('quiz-error', '');

  callAi('/api/ai/generate-quiz', {
    subjectTitle: sub.title,
    topicTitle: topic,
    difficulty: difficulty,
    questionCount: Number(getSelectValue('quiz-count-select')),
    syllabusContext: sub.syllabusOverview,
    focusWeaknesses: weakTopics || []
  }, function (result) {
    button.disabled = false;
    button.innerHTML = 'Start Quiz';
    if (!result.questions || result.questions.length === 0) {
      showBanner('quiz-error', 'No questions returned.');
      return;
    }
    saveQuiz(sub.id, topic, difficulty, result.questions);
  }, function (errMsg) {
    button.disabled = false;
    button.innerHTML = 'Start Quiz';
    showBanner('quiz-error', errMsg);
  });
}

// 8. Static Event Bindings & Startup
function switchTab(tabName) {
  if (!getCurrentSubject()) {
    return;
  }
  activeTab = tabName;
  saveState();
  renderWorkspace();
}

function bindStaticEvents() {
  getEl('primary-action-btn').onclick = function () { openModal(true); };
  getEl('sidebar-add-btn').onclick = function () { openModal(true); };
  getEl('empty-add-subject-btn').onclick = function () { openModal(true); };
  getEl('load-sample-btn').onclick = loadSampleSubject;
  getEl('close-modal-btn').onclick = function () { openModal(false); };
  getEl('cancel-modal-btn').onclick = function () { openModal(false); };

  getEl('tab-overview').onclick = function () { switchTab('overview'); };
  getEl('tab-plan').onclick = function () { switchTab('plan'); };
  getEl('tab-summaries').onclick = function () { switchTab('summaries'); };
  getEl('tab-quizzes').onclick = function () { switchTab('quizzes'); };
  getEl('jump-full-schedule-btn').onclick = function () { switchTab('plan'); };

  getEl('ask-delete-subject-btn').onclick = function () {
    showEl('delete-prompt-default', false);
    showEl('delete-prompt-confirm', true);
  };
  getEl('cancel-delete-subject-btn').onclick = function () {
    showEl('delete-prompt-default', true);
    showEl('delete-prompt-confirm', false);
  };
  getEl('confirm-delete-subject-btn').onclick = function () {
    var sub = getCurrentSubject();
    if (sub) {
      removeSubject(sub.id);
    }
    showEl('delete-prompt-default', true);
    showEl('delete-prompt-confirm', false);
  };

  getEl('filter-all').onclick = function () { activeFilter = 'all'; renderWorkspace(); };
  getEl('filter-pending').onclick = function () { activeFilter = 'pending'; renderWorkspace(); };
  getEl('filter-completed').onclick = function () { activeFilter = 'completed'; renderWorkspace(); };

  getEl('toggle-add-task-btn').onclick = function () {
    var form = getEl('add-milestone-form');
    var isHidden = (' ' + form.className + ' ').indexOf(' is-hidden ') !== -1;
    showEl('add-milestone-form', isHidden);
    if (isHidden) {
      getEl('milestone-date').value = plusDays(6);
    }
  };
  getEl('cancel-add-task-btn').onclick = function () {
    showEl('add-milestone-form', false);
  };

  getEl('add-milestone-form').onsubmit = function () {
    var sub = getCurrentSubject();
    if (!sub) {
      return false;
    }
    addTask(sub.id, {
      topic: getEl('milestone-topic').value,
      date: getEl('milestone-date').value,
      mins: getEl('milestone-duration').value,
      pri: getSelectValue('milestone-priority'),
      desc: getEl('milestone-desc').value
    });
    this.reset();
    showEl('add-milestone-form', false);
    return false;
  };

  getEl('summary-topic-select').onchange = function () {
    showEl('summary-custom-topic', getSelectValue('summary-topic-select') === '__custom__');
  };

  getEl('generate-summary-btn').onclick = function () {
    var picked = getSelectValue('summary-topic-select');
    var finalTopic = picked === '__custom__' ? trimText(getEl('summary-custom-topic').value) : picked;
    runSummary(finalTopic);
  };

  getEl('start-quiz-btn').onclick = function () {
    runQuiz(getSelectValue('quiz-topic-select'), []);
  };

  getEl('drill-weak-btn').onclick = function () {
    var sub = getCurrentSubject();
    if (!sub) {
      return;
    }
    var missed = getMissedQuizTopics(getSubjectQuizzes(sub.id));
    if (missed.length > 0) {
      runQuiz('Weak Drill: ' + missed[0], missed);
    }
  };

  getEl('sample-btn-0').onclick = function () {
    getEl('new-subject-title').value = SAMPLES[0].title;
    getEl('new-subject-syllabus').value = SAMPLES[0].text;
  };
  getEl('sample-btn-1').onclick = function () {
    getEl('new-subject-title').value = SAMPLES[1].title;
    getEl('new-subject-syllabus').value = SAMPLES[1].text;
  };

  getEl('add-subject-form').onsubmit = function () {
    var title = trimText(getEl('new-subject-title').value);
    var examDate = getEl('new-subject-date').value;
    var hours = Number(getEl('new-subject-hours').value) || 3;
    var syllabusText = trimText(getEl('new-subject-syllabus').value);

    showBanner('modal-error', '');
    if (!title || !examDate || !syllabusText) {
      showBanner('modal-error', 'Enter subject name, exam date, and syllabus units.');
      return false;
    }

    var button = getEl('submit-subject-btn');
    button.disabled = true;
    button.innerHTML = 'Generating...';
    showBanner('modal-status', 'Reading syllabus...');

    callAi('/api/ai/parse-syllabus', {
      subjectTitle: title,
      examDate: examDate,
      dailyHours: hours,
      currentDate: plusDays(0),
      syllabusText: syllabusText
    }, function (parsed) {
      button.disabled = false;
      button.innerHTML = 'Build Study Plan';
      createSubject(title, examDate, hours, parsed);
      openModal(false);
    }, function (errMsg) {
      button.disabled = false;
      button.innerHTML = 'Build Study Plan';
      showBanner('modal-status', '');
      showBanner('modal-error', errMsg);
    });
    return false;
  };
}

loadState();
bindStaticEvents();
renderWorkspace();
