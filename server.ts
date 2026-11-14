import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const MODEL_NAME = 'gemini-4-hydrogen';

function getGenAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function generateWithRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const msg = error instanceof Error ? error.message : String(error);
      const isTransient = msg.includes('429') || msg.includes('503') || msg.includes('UNAVAILABLE');
      if (!isTransient || attempt === maxRetries) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 750 * Math.pow(2, attempt)));
    }
  }
  throw lastError;
}

function formatApiError(error: unknown): { status: number; message: string } {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes('API_KEY_INVALID') || raw.includes('PERMISSION_DENIED') || raw.includes('403')) {
    return {
      status: 403,
      message: 'Gemini API access denied. Please verify your API key in Settings > Secrets.',
    };
  }
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('429')) {
    return {
      status: 429,
      message: 'AI rate limit reached. Please wait a moment and try again.',
    };
  }
  if (raw.includes('GEMINI_API_KEY is not configured')) {
    return {
      status: 500,
      message: 'Server AI key is not configured in Settings > Secrets.',
    };
  }
  return {
    status: 500,
    message: raw || 'Failed to generate study content. Please try again.',
  };
}

interface SyllabusFilePayload {
  mimeType: string;
  base64: string;
  fileName?: string;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/api/ai/parse-syllabus', async (req, res) => {
    try {
      const {
        subjectTitle,
        examDate,
        currentDate,
        dailyHours,
        syllabusText,
        fileData,
      } = req.body as {
        subjectTitle: string;
        examDate: string;
        currentDate: string;
        dailyHours: number;
        syllabusText?: string;
        fileData?: SyllabusFilePayload;
      };

      if (!subjectTitle?.trim() || !examDate?.trim()) {
        res.status(400).json({ error: 'Subject title and exam date are required.' });
        return;
      }
      if (!syllabusText?.trim() && !fileData?.base64) {
        res.status(400).json({ error: 'Please paste syllabus text or upload a syllabus file.' });
        return;
      }

      const ai = getGenAIClient();
      const prompt = [
        `You are Taau Ai, an expert academic exam-prep strategist.`,
        `Analyze the provided syllabus for "${subjectTitle.trim()}".`,
        `Today's date is ${currentDate}. The exam date is ${examDate}. The student can study ${dailyHours} hours per day.`,
        `1. Write a concise syllabusOverview (max 1000 characters) summarizing the core exam scope and highest-leverage focus areas.`,
        `2. Extract 5 to 14 concrete, distinct exam topics into "topics" (each concise, <= 120 characters).`,
        `3. Build a prioritized, deadline-aware study plan of 8 to 16 actionable revision milestones in "tasks".`,
        `   - Each task must have a scheduledDate (YYYY-MM-DD) between ${currentDate} and ${examDate} inclusive.`,
        `   - Front-load foundational or high-weight topics earlier and place active recall / mock review closer to ${examDate}.`,
        `   - durationMinutes should be between 20 and 120, aligned with ${dailyHours}h/day capacity.`,
        `   - priority must be one of "high", "medium", or "normal".`,
        `   - description must be a concrete revision action (max 280 chars).`,
        syllabusText?.trim() ? `\nPasted Syllabus Content:\n${syllabusText.trim().slice(0, 24000)}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
      if (fileData?.base64 && fileData?.mimeType) {
        parts.push({
          inlineData: {
            mimeType: fileData.mimeType,
            data: fileData.base64,
          },
        });
      }
      parts.push({ text: prompt });

      const response = await generateWithRetry(() =>
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: { parts },
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                syllabusOverview: { type: Type.STRING },
                topics: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
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
            },
          },
        }),
      );

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json(parsed);
    } catch (error) {
      const formatted = formatApiError(error);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/ai/generate-summary', async (req, res) => {
    try {
      const { subjectTitle, topicTitle, syllabusContext } = req.body as {
        subjectTitle: string;
        topicTitle: string;
        syllabusContext?: string;
      };

      if (!subjectTitle?.trim() || !topicTitle?.trim()) {
        res.status(400).json({ error: 'Subject title and topic title are required.' });
        return;
      }

      const ai = getGenAIClient();
      const prompt = [
        `Create a high-yield last-minute exam revision sheet for "${topicTitle.trim()}" in "${subjectTitle.trim()}".`,
        syllabusContext ? `Subject context: ${syllabusContext.slice(0, 1500)}` : '',
        `Return structured JSON with:`,
        `- overview: crisp synthesis of the topic (max 1500 chars)`,
        `- coreConcepts: 5 to 8 concise, exam-ready bullet explanations (each max 400 chars)`,
        `- formulaSheet: 2 to 6 key formulas, equations, theorems, or structured decision rules with { label, expression, note }`,
        `- examPitfalls: 3 to 5 common mistakes students lose marks on`,
        `- memoryAnchor: 1 memorable mnemonic or mental shortcut (max 450 chars)`,
      ]
        .filter(Boolean)
        .join('\n');

      const response = await generateWithRetry(() =>
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: prompt,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                overview: { type: Type.STRING },
                coreConcepts: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
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
                examPitfalls: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                memoryAnchor: { type: Type.STRING },
              },
              required: ['overview', 'coreConcepts', 'formulaSheet', 'examPitfalls', 'memoryAnchor'],
            },
          },
        }),
      );

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json(parsed);
    } catch (error) {
      const formatted = formatApiError(error);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/ai/generate-quiz', async (req, res) => {
    try {
      const { subjectTitle, topicTitle, difficulty, questionCount, syllabusContext, focusWeaknesses } = req.body as {
        subjectTitle: string;
        topicTitle: string;
        difficulty: 'standard' | 'intensive';
        questionCount: number;
        syllabusContext?: string;
        focusWeaknesses?: string[];
      };

      if (!subjectTitle?.trim() || !topicTitle?.trim()) {
        res.status(400).json({ error: 'Subject and topic are required.' });
        return;
      }

      const count = Math.min(Math.max(Number(questionCount) || 5, 3), 15);
      const ai = getGenAIClient();
      const prompt = [
        `Generate ${count} ${difficulty === 'intensive' ? 'challenging, application-heavy' : 'clear, exam-aligned'} multiple-choice practice questions for "${topicTitle.trim()}" in "${subjectTitle.trim()}".`,
        syllabusContext ? `Subject context: ${syllabusContext.slice(0, 1500)}` : '',
        focusWeaknesses?.length
          ? `Prioritize concepts related to these recent missed areas: ${focusWeaknesses.join('; ').slice(0, 600)}`
          : '',
        `Each question must have exactly 4 distinct answer choices in "options", a 0-based integer "correctIndex" (0..3), and a clear step-by-step "explanation" explaining why the right answer works and why distractors are wrong.`,
      ]
        .filter(Boolean)
        .join('\n');

      const response = await generateWithRetry(() =>
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: prompt,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                questions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      prompt: { type: Type.STRING },
                      options: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                      correctIndex: { type: Type.INTEGER },
                      explanation: { type: Type.STRING },
                    },
                    required: ['prompt', 'options', 'correctIndex', 'explanation'],
                  },
                },
              },
              required: ['questions'],
            },
          },
        }),
      );

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json(parsed);
    } catch (error) {
      const formatted = formatApiError(error);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/ai/generate-flashcards', async (req, res) => {
    try {
      const { subjectTitle, topicTitle, syllabusContext, cardCount } = req.body as {
        subjectTitle: string;
        topicTitle: string;
        syllabusContext?: string;
        cardCount?: number;
      };

      if (!subjectTitle?.trim() || !topicTitle?.trim()) {
        res.status(400).json({ error: 'Subject and topic are required.' });
        return;
      }

      const count = Math.min(Math.max(Number(cardCount) || 8, 4), 12);
      const ai = getGenAIClient();
      const prompt = [
        `Generate ${count} active-recall spaced-repetition flashcards for "${topicTitle.trim()}" in "${subjectTitle.trim()}".`,
        syllabusContext ? `Subject context: ${syllabusContext.slice(0, 1500)}` : '',
        `Each card needs:`,
        `- front: focused question, term, or prompt (max 350 chars)`,
        `- back: crisp, accurate answer or formula breakdown (max 800 chars)`,
        `- hint: subtle recall cue without giving away the answer (max 200 chars)`,
      ]
        .filter(Boolean)
        .join('\n');

      const response = await generateWithRetry(() =>
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: prompt,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                cards: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      front: { type: Type.STRING },
                      back: { type: Type.STRING },
                      hint: { type: Type.STRING },
                    },
                    required: ['front', 'back', 'hint'],
                  },
                },
              },
              required: ['cards'],
            },
          },
        }),
      );

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json(parsed);
    } catch (error) {
      const formatted = formatApiError(error);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Taau Ai server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
