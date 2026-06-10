export type SentenceSourceType = 'manual' | 'text';

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

function cleanCandidate(value: string): string {
  let sentence = value.trim();
  sentence = sentence.replace(/^[A-Z]\s+\d+\s*/, '');
  sentence = sentence.replace(/^\d+\s*/, '');
  sentence = sentence.replace(/\s+/g, ' ').trim();

  const firstEnglish = sentence.search(/[A-Za-z]/);
  if (firstEnglish >= 0) {
    sentence = sentence.slice(firstEnglish).trim();
  }

  return sentence;
}

function isValid(sentence: string): boolean {
  if (!/[A-Za-z]/.test(sentence)) {
    return false;
  }
  if (sentence.length >= 300) {
    return false;
  }

  const words = sentence.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g);
  return (words?.length ?? 0) >= 3;
}
