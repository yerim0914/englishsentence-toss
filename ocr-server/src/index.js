import cors from 'cors';
import express from 'express';
import { createWorker } from 'tesseract.js';

const app = express();
const port = Number(process.env.PORT ?? 8787);
const allowedOrigin = process.env.ALLOWED_ORIGIN ?? '*';

app.use(cors({ origin: allowedOrigin }));
app.use(express.json({ limit: '12mb' }));

let workerPromise;

app.get('/health', (_request, response) => {
  response.json({ ok: true });
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

app.listen(port, () => {
  console.log(`OCR server listening on http://localhost:${port}`);
});

async function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker('eng');
  }
  return workerPromise;
}
