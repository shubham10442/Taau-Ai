import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);
const MODEL = 'gemini-4-hydrogen';

function makeObjectSchema(properties) {
  return {
    type: Type.OBJECT,
    properties: properties,
    required: Object.keys(properties),
  };
}

function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is missing.');
  }
  return new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });
}

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

async function askGemini(contents, schema) {
  const ai = getAiClient();
  let attempt = 0;

  while (attempt < 3) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: contents,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: schema,
        },
      });
      const text = (response.text || '{}').trim();
      return JSON.parse(text);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isTemporary = /429|503|UNAVAILABLE/.test(message);
      if (attempt === 2 || !isTemporary) {
        throw err;
      }
      await sleep(750 * Math.pow(2, attempt));
      attempt += 1;
    }
  }
}

function sendError(res, err) {
  const message = err instanceof Error ? err.message : String(err);
  let statusCode = 500;
  if (/API_KEY_INVALID|403/.test(message)) {
    statusCode = 403;
  } else if (/429|RESOURCE_EXHAUSTED/.test(message)) {
    statusCode = 429;
  }
  res.status(statusCode).json({ error: message || 'Request failed.' });
}

const app = express();
app.use(express.json({ limit: '15mb' }));
app.use('/src', express.static(path.join(__dirname, 'src')));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', function (_req, res) {
  res.json({ status: 'ok' });
});

app.post('/api/ai/parse-syllabus', async function (req, res) {
  try {
    const body = req.body || {};
    const subjectTitle = (body.subjectTitle || '').trim();
    const examDate = (body.examDate || '').trim();
    const currentDate = body.currentDate || '';
    const dailyHours = body.dailyHours || 3;
    const syllabusText = (body.syllabusText || '').trim();
    const fileData = body.fileData;

    if (!subjectTitle || !examDate) {
      return res.status(400).json({ error: 'Subject and exam date required.' });
    }
    if (!syllabusText && !(fileData && fileData.base64)) {
      return res.status(400).json({ error: 'Paste syllabus text or upload a file.' });
    }

    let prompt = 'Build an exam prep plan for "' + subjectTitle + '". Today: ' + currentDate + '. Exam: ' + examDate + '. Pace: ' + dailyHours + 'h/day.\n';
    prompt += 'Return syllabusOverview (<=1000 chars), 5-14 topics, and 8-16 tasks (scheduledDate ' + currentDate + '..' + examDate + ', durationMinutes 20-120, priority high|medium|normal).';
    if (syllabusText) {
      prompt += '\nSyllabus:\n' + syllabusText.slice(0, 24000);
    }

    const parts = [];
    if (fileData && fileData.base64 && fileData.mimeType) {
      parts.push({ inlineData: { mimeType: fileData.mimeType, data: fileData.base64 } });
    }
    parts.push({ text: prompt });

    const schema = makeObjectSchema({
      syllabusOverview: { type: Type.STRING },
      topics: { type: Type.ARRAY, items: { type: Type.STRING } },
      tasks: {
        type: Type.ARRAY,
        items: makeObjectSchema({
          topicTitle: { type: Type.STRING },
          description: { type: Type.STRING },
          scheduledDate: { type: Type.STRING },
          durationMinutes: { type: Type.INTEGER },
          priority: { type: Type.STRING },
        }),
      },
    });

    const result = await askGemini({ parts: parts }, schema);
    res.json(result);
  } catch (err) {
    sendError(res, err);
  }
});

app.post('/api/ai/generate-summary', async function (req, res) {
  try {
    const body = req.body || {};
    const subjectTitle = (body.subjectTitle || '').trim();
    const topicTitle = (body.topicTitle || '').trim();
    const syllabusContext = body.syllabusContext || '';

    if (!subjectTitle || !topicTitle) {
      return res.status(400).json({ error: 'Subject and topic required.' });
    }

    let prompt = 'Create a concise exam sheet for "' + topicTitle + '" in "' + subjectTitle + '".';
    if (syllabusContext) {
      prompt += ' Context: ' + syllabusContext.slice(0, 1500);
    }
    prompt += '\nInclude overview, 5-8 coreConcepts, 2-6 formulaSheet items, 3-5 examPitfalls, and 1 memoryAnchor.';

    const schema = makeObjectSchema({
      overview: { type: Type.STRING },
      coreConcepts: { type: Type.ARRAY, items: { type: Type.STRING } },
      formulaSheet: {
        type: Type.ARRAY,
        items: makeObjectSchema({
          label: { type: Type.STRING },
          expression: { type: Type.STRING },
          note: { type: Type.STRING },
        }),
      },
      examPitfalls: { type: Type.ARRAY, items: { type: Type.STRING } },
      memoryAnchor: { type: Type.STRING },
    });

    const result = await askGemini(prompt, schema);
    res.json(result);
  } catch (err) {
    sendError(res, err);
  }
});

app.post('/api/ai/generate-quiz', async function (req, res) {
  try {
    const body = req.body || {};
    const subjectTitle = (body.subjectTitle || '').trim();
    const topicTitle = (body.topicTitle || '').trim();
    const difficulty = body.difficulty || 'standard';
    const syllabusContext = body.syllabusContext || '';
    const focusWeaknesses = Array.isArray(body.focusWeaknesses) ? body.focusWeaknesses : [];

    if (!subjectTitle || !topicTitle) {
      return res.status(400).json({ error: 'Subject and topic required.' });
    }

    let count = Number(body.questionCount) || 5;
    if (count < 3) count = 3;
    if (count > 15) count = 15;

    const level = difficulty === 'intensive' ? 'challenging' : 'exam-style';
    let prompt = 'Generate ' + count + ' ' + level + ' 4-option MCQs for "' + topicTitle + '" in "' + subjectTitle + '".';
    if (syllabusContext) {
      prompt += ' Context: ' + syllabusContext.slice(0, 1500);
    }
    if (focusWeaknesses.length > 0) {
      prompt += ' Focus missed areas: ' + focusWeaknesses.join('; ').slice(0, 600);
    }

    const schema = makeObjectSchema({
      questions: {
        type: Type.ARRAY,
        items: makeObjectSchema({
          prompt: { type: Type.STRING },
          options: { type: Type.ARRAY, items: { type: Type.STRING } },
          correctIndex: { type: Type.INTEGER },
          explanation: { type: Type.STRING },
        }),
      },
    });

    const result = await askGemini(prompt, schema);
    res.json(result);
  } catch (err) {
    sendError(res, err);
  }
});

app.get('*', function (_req, res) {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', function () {
  console.log('Taau Ai server running on http://localhost:' + PORT);
});
