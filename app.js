// 1. App Data & Curated Offline Knowledge Bank
var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

var SHEET_BANK = [
  {
    keys: ['big-o', 'recurrence', 'master', 'asymptotic', 'complexity'],
    overview: 'Asymptotic notation bounds algorithm growth as input size n grows, while recurrences model divide-and-conquer runtime.',
    coreConcepts: [
      'Big-O gives an asymptotic upper bound f(n) <= c * g(n) for n >= n0.',
      'Omega gives a tight lower bound and Theta gives both upper and lower bounds.',
      'Drop lower-order terms and constant multipliers when simplifying runtime.',
      'Master Theorem solves T(n) = aT(n/b) + f(n) by comparing f(n) with n^(log_b a).',
      'Recursion trees sum the work per level multiplied by tree height.'
    ],
    formulaSheet: [
      { label: 'Master Theorem Case 1', expression: 'f(n) = O(n^(log_b(a) - e)) => T(n) = Theta(n^log_b(a))', note: 'Leaf work dominates' },
      { label: 'Master Theorem Case 2', expression: 'f(n) = Theta(n^log_b(a)) => T(n) = Theta(n^log_b(a) * log n)', note: 'All levels balanced' },
      { label: 'Binary Search Recurrence', expression: 'T(n) = T(n/2) + O(1) => O(log n)', note: 'a = 1, b = 2' },
      { label: 'Merge Sort Recurrence', expression: 'T(n) = 2T(n/2) + O(n) => O(n log n)', note: 'a = 2, b = 2' }
    ],
    examPitfalls: [
      'Forgetting to check the regularity condition a * f(n/b) <= c * f(n) in Case 3.',
      'Assuming O(n log n) is slower than O(n^2) for large n.',
      'Using Master Theorem when subproblem sizes are unequal like T(n-1) + n.'
    ],
    memoryAnchor: 'Compare f(n) against n^(log_b a): smaller -> leaves win, equal -> multiply by log n, larger -> root wins.'
  },
  {
    keys: ['stack', 'queue', 'linked', 'list', 'pointer'],
    overview: 'Linear structures organize elements sequentially using contiguous arrays or pointer-linked nodes with O(1) ends access.',
    coreConcepts: [
      'Stacks follow LIFO (Last-In, First-Out) with push, pop, and peek in O(1).',
      'Queues follow FIFO (First-In, First-Out) using circular array indices or front/rear pointers.',
      'Singly linked lists insert at head in O(1) but require O(n) traversal for arbitrary index access.',
      'Doubly linked lists store prev and next pointers to support O(1) deletion given a node reference.',
      'Dummy sentinel nodes remove special-case checks for empty lists or head updates.'
    ],
    formulaSheet: [
      { label: 'Circular Queue Next Index', expression: 'next = (index + 1) % capacity', note: 'Wraps around fixed array' },
      { label: 'Circular Queue Size', expression: 'size = (rear - front + capacity) % capacity', note: 'Works with 1 empty slot' },
      { label: 'Linked List Head Insert', expression: 'newNode.next = head; head = newNode;', note: 'O(1) time and O(1) space' },
      { label: 'Two-Pointer Midpoint', expression: 'slow = slow.next; fast = fast.next.next;', note: 'Finds middle in one pass' }
    ],
    examPitfalls: [
      'Losing the rest of a linked list by overwriting node.next before saving it.',
      'Forgetting null checks on head, tail, or fast.next in two-pointer loops.',
      'Popping an empty stack or dequeuing an empty queue without an underflow check.'
    ],
    memoryAnchor: 'Stacks = plate pile (LIFO); Queues = ticket line (FIFO); Linked lists = save next before rewiring.'
  },
  {
    keys: ['bst', 'avl', 'heap', 'tree', 'rotation'],
    overview: 'Trees store hierarchical keys for fast search, balanced height guarantees, and priority-ordered extraction.',
    coreConcepts: [
      'In a BST, every left descendant is smaller and every right descendant is larger than the node.',
      'Inorder traversal of a BST always visits keys in sorted ascending order.',
      'AVL trees maintain balance factor (height(left) - height(right)) within -1, 0, +1 using rotations.',
      'Single LL/RR rotations fix straight imbalances; LR/RL double rotations fix zig-zag imbalances.',
      'Binary min-heaps keep the smallest key at the root with O(log n) insert/extract and O(n) buildHeap.'
    ],
    formulaSheet: [
      { label: 'Array Heap Children', expression: 'left = 2*i + 1, right = 2*i + 2', note: '0-based array indexing' },
      { label: 'Array Heap Parent', expression: 'parent = Math.floor((i - 1) / 2)', note: 'For i > 0' },
      { label: 'AVL Balance Factor', expression: 'BF(node) = height(left) - height(right)', note: 'Valid range: -1, 0, +1' },
      { label: 'Build Heap Complexity', expression: 'Bottom-up heapify => O(n)', note: 'Tighter than n log n' }
    ],
    examPitfalls: [
      'Confusing bottom-up buildHeap O(n) with n separate insertions O(n log n).',
      'Deleting a 2-child BST node without replacing it with its inorder successor or predecessor.',
      'Applying a single rotation instead of LR/RL double rotation on a zig-zag insertion.'
    ],
    memoryAnchor: 'BST = sorted inorder; AVL = |BF| <= 1; Heap = parent beats children, build bottom-up in O(n).'
  },
  {
    keys: ['bfs', 'dfs', 'dijkstra', 'kruskal', 'graph', 'shortest', 'mst'],
    overview: 'Graph algorithms explore vertices, find shortest paths, and build minimum-cost spanning trees across networks.',
    coreConcepts: [
      'BFS uses a queue to visit vertices level by level and finds shortest unweighted paths in O(V + E).',
      'DFS uses recursion or a stack to explore deep paths and detects cycles and topological order.',
      'Dijkstra greedily relaxes outgoing edges with a min-priority queue for non-negative edge weights.',
      'Kruskal sorts edges by weight and adds edges using Disjoint Set (Union-Find) if they do not form a cycle.',
      'A Minimum Spanning Tree on V connected vertices always contains exactly V - 1 edges.'
    ],
    formulaSheet: [
      { label: 'BFS / DFS Runtime', expression: 'O(V + E)', note: 'Using adjacency lists' },
      { label: 'Dijkstra (Binary Heap)', expression: 'O((V + E) log V)', note: 'Requires weights >= 0' },
      { label: 'Kruskal MST Runtime', expression: 'O(E log E)', note: 'Dominated by edge sorting' },
      { label: 'Edge Relaxation', expression: 'if (dist[u] + w < dist[v]) dist[v] = dist[u] + w;', note: 'Core shortest-path step' }
    ],
    examPitfalls: [
      'Running Dijkstra on graphs with negative edge weights (use Bellman-Ford instead).',
      'Forgetting to mark visited before pushing to the BFS queue, causing duplicate pushes.',
      'Including an edge in Kruskal MST that connects two vertices already in the same component.'
    ],
    memoryAnchor: 'BFS = Queue + unweighted shortest; DFS = Stack + cycles; Dijkstra = >= 0 weights; Kruskal = sort + Union-Find.'
  },
  {
    keys: ['quantifier', 'proof', 'logic', 'induction', 'relation', 'pigeonhole', 'inclusion', 'discrete'],
    overview: 'Discrete proof tools formalize universal claims, equivalence partitions, inductive steps, and counting bounds.',
    coreConcepts: [
      'To disprove a universal statement (for all x, P(x)), one concrete counterexample suffices.',
      'Contrapositive proof shows (not Q => not P), which is logically equivalent to (P => Q).',
      'Equivalence relations are reflexive, symmetric, and transitive, partitioning a set into disjoint classes.',
      'Strong induction assumes P(k) holds for all k <= n to prove P(n + 1).',
      'Pigeonhole Principle guarantees at least one box holds >= ceil(N / K) items when placing N items into K boxes.'
    ],
    formulaSheet: [
      { label: 'De Morgan Quantifiers', expression: '!(forall x P(x)) <=> exists x !P(x)', note: 'Flip quantifier and negate' },
      { label: 'Inclusion-Exclusion (2 Sets)', expression: '|A U B| = |A| + |B| - |A & B|', note: 'Subtract overlap once' },
      { label: 'Pigeonhole Bound', expression: 'Max box >= Math.ceil(N / K)', note: 'N items into K boxes' },
      { label: 'Geometric Sum', expression: '1 + r + ... + r^n = (r^(n+1) - 1) / (r - 1)', note: 'r != 1' }
    ],
    examPitfalls: [
      'Skipping the base case check when writing an induction proof.',
      'Confusing converse (Q => P) with contrapositive (not Q => not P).',
      'Forgetting transitivity verification when testing whether a relation is an equivalence relation.'
    ],
    memoryAnchor: 'Equivalence = R-S-T; Induction = Base + Leap; Contrapositive flips and negates both sides.'
  }
];

var QUIZ_BANK = [
  {
    tags: ['big-o', 'recurrence', 'master', 'asymptotic', 'complexity'],
    prompt: 'What is the time complexity of T(n) = 2T(n/2) + n using the Master Theorem?',
    options: ['O(n)', 'O(n log n)', 'O(n^2)', 'O(log n)'],
    correctIndex: 1,
    explanation: 'Here a = 2, b = 2, so n^(log_2 2) = n, matching f(n) = n (Case 2), giving Theta(n log n).'
  },
  {
    tags: ['big-o', 'recurrence', 'master', 'asymptotic', 'complexity'],
    prompt: 'Which growth rate increases fastest as n becomes very large?',
    options: ['O(n log n)', 'O(n^2)', 'O(2^n)', 'O(n^3)'],
    correctIndex: 2,
    explanation: 'Exponential growth 2^n eventually outgrows every polynomial n^k.'
  },
  {
    tags: ['big-o', 'recurrence', 'master', 'asymptotic', 'complexity'],
    prompt: 'Binary search on a sorted array of size n has which worst-case time complexity?',
    options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
    correctIndex: 1,
    explanation: 'Each comparison halves the remaining search interval, matching T(n) = T(n/2) + O(1).'
  },
  {
    tags: ['stack', 'queue', 'linked', 'list', 'pointer'],
    prompt: 'In a circular array queue of length capacity, how do you advance an index by one position?',
    options: ['index = index + 1', 'index = (index + 1) % capacity', 'index = index % (capacity - 1)', 'index = capacity - index'],
    correctIndex: 1,
    explanation: 'Taking modulo capacity wraps the index back to 0 when it reaches the end of the array.'
  },
  {
    tags: ['stack', 'queue', 'linked', 'list', 'pointer'],
    prompt: 'What is the time complexity to insert a new node at the head of a singly linked list?',
    options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
    correctIndex: 0,
    explanation: 'Pointing newNode.next to head and updating head takes constant work regardless of list length.'
  },
  {
    tags: ['stack', 'queue', 'linked', 'list', 'pointer'],
    prompt: 'Which data structure processes elements in Last-In, First-Out (LIFO) order?',
    options: ['Queue', 'Stack', 'Min-Heap', 'Hash Table'],
    correctIndex: 1,
    explanation: 'A stack pushes and pops from the same top end, following LIFO.'
  },
  {
    tags: ['bst', 'avl', 'heap', 'tree', 'rotation'],
    prompt: 'Which traversal of a Binary Search Tree visits all keys in sorted ascending order?',
    options: ['Preorder', 'Inorder', 'Postorder', 'Level-order'],
    correctIndex: 1,
    explanation: 'Inorder visits Left -> Root -> Right, matching the BST ordering property.'
  },
  {
    tags: ['bst', 'avl', 'heap', 'tree', 'rotation'],
    prompt: 'In an array-backed 0-indexed binary heap, what is the left child index of node i?',
    options: ['i + 1', '2 * i', '2 * i + 1', '2 * i + 2'],
    correctIndex: 2,
    explanation: 'With root at index 0, node i has children at 2*i + 1 and 2*i + 2.'
  },
  {
    tags: ['bst', 'avl', 'heap', 'tree', 'rotation'],
    prompt: 'What is the allowed range of balance factors (height(left) - height(right)) in an AVL tree?',
    options: ['0 only', '-1, 0, or +1', '-2 to +2', 'Any positive integer'],
    correctIndex: 1,
    explanation: 'AVL trees trigger single or double rotations whenever |balance factor| exceeds 1.'
  },
  {
    tags: ['bfs', 'dfs', 'dijkstra', 'kruskal', 'graph', 'shortest', 'mst'],
    prompt: 'Which algorithm finds shortest paths from a single source in an unweighted graph?',
    options: ['Depth-First Search', 'Breadth-First Search', 'Kruskal Algorithm', 'Topological Sort'],
    correctIndex: 1,
    explanation: 'BFS visits vertices in increasing order of edge distance from the start vertex.'
  },
  {
    tags: ['bfs', 'dfs', 'dijkstra', 'kruskal', 'graph', 'shortest', 'mst'],
    prompt: 'How many edges does a Minimum Spanning Tree of a connected graph with V vertices contain?',
    options: ['V', 'V - 1', 'V + 1', 'E - V'],
    correctIndex: 1,
    explanation: 'Any tree spanning V vertices connects all nodes with no cycles using exactly V - 1 edges.'
  },
  {
    tags: ['bfs', 'dfs', 'dijkstra', 'kruskal', 'graph', 'shortest', 'mst'],
    prompt: 'Dijkstra shortest-path algorithm can produce wrong answers if the graph contains:',
    options: ['Cycles', 'Disconnected nodes', 'Negative edge weights', 'Self-loops of weight 0'],
    correctIndex: 2,
    explanation: 'Dijkstra assumes finalized distances cannot decrease later, which fails with negative weights.'
  },
  {
    tags: ['quantifier', 'proof', 'logic', 'induction', 'relation', 'pigeonhole', 'inclusion', 'discrete'],
    prompt: 'Which three properties define an equivalence relation on a set?',
    options: ['Reflexive, antisymmetric, transitive', 'Reflexive, symmetric, transitive', 'Symmetric, injective, surjective', 'Total, transitive, irreflexive'],
    correctIndex: 1,
    explanation: 'Equivalence relations are reflexive, symmetric, and transitive.'
  },
  {
    tags: ['quantifier', 'proof', 'logic', 'induction', 'relation', 'pigeonhole', 'inclusion', 'discrete'],
    prompt: 'If 25 students are placed into 4 tutorial groups, at least one group must have at least:',
    options: ['5 students', '6 students', '7 students', '8 students'],
    correctIndex: 2,
    explanation: 'By the Pigeonhole Principle, ceil(25 / 4) = 7.'
  },
  {
    tags: ['quantifier', 'proof', 'logic', 'induction', 'relation', 'pigeonhole', 'inclusion', 'discrete'],
    prompt: 'What is the logical contrapositive of the implication "If P, then Q"?',
    options: ['If Q, then P', 'If not P, then not Q', 'If not Q, then not P', 'P and not Q'],
    correctIndex: 2,
    explanation: 'Contrapositive negates and swaps both parts: (!Q => !P), equivalent to (P => Q).'
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
var attachedFileName = '';

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

// 3. Offline Generators (100% Pure JavaScript)
function cleanTopicLabel(rawLine) {
  var line = trimText(rawLine);
  line = line.replace(/^(unit|module|mod|chapter|ch|week|topic)\s*\d*\s*[:.-]\s*/i, '');
  line = line.replace(/^(\d+[.)]|[-*])\s*/, '');
  line = trimText(line);
  if (line.length > 64) {
    line = trimText(line.substring(0, 64));
  }
  return line;
}

function buildPlanFromSyllabus(title, examDate, hours, syllabusText) {
  var rawLines = String(syllabusText || '').split('\n');
  var topics = [];
  for (var i = 0; i < rawLines.length; i += 1) {
    var cleaned = cleanTopicLabel(rawLines[i]);
    if (cleaned.length >= 2) {
      topics.push(cleaned);
    }
  }

  if (topics.length === 1 && topics[0].indexOf(';') !== -1) {
    var splitSemi = topics[0].split(';');
    topics = [];
    for (var s = 0; s < splitSemi.length; s += 1) {
      var piece = cleanTopicLabel(splitSemi[s]);
      if (piece.length >= 2) {
        topics.push(piece);
      }
    }
  }

  if (topics.length === 0) {
    topics.push(title + ' Core Concepts');
    topics.push(title + ' Problem Practice');
  }
  if (topics.length > 14) {
    topics = topics.slice(0, 14);
  }

  var daysLeft = Math.max(getDaysLeft(examDate), 1);
  var minsPerBlock = hours >= 4 ? 60 : (hours >= 2 ? 45 : 30);
  var generatedTasks = [];

  for (var t = 0; t < topics.length; t += 1) {
    var dayOffset = Math.floor((t * daysLeft) / Math.max(topics.length, 1));
    if (dayOffset >= daysLeft) {
      dayOffset = daysLeft - 1;
    }
    generatedTasks.push({
      topicTitle: topics[t],
      description: 'Review key concepts, trace examples, and solve practice problems for ' + topics[t] + '.',
      scheduledDate: plusDays(dayOffset),
      durationMinutes: minsPerBlock,
      priority: t < 2 ? 'high' : 'medium'
    });
  }

  generatedTasks.push({
    topicTitle: 'Timed Full Mock Review',
    description: 'Attempt a mixed timed practice quiz across all ' + topics.length + ' topics and review mistakes.',
    scheduledDate: plusDays(Math.max(daysLeft - 1, 0)),
    durationMinutes: 60,
    priority: 'high'
  });

  var overview = topics.length + ' syllabus topics scheduled over ' + daysLeft + ' day(s) at ' + hours + 'h/day: ' + topics.slice(0, 4).join('; ') + '.';
  return {
    syllabusOverview: overview,
    topics: topics,
    tasks: generatedTasks
  };
}

function findBankSheet(topicTitle) {
  var lower = String(topicTitle || '').toLowerCase();
  for (var i = 0; i < SHEET_BANK.length; i += 1) {
    var keys = SHEET_BANK[i].keys;
    for (var k = 0; k < keys.length; k += 1) {
      if (lower.indexOf(keys[k]) !== -1) {
        return SHEET_BANK[i];
      }
    }
  }
  return null;
}

function buildSummaryOffline(subjectTitle, topicTitle) {
  var match = findBankSheet(topicTitle);
  if (match) {
    return match;
  }
  return {
    overview: 'Focused revision sheet for ' + topicTitle + ' in ' + subjectTitle + '.',
    coreConcepts: [
      'State the core definition and purpose of ' + topicTitle + ' in your own words.',
      'List the main rules, steps, or invariants required to solve ' + topicTitle + ' problems.',
      'Trace one small concrete example from start to finish by hand.',
      'Check boundary cases (empty input, size 1, maximum limits, or zero values).',
      'Compare time, space, or logical trade-offs against alternative methods.'
    ],
    formulaSheet: [
      { label: 'Step 1: Identify Inputs', expression: 'Input -> Constraint -> Target Output', note: 'Write given bounds first' },
      { label: 'Step 2: Verify Edge Cases', expression: 'n = 0, n = 1, sorted / reverse / empty', note: 'Common exam test cases' }
    ],
    examPitfalls: [
      'Jumping into calculations before verifying assumptions and preconditions.',
      'Forgetting base cases, off-by-one indices, or unit conversions.',
      'Skipping a quick sanity check on a tiny example.'
    ],
    memoryAnchor: 'Define it -> Trace n=3 by hand -> Check n=0/1 edge cases -> Verify final result.'
  };
}

function hasAnyTag(tags, textLower) {
  for (var i = 0; i < tags.length; i += 1) {
    if (textLower.indexOf(tags[i]) !== -1) {
      return true;
    }
  }
  return false;
}

function buildQuizOffline(sub, topicTitle, difficulty, count, weakTopics) {
  var chosen = [];
  var usedPrompts = [];
  var targetLower = String(topicTitle || '').toLowerCase();
  var weakLower = isList(weakTopics) ? weakTopics.join(' ').toLowerCase() : '';

  for (var i = 0; i < QUIZ_BANK.length && chosen.length < count; i += 1) {
    var q = QUIZ_BANK[i];
    if ((weakLower && hasAnyTag(q.tags, weakLower)) || hasAnyTag(q.tags, targetLower)) {
      chosen.push(q);
      usedPrompts.push(q.prompt);
    }
  }

  if (topicTitle === 'Comprehensive Mock' || chosen.length < count) {
    var subjLower = (sub.title + ' ' + sub.topics.join(' ')).toLowerCase();
    for (var j = 0; j < QUIZ_BANK.length && chosen.length < count; j += 1) {
      var q2 = QUIZ_BANK[j];
      if (usedPrompts.indexOf(q2.prompt) === -1 && hasAnyTag(q2.tags, subjLower)) {
        chosen.push(q2);
        usedPrompts.push(q2.prompt);
      }
    }
  }

  var topicPool = sub.topics.length > 0 ? sub.topics : [topicTitle];
  var drillTemplates = [
    {
      stem: 'Which study check best verifies mastery of ',
      opts: [
        'Tracing a step-by-step example and testing edge cases by hand',
        'Memorizing only the heading without solving any problems',
        'Skipping boundary conditions like empty or single-item inputs',
        'Assuming every case runs in constant O(1) time'
      ],
      ans: 0,
      why: 'Hand-tracing examples and testing edge cases confirms real understanding of '
    },
    {
      stem: 'When solving an exam question on ',
      opts: [
        'Ignore constraints and guess the final number',
        'Check preconditions, base cases, and problem constraints first',
        'Avoid writing intermediate steps',
        'Test only the average case and skip edge inputs'
      ],
      ans: 1,
      why: 'Checking preconditions and base cases prevents common errors in '
    },
    {
      stem: 'Which mistake most frequently causes lost marks in ',
      opts: [
        'Writing clean labeled steps',
        'Double-checking off-by-one bounds',
        'Missing base cases, preconditions, or off-by-one errors',
        'Verifying the answer on a small sample'
      ],
      ans: 2,
      why: 'Boundary and precondition errors are the top source of lost marks in '
    },
    {
      stem: 'If your first attempt at a problem on ',
      opts: [
        'Leave it blank without reviewing',
        'Copy an unrelated formula',
        'Skip straight to a harder chapter',
        'Test a small concrete input (n = 2 or n = 3) to isolate where it diverges'
      ],
      ans: 3,
      why: 'Testing a small input quickly reveals where logic diverges in '
    }
  ];

  var extraIdx = 0;
  while (chosen.length < count) {
    var focusTopic = (topicTitle !== 'Comprehensive Mock' && extraIdx < drillTemplates.length)
      ? topicTitle
      : topicPool[extraIdx % topicPool.length];
    var tpl = drillTemplates[extraIdx % drillTemplates.length];
    var levelTag = difficulty === 'intensive' ? ' [Intensive #' + (extraIdx + 1) + ']' : ' [Check #' + (extraIdx + 1) + ']';
    var promptText = tpl.stem + focusTopic + '?' + levelTag;

    chosen.push({
      prompt: promptText,
      options: tpl.opts.slice(0),
      correctIndex: tpl.ans,
      explanation: tpl.why + focusTopic + '.'
    });
    extraIdx += 1;
  }

  return chosen;
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

// 7. Modal & Offline Feature Actions
function clearAttachedFile() {
  attachedFileName = '';
  getEl('syllabus-file-input').value = '';
  getEl('uploaded-file-name').innerHTML = 'No file attached (TXT, MD, CSV, PDF, PNG, JPG)';
  showEl('clear-file-btn', false);
}

function openModal(show) {
  showEl('add-subject-modal', show);
  if (show) {
    getEl('new-subject-date').value = plusDays(6);
    getEl('new-subject-title').focus();
    showBanner('modal-error', '');
    showBanner('modal-status', '');
  } else {
    getEl('add-subject-form').reset();
    clearAttachedFile();
  }
}

function runSummary(topic) {
  var sub = getCurrentSubject();
  if (!sub || !topic) {
    showBanner('summary-error', 'Select or type a topic first.');
    return;
  }
  showBanner('summary-error', '');
  var sheet = buildSummaryOffline(sub.title, topic);
  saveSummary(sub.id, topic, sheet);
}

function runQuiz(topic, weakTopics) {
  var sub = getCurrentSubject();
  var difficulty = getSelectValue('quiz-difficulty-select');
  var count = Number(getSelectValue('quiz-count-select')) || 5;
  if (!sub || !topic) {
    showBanner('quiz-error', 'Select a topic first.');
    return;
  }
  showBanner('quiz-error', '');
  var questions = buildQuizOffline(sub, topic, difficulty, count, weakTopics || []);
  saveQuiz(sub.id, topic, difficulty, questions);
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

  getEl('clear-file-btn').onclick = function () {
    clearAttachedFile();
    showBanner('modal-status', '');
  };

  getEl('syllabus-file-input').onchange = function () {
    var file = this.files && this.files[0] ? this.files[0] : null;
    if (!file) {
      return;
    }
    showBanner('modal-error', '');
    showBanner('modal-status', '');
    if (file.size > 10 * 1024 * 1024) {
      clearAttachedFile();
      showBanner('modal-error', 'File exceeds 10 MB.');
      return;
    }

    attachedFileName = file.name;
    getEl('uploaded-file-name').innerHTML = escapeHtml(file.name);
    showEl('clear-file-btn', true);

    if (file.type.indexOf('text/') === 0 || /\.(txt|md|csv)$/i.test(file.name)) {
      var reader = new FileReader();
      reader.onload = function () {
        getEl('new-subject-syllabus').value = String(reader.result || '').substring(0, 20000);
        showBanner('modal-status', 'Loaded syllabus text from ' + file.name + '.');
      };
      reader.readAsText(file);
    } else {
      showBanner('modal-status', 'Attached ' + file.name + '. Paste topic lines above or build directly.');
    }
  };

  getEl('add-subject-form').onsubmit = function () {
    var title = trimText(getEl('new-subject-title').value);
    var examDate = getEl('new-subject-date').value;
    var hours = Number(getEl('new-subject-hours').value) || 3;
    var syllabusText = trimText(getEl('new-subject-syllabus').value);

    showBanner('modal-error', '');
    if (!title || !examDate || (!syllabusText && !attachedFileName)) {
      showBanner('modal-error', 'Enter subject name, exam date, and syllabus units or attach a file.');
      return false;
    }

    var sourceText = syllabusText || attachedFileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
    var parsed = buildPlanFromSyllabus(title, examDate, hours, sourceText);
    if (attachedFileName) {
      parsed.syllabusOverview = parsed.syllabusOverview + ' Attached file: ' + attachedFileName;
    }
    createSubject(title, examDate, hours, parsed);
    openModal(false);
    return false;
  };
}

loadState();
bindStaticEvents();
renderWorkspace();
