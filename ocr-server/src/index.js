import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import cors from 'cors';
import express from 'express';
import { createWorker } from 'tesseract.js';

const app = express();
const port = Number(process.env.PORT ?? 8787);
const allowedOrigin = process.env.ALLOWED_ORIGIN ?? '*';
const appTimeZone = process.env.APP_TIME_ZONE ?? 'Asia/Seoul';
const dataDir = process.env.DATA_DIR ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const databasePath = process.env.DATABASE_PATH ?? join(dataDir, 'english-community.sqlite');
const brandIconBase64 = readFileSync(
  new URL('../../assets/launch/app-logo-600.png.base64', import.meta.url),
  'utf8'
).trim();

if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

const db = new DatabaseSync(databasePath);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
initializeDatabase();

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

app.get('/api/posts', (request, response) => {
  const boardType = normalizeBoardType(request.query.boardType);
  const category = String(request.query.category ?? '').trim();
  const q = String(request.query.q ?? '').trim();
  const where = [];
  const params = {};

  if (boardType) {
    where.push('board_type = :boardType');
    params.boardType = boardType;
  }
  if (category) {
    where.push('category = :category');
    params.category = category;
  }
  if (q) {
    where.push('(title LIKE :query OR content LIKE :query OR author_name LIKE :query)');
    params.query = `%${q}%`;
  }

  const sql = `
    SELECT id, board_type AS boardType, category, title, content, author_name AS authorName,
      view_count AS viewCount, created_at AS createdAt, updated_at AS updatedAt
    FROM posts
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY datetime(created_at) DESC
    LIMIT 100
  `;
  response.json({ posts: db.prepare(sql).all(params) });
});

app.get('/api/posts/:id', (request, response) => {
  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id < 1) {
    response.status(400).json({ error: 'Invalid post id.' });
    return;
  }

  db.prepare('UPDATE posts SET view_count = view_count + 1 WHERE id = ?').run(id);
  const post = db.prepare(`
    SELECT id, board_type AS boardType, category, title, content, author_name AS authorName,
      view_count AS viewCount, created_at AS createdAt, updated_at AS updatedAt
    FROM posts
    WHERE id = ?
  `).get(id);

  if (!post) {
    response.status(404).json({ error: 'Post not found.' });
    return;
  }

  response.json({ post });
});

app.post('/api/posts', (request, response) => {
  const parsed = parsePostBody(request.body);
  if (!parsed.ok) {
    response.status(400).json({ error: parsed.error });
    return;
  }

  const now = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO posts (board_type, category, title, content, author_name, password_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    parsed.post.boardType,
    parsed.post.category,
    parsed.post.title,
    parsed.post.content,
    parsed.post.authorName,
    hashPassword(parsed.post.password),
    now,
    now
  );

  response.status(201).json({ id: Number(result.lastInsertRowid) });
});

app.put('/api/posts/:id', (request, response) => {
  const id = Number(request.params.id);
  const parsed = parsePostBody(request.body);
  if (!Number.isInteger(id) || id < 1) {
    response.status(400).json({ error: 'Invalid post id.' });
    return;
  }
  if (!parsed.ok) {
    response.status(400).json({ error: parsed.error });
    return;
  }

  const existing = db.prepare('SELECT password_hash AS passwordHash FROM posts WHERE id = ?').get(id);
  if (!existing) {
    response.status(404).json({ error: 'Post not found.' });
    return;
  }
  if (!verifyPassword(parsed.post.password, existing.passwordHash)) {
    response.status(403).json({ error: 'Password does not match.' });
    return;
  }

  db.prepare(`
    UPDATE posts
    SET board_type = ?, category = ?, title = ?, content = ?, author_name = ?, updated_at = ?
    WHERE id = ?
  `).run(
    parsed.post.boardType,
    parsed.post.category,
    parsed.post.title,
    parsed.post.content,
    parsed.post.authorName,
    new Date().toISOString(),
    id
  );
  response.json({ ok: true });
});

app.delete('/api/posts/:id', (request, response) => {
  const id = Number(request.params.id);
  const password = String(request.body?.password ?? '');
  if (!Number.isInteger(id) || id < 1) {
    response.status(400).json({ error: 'Invalid post id.' });
    return;
  }
  if (password.length < 4) {
    response.status(400).json({ error: 'Password is required.' });
    return;
  }

  const existing = db.prepare('SELECT password_hash AS passwordHash FROM posts WHERE id = ?').get(id);
  if (!existing) {
    response.status(404).json({ error: 'Post not found.' });
    return;
  }
  if (!verifyPassword(password, existing.passwordHash)) {
    response.status(403).json({ error: 'Password does not match.' });
    return;
  }

  db.prepare('DELETE FROM posts WHERE id = ?').run(id);
  response.json({ ok: true });
});

app.get('/api/daily-expression/today', (_request, response) => {
  const today = getTodayKey();
  const expression = db.prepare(`
    SELECT id, expression, meaning, example, date
    FROM daily_expressions
    WHERE date <= ?
    ORDER BY date DESC
    LIMIT 1
  `).get(today);
  response.json({ expression });
});

app.get('/api/resources', (_request, response) => {
  const resources = db.prepare(`
    SELECT id, name, url, description, category
    FROM resources
    ORDER BY category ASC, name ASC
  `).all();
  response.json({ resources });
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
  console.log(`English community server listening on http://localhost:${port}`);
});

function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      board_type TEXT NOT NULL CHECK (board_type IN ('free', 'meetup')),
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      author_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      view_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_expressions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      expression TEXT NOT NULL,
      meaning TEXT NOT NULL,
      example TEXT NOT NULL,
      date TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS resources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL
    );
  `);

  seedDailyExpressions();
  seedResources();
  seedPosts();
}

function seedDailyExpressions() {
  const count = db.prepare('SELECT COUNT(*) AS count FROM daily_expressions').get().count;
  if (count > 0) {
    return;
  }

  const insert = db.prepare(`
    INSERT INTO daily_expressions (expression, meaning, example, date)
    VALUES (?, ?, ?, ?)
  `);
  [
    ['Can I take a rain check?', '다음으로 미뤄도 될까요?', 'I am busy tonight. Can I take a rain check?', '2026-06-26'],
    ['That works for me.', '저는 그거 괜찮아요.', 'Tuesday at seven works for me.', '2026-06-27'],
    ['I am still getting the hang of it.', '아직 익숙해지는 중이에요.', 'I am still getting the hang of speaking in meetings.', '2026-06-28'],
  ].forEach((row) => insert.run(...row));
}

function seedResources() {
  const count = db.prepare('SELECT COUNT(*) AS count FROM resources').get().count;
  if (count > 0) {
    return;
  }

  const insert = db.prepare(`
    INSERT INTO resources (name, url, description, category)
    VALUES (?, ?, ?, ?)
  `);
  [
    ['BBC Learning English', 'https://www.bbc.co.uk/learningenglish', '뉴스와 실생활 표현으로 듣기와 어휘를 함께 익히기 좋아요.', '듣기'],
    ['VOA Learning English', 'https://learningenglish.voanews.com', '천천히 읽어주는 영어 뉴스로 쉐도잉하기 좋아요.', '듣기'],
    ['YouGlish', 'https://youglish.com', '원어민 영상 속 실제 발음을 표현별로 찾아볼 수 있어요.', '발음'],
    ['Cambridge Dictionary', 'https://dictionary.cambridge.org', '영영 뜻, 예문, 영국식/미국식 발음을 확인하기 좋아요.', '사전'],
    ['Write & Improve', 'https://writeandimprove.com', '짧은 영작을 쓰고 자동 피드백을 받을 수 있어요.', '쓰기'],
    ['ELLLO', 'https://elllo.org', '다양한 억양의 짧은 대화 듣기 자료가 많아요.', '회화'],
  ].forEach((row) => insert.run(...row));
}

function seedPosts() {
  const now = new Date().toISOString();
  const insert = db.prepare(`
    INSERT INTO posts (board_type, category, title, content, author_name, password_hash, view_count, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const exists = db.prepare('SELECT id FROM posts WHERE title = ? LIMIT 1');

  [
    ['free', '질문', '전화 영어에서 자주 막히는 표현 공유해요', '예약 변경이나 일정 조율할 때 자연스러운 표현을 같이 모아봐요.', '관리자', 12],
    ['free', '전화영어 후기', '첫 전화영어 수업 후기 남겨요', '10분 수업이라 부담이 적었고, 선생님이 제가 자주 틀리는 시제를 바로 잡아줘서 좋았어요. 다음에는 미리 말하고 싶은 문장을 적어두고 들어가보려고요.', '관리자', 18],
    ['free', '전화영어 후기', '초보가 전화영어 시작할 때 느낀 점', '처음에는 침묵이 길어질까 봐 걱정했는데, 자기소개와 하루 일과처럼 익숙한 주제로 시작하니 훨씬 편했어요.', '관리자', 14],
    ['free', '자료공유', '쉐도잉할 때 한 문장만 반복하는 방식 추천', '긴 영상보다 10초짜리 문장을 여러 번 따라 하면 발음 교정에 도움이 됐어요.', '관리자', 8],
    ['meetup', '회화모임', '토요일 오전 온라인 회화 스터디 모집', '초중급 대상으로 30분 자유 대화, 30분 표현 복습을 진행하려고 합니다.', '관리자', 21],
    ['meetup', '과외', '비즈니스 이메일 첨삭 교환하실 분', '서로 쓴 이메일을 짧게 첨삭하고 표현을 정리해보면 좋겠어요.', '관리자', 15],
  ].forEach(([boardType, category, title, content, authorName, viewCount]) => {
    if (exists.get(title)) {
      return;
    }
    insert.run(boardType, category, title, content, authorName, hashPassword('admin1234'), viewCount, now, now);
  });
}

function getTodayKey() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: appTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

function parsePostBody(body) {
  const boardType = normalizeBoardType(body?.boardType);
  const category = String(body?.category ?? '').trim();
  const title = String(body?.title ?? '').trim();
  const content = String(body?.content ?? '').trim();
  const authorName = String(body?.authorName ?? '').trim();
  const password = String(body?.password ?? '');

  if (!boardType) {
    return { ok: false, error: 'boardType must be free or meetup.' };
  }
  if (category.length < 1 || category.length > 20) {
    return { ok: false, error: 'Category is required.' };
  }
  if (title.length < 2 || title.length > 120) {
    return { ok: false, error: 'Title must be 2-120 characters.' };
  }
  if (content.length < 2 || content.length > 5000) {
    return { ok: false, error: 'Content must be 2-5000 characters.' };
  }
  if (authorName.length < 1 || authorName.length > 30) {
    return { ok: false, error: 'Author name is required.' };
  }
  if (password.length < 4 || password.length > 80) {
    return { ok: false, error: 'Password must be 4-80 characters.' };
  }

  return { ok: true, post: { boardType, category, title, content, authorName, password } };
}

function normalizeBoardType(value) {
  const boardType = String(value ?? '').trim();
  return boardType === 'free' || boardType === 'meetup' ? boardType : '';
}

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, hash] = String(storedHash ?? '').split(':');
  if (!salt || !hash) {
    return false;
  }

  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

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
