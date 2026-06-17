import cors from 'cors';
import express from 'express';
import { createWorker } from 'tesseract.js';

const app = express();
const port = Number(process.env.PORT ?? 8787);
const allowedOrigin = process.env.ALLOWED_ORIGIN ?? '*';
const brandIconBase64Url = 'https://raw.githubusercontent.com/yerim0914/englishsentence-toss/main/assets/launch/app-logo-600.png.base64';


app.use(cors({ origin: allowedOrigin }));
app.use(express.json({ limit: '12mb' }));

let workerPromise;

app.get('/health', (_request, response) => {
  response.json({ ok: true });
});

app.get('/assets/app-logo-600.png', async (_request, response) => {
  const iconResponse = await fetch(brandIconBase64Url);

  if (!iconResponse.ok) {
    response.status(502).json({ error: 'Brand icon is unavailable.' });
    return;
  }

  const iconBuffer = Buffer.from((await iconResponse.text()).trim(), 'base64');
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
    const result = await worker.recognize(imageDataUri);
    response.json({ text: result.data.text ?? '' });
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
    workerPromise = createWorker('eng');
  }
  return workerPromise;
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
