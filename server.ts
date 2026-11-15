import express, { type Response } from 'express';
import path from 'node:path';
import dotenv from 'dotenv';
import { GoogleGenAI, Type, ThinkingLevel, type ContentListUnion } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const PORT = Number(process.env.PORT || 3000);
const MODEL = 'gemini-4-hydrogen';

// Create Gemini client using server-side secret key
function getAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is missing.');
  return new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });
}

// Call Gemini with structured JSON output and simple backoff for 429/503 errors
async function askGeminiJson(contents: ContentListUnion, schema: Record<string, unknown>) {
  const ai = getAI();
  for (let i = 0; i < 3; i++) {
    try {
      const res = await ai.models.generateContent({
        model: MODEL,
        contents,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: schema,
        },
      });
      return JSON.parse((res.text ?? '{}').trim());
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const retryable = msg.includes('429') || msg.includes('503') || msg.includes('UNAVAILABLE');
      if (!retryable || i === 2) throw err;
      await new Promise((r) => setTimeout(r, 750 * 2 ** i));
    }
  }
}

// Map server/Gemini errors into clear HTTP responses
function sendError(res: Response, err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('API_KEY_INVALID') || msg.includes('403')) {
    return res.status(403).json({ error: 'Gemini API access denied. Check GEMINI_API_KEY.' });
  }
  if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
    return res.status(429).json({ error: 'AI rate limit reached. Try again shortly.' });
  }
  return res.status(500).json({ error: msg || 'Request failed.' });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

  // 1. Parse syllabus text or uploaded PDF/image into topics and dated milestones
  app.post('/api/ai/parse-syllabus', async (req, res) => {
    try {
      const { subjectTitle, examDate, currentDate, dailyHours, syllabusText, fileData } = req.body;
      if (!subjectTitle?.trim() || !examDate?.trim()) {
        return res.status(400).json({ error: 'Subject name and exam date are required.' });
      }
      if (!syllabusText?.trim() && !fileData?.base64) {
        return res.status(400).json({ error: 'Paste syllabus text or upload a file.' });
      }

      const prompt = [
        `Build an exam prep plan for "${subjectTitle.trim()}".`,
        `Today: ${currentDate}. Exam: ${examDate}. Pace: ${dailyHours}h/day.`,
        `Return: syllabusOverview (<=1000 chars), 5-14 distinct topics (<=120 chars each), and 8-16 tasks.`,
        `Each task needs topicTitle, description (<=280 chars), scheduledDate (${currentDate}..${examDate}), durationMinutes (20-120), priority (high|medium|normal).`,
        syllabusText?.trim() ? `\nSyllabus:\n${syllabusText.trim().slice(0, 24000)}` : '',
      ].filter(Boolean).join('\n');

      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
      if (fileData?.base64 && fileData?.mimeType) {
        parts.push({ inlineData: { mimeType: fileData.mimeType, data: fileData.base64 } });
      }
      parts.push({ text: prompt });

      const data = await askGeminiJson({ parts }, {
        type: Type.OBJECT,
        properties: {
          syllabusOverview: { type: Type.STRING },
          topics: { type: Type.ARRAY, items: { type: Type.STRING } },
          tasks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                topicTitle: { type: Type.STRING },
                description: { type: Type.STRING },
                scheduledDate: { type: Type.STRING },
                durationMinutes: { type: Type.INTEGER },
                priority: { type: Type.STRING },
              },
              required: ['topicTitle', 'description', 'scheduledDate', 'durationMinutes', 'priority'],
            },
          },
        },
        required: ['syllabusOverview', 'topics', 'tasks'],
      });
      res.json(data);
    } catch (err) {
      sendError(res, err);
    }
  });

  // 2. Generate topic revision summary, formula sheet, pitfalls, and memory anchor
  app.post('/api/ai/generate-summary', async (req, res) => {
    try {
      const { subjectTitle, topicTitle, syllabusContext } = req.body;
      if (!subjectTitle?.trim() || !topicTitle?.trim()) {
        return res.status(400).json({ error: 'Subject and topic are required.' });
      }

      const prompt = [
        `Create a concise exam revision sheet for "${topicTitle.trim()}" in "${subjectTitle.trim()}".`,
        syllabusContext ? `Context: ${syllabusContext.slice(0, 1500)}` : '',
        `Include overview, 5-8 coreConcepts, 2-6 formulaSheet items ({label, expression, note}), 3-5 examPitfalls, and 1 memoryAnchor.`,
      ].filter(Boolean).join('\n');

      const data = await askGeminiJson(prompt, {
        type: Type.OBJECT,
        properties: {
          overview: { type: Type.STRING },
          coreConcepts: { type: Type.ARRAY, items: { type: Type.STRING } },
          formulaSheet: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING },
                expression: { type: Type.STRING },
                note: { type: Type.STRING },
              },
              required: ['label', 'expression', 'note'],
            },
          },
          examPitfalls: { type: Type.ARRAY, items: { type: Type.STRING } },
          memoryAnchor: { type: Type.STRING },
        },
        required: ['overview', 'coreConcepts', 'formulaSheet', 'examPitfalls', 'memoryAnchor'],
      });
      res.json(data);
    } catch (err) {
      sendError(res, err);
    }
  });

  // 3. Generate adaptive 4-option multiple-choice practice quiz with explanations
  app.post('/api/ai/generate-quiz', async (req, res) => {
    try {
      const { subjectTitle, topicTitle, difficulty, questionCount, syllabusContext, focusWeaknesses } = req.body;
      if (!subjectTitle?.trim() || !topicTitle?.trim()) {
        return res.status(400).json({ error: 'Subject and topic are required.' });
      }

      const count = Math.min(Math.max(Number(questionCount) || 5, 3), 15);
      const prompt = [
        `Generate ${count} ${difficulty === 'intensive' ? 'challenging' : 'exam-style'} 4-option MCQs for "${topicTitle.trim()}" in "${subjectTitle.trim()}".`,
        syllabusContext ? `Context: ${syllabusContext.slice(0, 1500)}` : '',
        focusWeaknesses?.length ? `Focus on missed areas: ${focusWeaknesses.join('; ').slice(0, 600)}` : '',
        `Each question needs prompt, 4 options, 0-based correctIndex (0..3), and step-by-step explanation.`,
      ].filter(Boolean).join('\n');

      const data = await askGeminiJson(prompt, {
        type: Type.OBJECT,
        properties: {
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                prompt: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctIndex: { type: Type.INTEGER },
                explanation: { type: Type.STRING },
              },
              required: ['prompt', 'options', 'correctIndex', 'explanation'],
            },
          },
        },
        required: ['questions'],
      });
      res.json(data);
    } catch (err) {
      sendError(res, err);
    }
  });

  // Serve Vite in development, built dist/ in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(import.meta.dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => console.log(`Taau Ai server running on http://localhost:${PORT}`));
}

startServer().catch((err) => {
  console.error('Server failed:', err);
  process.exit(1);
});
