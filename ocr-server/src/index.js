import { readFileSync } from 'node:fs';
import cors from 'cors';
import express from 'express';
import { createWorker } from 'tesseract.js';

const app = express();
const port = Number(process.env.PORT ?? 8787);
const allowedOrigin = process.env.ALLOWED_ORIGIN ?? '*';
const brandIconBase64 = readFileSync(
  new URL('../../assets/launch/app-logo-600.png.base64', import.meta.url),
  'utf8'
).trim();

app.use(cors({ origin: allowedOrigin }));
app.use(express.json({ limit: '12mb' }));

let workerPromise;

app.get('/health', (_request, response) => {
  response.json({ ok: true });
});

app.get('/assets/app-logo-600.png', async (_request, response) => {
  const iconBuffer = Buffer.from(brandIconBase64, 'base64');
  response.type('png').set('Cache-Control', 'public, max-age=86400').send(iconBuffer);
});

app.post('/api/ocr/english', async (request, response) => {
  try {
    const imageDataUri = String(request.body?.imageDataUri ?? '');
    if (!imageDataUri.startsWith('data:image/')) {
      response.status(400).json({ error: 'imageDataUri is required.' });
      return;
    }

    const worker = await getWorker();
    const result = await worker.recognize(imageDataUri, {}, { text: true, blocks: true });
    response.json({ text: sanitizeEnglishOcrResult(result.data) });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: 'OCR failed.' });
  }
});

app.post('/api/translate/en-ko', async (request, response) => {
  try {
    const texts = Array.isArray(request.body?.texts) ? request.body.texts : [];
    const cleanTexts = texts
      .map((text) => String(text ?? '').trim())
      .filter((text) => text.length > 0 && text.length <= 500)
      .slice(0, 30);

    if (cleanTexts.length === 0) {
      response.status(400).json({ error: 'texts is required.' });
      return;
    }

    const translations = await Promise.all(
      cleanTexts.map(async (source) => ({
        source,
        text: await translateEnglishToKorean(source),
      }))
    );

    response.json({ translations });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: 'Translation failed.' });
  }
});

app.listen(port, () => {
  console.log(`OCR server listening on http://localhost:${port}`);
});

async function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker('eng').then(async (worker) => {
      await worker.setParameters({
        preserve_interword_spaces: '1',
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?;:\'"()- ',
      });
      return worker;
    });
  }
  return workerPromise;
}

function sanitizeEnglishOcrResult(data) {
  const confidentLines = (data.blocks ?? [])
    .flatMap((block) => block.paragraphs ?? [])
    .flatMap((paragraph) => paragraph.lines ?? [])
    .filter((line) => Number(line.confidence) >= 50)
    .map((line) => line.text);
  const sourceText = confidentLines.length > 0 ? confidentLines.join('\n') : data.text ?? '';

  return String(sourceText)
    .split(/\r?\n/)
    .map(cleanEnglishOcrLine)
    .filter(Boolean)
    .join('\n');
}

function cleanEnglishOcrLine(value) {
  let line = String(value)
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/[^A-Za-z0-9.,!?;:'"()\-\s]/g, ' ')
    .replace(/(^|\s)\d+(?:[.,:/-]\d+)*(?=\s|$)/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();

  const letters = line.match(/[A-Za-z]/g)?.length ?? 0;
  const digits = line.match(/\d/g)?.length ?? 0;
  const words = line.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) ?? [];
  const plausibleWords = words.filter((word) => {
    const normalized = word.toLowerCase();
    return normalized === 'a' || normalized === 'i' || (normalized.length >= 2 && /[aeiouy]/.test(normalized));
  });
  const suspiciousSingleLetters = words.filter((word) => word.length === 1 && !/^[aAiI]$/.test(word));

  if (
    words.length < 3 ||
    digits / Math.max(letters, 1) > 0.2 ||
    plausibleWords.length / words.length < 0.65 ||
    suspiciousSingleLetters.length > 1
  ) {
    return '';
  }

  line = line.replace(/[^A-Za-z.!?'\")]+$/g, '').trim();
  return line;
}

async function translateEnglishToKorean(text) {
  const endpoint = new URL('https://translate.googleapis.com/translate_a/single');
  endpoint.searchParams.set('client', 'gtx');
  endpoint.searchParams.set('sl', 'en');
  endpoint.searchParams.set('tl', 'ko');
  endpoint.searchParams.set('dt', 't');
  endpoint.searchParams.set('q', text);

  const result = await fetch(endpoint);
  if (!result.ok) {
    throw new Error(`Translate request failed: ${result.status}`);
  }

  const payload = await result.json();
  return Array.isArray(payload?.[0])
    ? payload[0].map((part) => part?.[0] ?? '').join('').trim()
    : '';
}
