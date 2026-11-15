import express, { type Request, type Response } from 'express';
import path from 'node:path';
import dotenv from 'dotenv';
import { GoogleGenAI, Type, ThinkingLevel, type ContentListUnion } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();
const PORT = Number(process.env.PORT || 3000);
const MODEL = 'gemini-4-hydrogen';

// Compact schema helpers for structured Gemini JSON output
const S = { type: Type.STRING };
const I = { type: Type.INTEGER };
const arr = (items: Record<string, unknown>) => ({ type: Type.ARRAY, items });
const obj = (properties: Record<string, unknown>) => ({ type: Type.OBJECT, properties, required: Object.keys(properties) });

function getAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is missing.');
  return new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });
}

// Call Gemini with JSON schema + exponential backoff on transient rate/503 errors
async function askGemini(contents: ContentListUnion, schema: Record<string, unknown>) {
  const ai = getAI();
  for (let i = 0; i < 3; i++) {
    try {
      const res = await ai.models.generateContent({
        model: MODEL,
        contents,
        config: { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }, responseMimeType: 'application/json', responseSchema: schema },
      });
      return JSON.parse((res.text ?? '{}').trim());
    } catch (err) {
      const msg = String(err instanceof Error ? err.message : err);
      if (i === 2 || !/429|503|UNAVAILABLE/.test(msg)) throw err;
      await new Promise((r) => setTimeout(r, 750 * 2 ** i));
    }
  }
}

// Shared Express wrapper that turns thrown errors into clean HTTP JSON responses
const postAi = (app: express.Express, url: string, fn: (req: Request, res: Response) => Promise<unknown>) =>
  app.post(url, async (req, res) => {
    try {
      const out = await fn(req, res);
      if (!res.headersSent) res.json(out);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const code = /API_KEY_INVALID|403/.test(msg) ? 403 : /429|RESOURCE_EXHAUSTED/.test(msg) ? 429 : 500;
      res.status(code).json({ error: msg || 'Request failed.' });
    }
  });

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

  // 1. Syllabus text or file (PDF/image) -> topics & dated study tasks
  postAi(app, '/api/ai/parse-syllabus', async (req, res) => {
    const { subjectTitle, examDate, currentDate, dailyHours, syllabusText, fileData } = req.body;
    if (!subjectTitle?.trim() || !examDate?.trim()) return res.status(400).json({ error: 'Subject and exam date required.' });
    if (!syllabusText?.trim() && !fileData?.base64) return res.status(400).json({ error: 'Paste syllabus text or upload a file.' });

    const text = [
      `Build an exam prep plan for "${subjectTitle.trim()}". Today: ${currentDate}. Exam: ${examDate}. Pace: ${dailyHours}h/day.`,
      `Return syllabusOverview (<=1000 chars), 5-14 topics, and 8-16 tasks (scheduledDate ${currentDate}..${examDate}, durationMinutes 20-120, priority high|medium|normal).`,
      syllabusText?.trim() ? `Syllabus:\n${syllabusText.trim().slice(0, 24000)}` : '',
    ].filter(Boolean).join('\n');

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
    if (fileData?.base64 && fileData?.mimeType) parts.push({ inlineData: { mimeType: fileData.mimeType, data: fileData.base64 } });
    parts.push({ text });

    return askGemini({ parts }, obj({
      syllabusOverview: S,
      topics: arr(S),
      tasks: arr(obj({ topicTitle: S, description: S, scheduledDate: S, durationMinutes: I, priority: S })),
    }));
  });

  // 2. Topic -> revision overview, formulas, exam pitfalls & memory hook
  postAi(app, '/api/ai/generate-summary', async (req, res) => {
    const { subjectTitle, topicTitle, syllabusContext } = req.body;
    if (!subjectTitle?.trim() || !topicTitle?.trim()) return res.status(400).json({ error: 'Subject and topic required.' });
    const prompt = `Create a concise exam sheet for "${topicTitle}" in "${subjectTitle}". ${syllabusContext ? `Context: ${syllabusContext.slice(0, 1500)}` : ''}\nInclude overview, 5-8 coreConcepts, 2-6 formulaSheet items, 3-5 examPitfalls, and 1 memoryAnchor.`;
    return askGemini(prompt, obj({
      overview: S,
      coreConcepts: arr(S),
      formulaSheet: arr(obj({ label: S, expression: S, note: S })),
      examPitfalls: arr(S),
      memoryAnchor: S,
    }));
  });

  // 3. Topic (+ optional missed areas) -> 4-option MCQs with explanations
  postAi(app, '/api/ai/generate-quiz', async (req, res) => {
    const { subjectTitle, topicTitle, difficulty, questionCount, syllabusContext, focusWeaknesses } = req.body;
    if (!subjectTitle?.trim() || !topicTitle?.trim()) return res.status(400).json({ error: 'Subject and topic required.' });
    const n = Math.min(Math.max(Number(questionCount) || 5, 3), 15);
    const prompt = `Generate ${n} ${difficulty === 'intensive' ? 'challenging' : 'exam-style'} 4-option MCQs for "${topicTitle}" in "${subjectTitle}". ${syllabusContext ? `Context: ${syllabusContext.slice(0, 1500)}` : ''} ${focusWeaknesses?.length ? `Focus missed areas: ${focusWeaknesses.join('; ').slice(0, 600)}` : ''}`;
    return askGemini(prompt, obj({
      questions: arr(obj({ prompt: S, options: arr(S), correctIndex: I, explanation: S })),
    }));
  });

  // Serve Vite in dev, compiled dist/ in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const dist = path.resolve(import.meta.dirname, 'dist');
    app.use(express.static(dist));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => console.log(`Taau Ai server running on http://localhost:${PORT}`));
}

startServer().catch((err) => { console.error(err); process.exit(1); });
