import express from 'express';
import path from 'node:path';
import dotenv from 'dotenv';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const PORT = Number(process.env.PORT || 3000);
const MODEL_NAME = 'gemini-4-hydrogen';

function createGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is missing in environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: { 'User-Agent': 'aistudio-build' },
    },
  });
}

// Call Gemini with structured JSON output and retry briefly on rate/503 errors
async function callGeminiJson(contents, schema) {
  const ai = createGeminiClient();
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: schema,
        },
      });
      return JSON.parse((response.text ?? '{}').trim());
    } catch (error) {
      const message = String(error instanceof Error ? error.message : error);
      const isTransient = message.includes('429') || message.includes('503') || message.includes('UNAVAILABLE');
      if (!isTransient || attempt === 2) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 750 * Math.pow(2, attempt)));
    }
  }
}

function handleApiError(res, error) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('API_KEY_INVALID') || message.includes('403')) {
    return res.status(403).json({ error: 'Gemini API access denied. Check GEMINI_API_KEY.' });
  }
  if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED')) {
    return res.status(429).json({ error: 'AI rate limit reached. Please try again shortly.' });
  }
  return res.status(500).json({ error: message || 'Server request failed.' });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // 1. Parse pasted syllabus text or uploaded PDF/image into topics and dated milestones
  app.post('/api/ai/parse-syllabus', async (req, res) => {
    try {
      const { subjectTitle, examDate, currentDate, dailyHours, syllabusText, fileData } = req.body;
      if (!subjectTitle?.trim() || !examDate?.trim()) {
        return res.status(400).json({ error: 'Subject name and exam date are required.' });
      }
      if (!syllabusText?.trim() && !fileData?.base64) {
        return res.status(400).json({ error: 'Please paste syllabus text or upload a file.' });
      }

      const promptLines = [
        `Build an exam prep plan for "${subjectTitle.trim()}".`,
        `Today: ${currentDate}. Exam date: ${examDate}. Daily study hours: ${dailyHours}.`,
        'Return syllabusOverview (<=1000 chars), 5-14 topics, and 8-16 tasks.',
        `Each task must have topicTitle, description, scheduledDate (${currentDate} to ${examDate}), durationMinutes (20-120), and priority (high, medium, or normal).`,
      ];
      if (syllabusText?.trim()) {
        promptLines.push(`Syllabus:\n${syllabusText.trim().slice(0, 24000)}`);
      }

      const parts = [];
      if (fileData?.base64 && fileData?.mimeType) {
        parts.push({ inlineData: { mimeType: fileData.mimeType, data: fileData.base64 } });
      }
      parts.push({ text: promptLines.join('\n') });

      const result = await callGeminiJson({ parts }, {
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
      res.json(result);
    } catch (error) {
      handleApiError(res, error);
    }
  });

  // 2. Generate a concise study sheet with key formulas, exam pitfalls, and a memory hook
  app.post('/api/ai/generate-summary', async (req, res) => {
    try {
      const { subjectTitle, topicTitle, syllabusContext } = req.body;
      if (!subjectTitle?.trim() || !topicTitle?.trim()) {
        return res.status(400).json({ error: 'Subject and topic are required.' });
      }

      const contextNote = syllabusContext ? `Context: ${syllabusContext.slice(0, 1500)}` : '';
      const prompt = [
        `Create a concise exam revision sheet for "${topicTitle.trim()}" in "${subjectTitle.trim()}".`,
        contextNote,
        'Include overview, 5-8 coreConcepts, 2-6 formulaSheet items (label, expression, note), 3-5 examPitfalls, and 1 memoryAnchor.',
      ].filter(Boolean).join('\n');

      const result = await callGeminiJson(prompt, {
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
      res.json(result);
    } catch (error) {
      handleApiError(res, error);
    }
  });

  // 3. Generate a 4-option multiple-choice practice quiz with explanations
  app.post('/api/ai/generate-quiz', async (req, res) => {
    try {
      const { subjectTitle, topicTitle, difficulty, questionCount, syllabusContext, focusWeaknesses } = req.body;
      if (!subjectTitle?.trim() || !topicTitle?.trim()) {
        return res.status(400).json({ error: 'Subject and topic are required.' });
      }

      const count = Math.min(Math.max(Number(questionCount) || 5, 3), 15);
      const level = difficulty === 'intensive' ? 'challenging' : 'exam-style';
      const prompt = [
        `Generate ${count} ${level} 4-option MCQs for "${topicTitle.trim()}" in "${subjectTitle.trim()}".`,
        syllabusContext ? `Context: ${syllabusContext.slice(0, 1500)}` : '',
        focusWeaknesses?.length ? `Focus on missed areas: ${focusWeaknesses.join('; ').slice(0, 600)}` : '',
        'Each question needs prompt, 4 options, 0-based correctIndex (0-3), and a clear explanation.',
      ].filter(Boolean).join('\n');

      const result = await callGeminiJson(prompt, {
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
      res.json(result);
    } catch (error) {
      handleApiError(res, error);
    }
  });

  // Serve Vite in development or compiled dist/ files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(import.meta.dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Taau Ai server running on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
