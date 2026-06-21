export type SentenceSourceType = 'manual' | 'text' | 'image';

export interface SentenceItem {
  id: string;
  english: string;
  korean: string;
  sourceType: SentenceSourceType;
  createdAt: string;
}

const storageKey = 'english-sentence.items.v1';

export function parseEnglishSentences(text: string): string[] {
  const normalized = text
    .replace(/\r\n?/g, '\n')
    .replace(/([.!?])\s*/g, '$1|')
    .replace(/\n+/g, '|')
    .replace(/[ \t]+/g, ' ')
    .trim();

  const seen = new Set<string>();
  const sentences: string[] = [];

  for (const raw of normalized.split('|')) {
    const sentence = cleanCandidate(raw);
    if (!isValid(sentence)) {
      continue;
    }

    const key = sentence.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      sentences.push(sentence);
    }
  }

  return sentences;
}

export function loadSentences(): SentenceItem[] {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return [];
    }
    const rows = JSON.parse(raw) as SentenceItem[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export function saveSentences(items: SentenceItem[]) {
  window.localStorage.setItem(storageKey, JSON.stringify(items));
}

export function createSentence(
  english: string,
  korean: string,
  sourceType: SentenceSourceType
): SentenceItem {
  return {
    id: crypto.randomUUID(),
    english: english.trim(),
    korean: korean.trim(),
    sourceType,
    createdAt: new Date().toISOString(),
  };
}

export async function recognizeEnglishText(imageDataUri: string): Promise<string> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL;
  if (!baseUrl) {
    throw new Error('OCR 기능은 서버 연결 후 사용할 수 있어요. 지금은 인식된 문장을 아래 칸에 붙여넣어 주세요.');
  }

  const response = await fetch(`${String(baseUrl).replace(/\/$/, '')}/api/ocr/english`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageDataUri }),
  });

  if (!response.ok) {
    throw new Error('이미지 인식에 실패했습니다.');
  }

  const result = (await response.json()) as { text?: string };
  return result.text ?? '';
}

export async function translateEnglishToKorean(texts: string[]): Promise<Record<string, string>> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL;
  if (!baseUrl) {
    throw new Error('번역 기능은 서버 연결 후 사용할 수 있어요.');
  }

  const response = await fetch(`${String(baseUrl).replace(/\/$/, '')}/api/translate/en-ko`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts }),
  });

  if (!response.ok) {
    throw new Error('한국어 뜻 자동 채우기에 실패했습니다.');
  }

  const result = (await response.json()) as { translations?: Array<{ source: string; text: string }> };
  return Object.fromEntries((result.translations ?? []).map((item) => [item.source, item.text]));
}

function cleanCandidate(value: string): string {
  let sentence = value.trim();
  sentence = sentence.replace(/[^\x20-\x7E]/g, ' ');
  sentence = sentence.replace(/^[A-Z]\s+\d+\s*/, '');
  sentence = sentence.replace(/^\d+\s*/, '');
  sentence = sentence.replace(/[^A-Za-z0-9.,!?;:'"()\-\s]/g, ' ');
  sentence = sentence.replace(/(^|\s)\d+(?:[.,:/-]\d+)*(?=\s|$)/g, ' ');
  sentence = sentence.replace(/\s+/g, ' ').trim();

  const firstEnglish = sentence.search(/[A-Za-z]/);
  if (firstEnglish >= 0) {
    sentence = sentence.slice(firstEnglish).trim();
  }

  sentence = sentence.replace(/[^A-Za-z.!?'\")]+$/g, '').trim();

  return sentence;
}

function isValid(sentence: string): boolean {
  if (!/[A-Za-z]/.test(sentence)) {
    return false;
  }
  if (sentence.length >= 300) {
    return false;
  }

  const letters = sentence.match(/[A-Za-z]/g)?.length ?? 0;
  const digits = sentence.match(/\d/g)?.length ?? 0;
  if (digits > 0 && digits / Math.max(letters, 1) > 0.2) {
    return false;
  }

  const words = sentence.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) ?? [];
  if (words.length < 3) {
    return false;
  }

  const plausibleWords = words.filter((word) => {
    const normalized = word.toLowerCase();
    return normalized === 'a' || normalized === 'i' || (normalized.length >= 2 && /[aeiouy]/.test(normalized));
  });
  const suspiciousSingleLetters = words.filter((word) => word.length === 1 && !/^[aAiI]$/.test(word));

  return plausibleWords.length / words.length >= 0.65 && suspiciousSingleLetters.length <= 1;
}
