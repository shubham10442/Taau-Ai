import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
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
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export const OperationType = Object.freeze({
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
});

export function handleFirestoreError(error, operationType, path) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();

export function clampText(value, maxLength, fallback = '') {
  const cleaned = String(value ?? '').trim();
  if (!cleaned) return fallback;
  return cleaned.length > maxLength ? cleaned.slice(0, maxLength) : cleaned;
}

export function clampInt(value, min, max) {
  const num = Math.round(Number(value) || 0);
  return Math.min(Math.max(num, min), max);
}

export function clampFloat(value, min, max) {
  const num = Number(value);
  if (Number.isNaN(num)) return min;
  return Math.min(Math.max(num, min), max);
}

export function generateValidId(prefix) {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export function signOutUser() {
  return signOut(auth);
}

export async function ensureUserProfile(user) {
  const path = `users/${user.uid}`;
  try {
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        displayName: clampText(user.displayName || 'Student', 120, 'Student'),
        email: clampText(user.email || 'student@example.com', 200, 'student@example.com'),
        dailyStudyHours: 3,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeSubjects(userId, onData, onError) {
  const q = query(collection(db, 'subjects'), where('userId', '==', userId));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          userId: String(data.userId ?? userId),
          title: String(data.title ?? ''),
          examDate: String(data.examDate ?? ''),
          dailyHours: Number(data.dailyHours ?? 2),
          syllabusOverview: String(data.syllabusOverview ?? ''),
          topics: Array.isArray(data.topics) ? data.topics.map(String) : [],
          totalTasks: Number(data.totalTasks ?? 0),
          completedTasks: Number(data.completedTasks ?? 0),
          averageQuizScore: Number(data.averageQuizScore ?? -1),
        };
      });
      items.sort((a, b) => a.examDate.localeCompare(b.examDate));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'subjects');
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    },
  );
}

export function subscribeSubjectTasks(userId, subjectId, onData, onError) {
  const q = query(
    collection(db, 'studyTasks'),
    where('userId', '==', userId),
    where('subjectId', '==', subjectId),
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          userId: String(data.userId ?? userId),
          subjectId: String(data.subjectId ?? subjectId),
          topicTitle: String(data.topicTitle ?? ''),
          description: String(data.description ?? ''),
          scheduledDate: String(data.scheduledDate ?? ''),
          durationMinutes: Number(data.durationMinutes ?? 30),
          priority: data.priority || 'medium',
          status: data.status || 'pending',
          orderIndex: Number(data.orderIndex ?? 0),
        };
      });
      items.sort((a, b) => {
        const dateCmp = a.scheduledDate.localeCompare(b.scheduledDate);
        return dateCmp !== 0 ? dateCmp : a.orderIndex - b.orderIndex;
      });
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'studyTasks');
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    },
  );
}

export function subscribeSubjectSummaries(userId, subjectId, onData, onError) {
  const q = query(
    collection(db, 'studySummaries'),
    where('userId', '==', userId),
    where('subjectId', '==', subjectId),
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          userId: String(data.userId ?? userId),
          subjectId: String(data.subjectId ?? subjectId),
          topicTitle: String(data.topicTitle ?? ''),
          overview: String(data.overview ?? ''),
          coreConcepts: Array.isArray(data.coreConcepts) ? data.coreConcepts.map(String) : [],
          formulaSheet: Array.isArray(data.formulaSheet) ? data.formulaSheet : [],
          examPitfalls: Array.isArray(data.examPitfalls) ? data.examPitfalls.map(String) : [],
          memoryAnchor: String(data.memoryAnchor ?? ''),
        };
      });
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'studySummaries');
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    },
  );
}

export function subscribeSubjectQuizzes(userId, subjectId, onData, onError) {
  const q = query(
    collection(db, 'quizzes'),
    where('userId', '==', userId),
    where('subjectId', '==', subjectId),
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          userId: String(data.userId ?? userId),
          subjectId: String(data.subjectId ?? subjectId),
          topicTitle: String(data.topicTitle ?? ''),
          difficulty: data.difficulty || 'standard',
          questions: Array.isArray(data.questions) ? data.questions : [],
          userAnswers: Array.isArray(data.userAnswers) ? data.userAnswers.map(Number) : [],
          scorePercent: Number(data.scorePercent ?? -1),
          status: data.status || 'in_progress',
        };
      });
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'quizzes');
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    },
  );
}

export function subscribeSubjectFlashcards(userId, subjectId, onData, onError) {
  const q = query(
    collection(db, 'flashcards'),
    where('userId', '==', userId),
    where('subjectId', '==', subjectId),
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          userId: String(data.userId ?? userId),
          subjectId: String(data.subjectId ?? subjectId),
          topicTitle: String(data.topicTitle ?? ''),
          front: String(data.front ?? ''),
          back: String(data.back ?? ''),
          hint: String(data.hint ?? ''),
          boxLevel: Number(data.boxLevel ?? 1),
          masteryState: data.masteryState || 'new',
          nextReviewAt: Number(data.nextReviewAt ?? 0),
        };
      });
      items.sort((a, b) => a.nextReviewAt - b.nextReviewAt);
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'flashcards');
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    },
  );
}

export async function createSubjectWithTasks(userId, title, examDate, dailyHours, parsed) {
  const subjectId = generateValidId('sub');
  const sanitizedTopics = (parsed.topics || [])
    .slice(0, 35)
    .map((t) => clampText(t, 150, 'Core Topic'));
  const sanitizedTasks = (parsed.tasks || []).slice(0, 30);

  try {
    await setDoc(doc(db, 'subjects', subjectId), {
      userId,
      title: clampText(title, 120, 'Untitled Subject'),
      examDate: clampText(examDate, 40, new Date().toISOString().slice(0, 10)),
      dailyHours: clampFloat(dailyHours, 0.5, 16),
      syllabusOverview: clampText(
        parsed.syllabusOverview || 'Exam revision syllabus',
        1500,
        'Exam revision syllabus',
      ),
      topics: sanitizedTopics,
      totalTasks: sanitizedTasks.length,
      completedTasks: 0,
      averageQuizScore: -1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `subjects/${subjectId}`);
  }

  if (sanitizedTasks.length > 0) {
    try {
      const batch = writeBatch(db);
      sanitizedTasks.forEach((task, index) => {
        const taskId = generateValidId('tsk');
        const priority =
          task.priority === 'high' || task.priority === 'medium' || task.priority === 'normal'
            ? task.priority
            : 'medium';
        batch.set(doc(db, 'studyTasks', taskId), {
          userId,
          subjectId,
          topicTitle: clampText(task.topicTitle, 160, 'Revision Topic'),
          description: clampText(
            task.description,
            400,
            'Review core concepts and practice problems.',
          ),
          scheduledDate: clampText(task.scheduledDate, 40, examDate),
          durationMinutes: clampInt(task.durationMinutes, 10, 480),
          priority,
          status: 'pending',
          orderIndex: index,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'studyTasks');
    }
  }

  return subjectId;
}

export async function toggleStudyTask(task, allTasks, subjectId) {
  const nextStatus = task.status === 'completed' ? 'pending' : 'completed';
  try {
    await updateDoc(doc(db, 'studyTasks', task.id), {
      status: nextStatus,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `studyTasks/${task.id}`);
  }

  const completedCount = allTasks.reduce((acc, item) => {
    if (item.id === task.id) return acc + (nextStatus === 'completed' ? 1 : 0);
    return acc + (item.status === 'completed' ? 1 : 0);
  }, 0);

  try {
    await updateDoc(doc(db, 'subjects', subjectId), {
      completedTasks: clampInt(completedCount, 0, 500),
      totalTasks: clampInt(allTasks.length, 0, 500),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `subjects/${subjectId}`);
  }
}

export async function addCustomStudyTask(userId, subjectId, payload, currentTotalTasks) {
  const taskId = generateValidId('tsk');
  try {
    await setDoc(doc(db, 'studyTasks', taskId), {
      userId,
      subjectId,
      topicTitle: clampText(payload.topicTitle, 160, 'Custom Revision'),
      description: clampText(payload.description, 400, 'Complete focused revision session.'),
      scheduledDate: clampText(payload.scheduledDate, 40, new Date().toISOString().slice(0, 10)),
      durationMinutes: clampInt(payload.durationMinutes, 10, 480),
      priority: payload.priority,
      status: 'pending',
      orderIndex: clampInt(currentTotalTasks, 0, 500),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'subjects', subjectId), {
      totalTasks: clampInt(currentTotalTasks + 1, 0, 500),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `studyTasks/${taskId}`);
  }
}

export async function saveStudySummary(userId, subjectId, topicTitle, generated) {
  const summaryId = generateValidId('sum');
  try {
    await setDoc(doc(db, 'studySummaries', summaryId), {
      userId,
      subjectId,
      topicTitle: clampText(topicTitle, 160, 'Topic Summary'),
      overview: clampText(generated.overview, 2000, 'Summary generated.'),
      coreConcepts: (generated.coreConcepts || [])
        .slice(0, 15)
        .map((c) => clampText(c, 500, 'Key point')),
      formulaSheet: (generated.formulaSheet || []).slice(0, 15).map((f) => ({
        label: clampText(f.label, 160, 'Rule'),
        expression: clampText(f.expression, 300, '—'),
        note: clampText(f.note, 400, 'Apply directly'),
      })),
      examPitfalls: (generated.examPitfalls || [])
        .slice(0, 12)
        .map((p) => clampText(p, 400, 'Check edge cases')),
      memoryAnchor: clampText(generated.memoryAnchor, 600, ''),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return summaryId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `studySummaries/${summaryId}`);
  }
}

export async function createQuiz(userId, subjectId, topicTitle, difficulty, questions) {
  const quizId = generateValidId('quz');
  const sanitizedQuestions = (questions || []).slice(0, 15).map((q) => {
    const opts = (q.options || []).slice(0, 4).map((o) => clampText(o, 300, 'Option'));
    while (opts.length < 4) opts.push('None of the above');
    return {
      prompt: clampText(q.prompt, 600, 'Question'),
      options: opts,
      correctIndex: clampInt(q.correctIndex, 0, 3),
      explanation: clampText(q.explanation, 800, 'Review topic notes.'),
    };
  });

  try {
    await setDoc(doc(db, 'quizzes', quizId), {
      userId,
      subjectId,
      topicTitle: clampText(topicTitle, 160, 'Practice Quiz'),
      difficulty,
      questions: sanitizedQuestions,
      userAnswers: sanitizedQuestions.map(() => -1),
      scorePercent: -1,
      status: 'in_progress',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return quizId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `quizzes/${quizId}`);
  }
}

export async function submitQuizCompletion(quiz, userAnswers, allSubjectQuizzes) {
  const correctCount = quiz.questions.reduce((acc, q, i) => {
    return acc + (userAnswers[i] === q.correctIndex ? 1 : 0);
  }, 0);
  const scorePercent = Math.round((correctCount / Math.max(quiz.questions.length, 1)) * 100);
  const clampedAnswers = userAnswers.slice(0, 15).map((a) => clampInt(a, -1, 3));

  try {
    await updateDoc(doc(db, 'quizzes', quiz.id), {
      userAnswers: clampedAnswers,
      scorePercent: clampInt(scorePercent, 0, 100),
      status: 'completed',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `quizzes/${quiz.id}`);
  }

  const completedScores = allSubjectQuizzes
    .filter((item) => item.id !== quiz.id && item.status === 'completed' && item.scorePercent >= 0)
    .map((item) => item.scorePercent);
  completedScores.push(scorePercent);
  const averageQuizScore = Math.round(
    completedScores.reduce((sum, val) => sum + val, 0) / completedScores.length,
  );

  try {
    await updateDoc(doc(db, 'subjects', quiz.subjectId), {
      averageQuizScore: clampFloat(averageQuizScore, 0, 100),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `subjects/${quiz.subjectId}`);
  }

  return scorePercent;
}

export async function createFlashcardsBatch(userId, subjectId, topicTitle, cards) {
  try {
    const batch = writeBatch(db);
    const now = Date.now();
    (cards || []).slice(0, 12).forEach((c) => {
      const cardId = generateValidId('crd');
      batch.set(doc(db, 'flashcards', cardId), {
        userId,
        subjectId,
        topicTitle: clampText(topicTitle, 160, 'Topic'),
        front: clampText(c.front, 500, 'Concept prompt'),
        back: clampText(c.back, 1200, 'Explanation'),
        hint: clampText(c.hint, 300, ''),
        boxLevel: 1,
        masteryState: 'new',
        nextReviewAt: now,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'flashcards');
  }
}

export async function reviewFlashcardSpacedRepetition(card, rating) {
  const now = Date.now();
  let nextBox = card.boxLevel;
  let delayMs = 5 * 60 * 1000;

  if (rating === 'again') {
    nextBox = 1;
    delayMs = 5 * 60 * 1000;
  } else if (rating === 'hard') {
    nextBox = Math.max(1, card.boxLevel);
    delayMs = 8 * 3600 * 1000;
  } else if (rating === 'good') {
    nextBox = Math.min(5, card.boxLevel + 1);
    delayMs = Math.pow(2, nextBox - 1) * 24 * 3600 * 1000;
  } else {
    nextBox = Math.min(5, card.boxLevel + 2);
    delayMs = Math.pow(2, nextBox) * 24 * 3600 * 1000;
  }

  const masteryState = nextBox >= 4 ? 'mastered' : 'learning';

  try {
    await updateDoc(doc(db, 'flashcards', card.id), {
      boxLevel: clampInt(nextBox, 1, 5),
      masteryState,
      nextReviewAt: Math.round(now + delayMs),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `flashcards/${card.id}`);
  }
}

export async function deleteSubjectAndChildren(subjectId, tasks, summaries, quizzes, flashcards) {
  try {
    const deletions = [
      ...tasks.map((t) => deleteDoc(doc(db, 'studyTasks', t.id))),
      ...summaries.map((s) => deleteDoc(doc(db, 'studySummaries', s.id))),
      ...quizzes.map((q) => deleteDoc(doc(db, 'quizzes', q.id))),
      ...flashcards.map((f) => deleteDoc(doc(db, 'flashcards', f.id))),
    ];
    await Promise.all(deletions);
    await deleteDoc(doc(db, 'subjects', subjectId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `subjects/${subjectId}`);
  }
}
