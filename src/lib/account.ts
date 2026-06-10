import type { SentenceItem } from './sentences';

export interface UserSession {
  userId: string;
  displayName: string;
  tossPointRewardedAmount?: number;
  backedUpAt?: string;
}

export interface StudyStats {
  studiedCount: number;
  learningStars: number;
}

const sessionKey = 'english-sentence.session.v1';
const statsKey = 'english-sentence.study-stats.v1';

export function loadSession(): UserSession | null {
  try {
    const raw = window.localStorage.getItem(sessionKey);
    return raw ? (JSON.parse(raw) as UserSession) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: UserSession | null) {
  if (!session) {
    window.localStorage.removeItem(sessionKey);
    return;
  }
  window.localStorage.setItem(sessionKey, JSON.stringify(session));
}

export function loadStudyStats(): StudyStats {
  try {
    const raw = window.localStorage.getItem(statsKey);
    if (!raw) {
      return { studiedCount: 0, learningStars: 0 };
    }
    const stats = JSON.parse(raw) as StudyStats;
    return {
      studiedCount: Number(stats.studiedCount) || 0,
      learningStars: Number(stats.learningStars) || Number((stats as { points?: number }).points) || 0,
    };
  } catch {
    return { studiedCount: 0, learningStars: 0 };
  }
}

export function saveStudyStats(stats: StudyStats) {
  window.localStorage.setItem(statsKey, JSON.stringify(stats));
}

export async function requestTossLogin(): Promise<UserSession> {
  const { appLogin } = await import('@apps-in-toss/web-framework');
  const { authorizationCode, referrer } = await appLogin();
  return createServerSession(authorizationCode, referrer);
}

export async function createServerSession(
  authorizationCode: string,
  referrer: string
): Promise<UserSession> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/auth/toss`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ authorizationCode, referrer }),
  });

  if (!response.ok) {
    throw new Error('토스 로그인 서버 연동에 실패했습니다.');
  }

  return response.json() as Promise<UserSession>;
}

export async function backupSentences(session: UserSession, items: SentenceItem[]) {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/me/sentences`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.userId}`,
    },
    body: JSON.stringify({ items }),
  });

  if (!response.ok) {
    throw new Error('백업에 실패했습니다.');
  }
}

export async function awardStudyPoints(session: UserSession, points: number) {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/me/study-events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.userId}`,
    },
    body: JSON.stringify({ points, reason: 'sentence_memorized' }),
  });

  if (!response.ok) {
    throw new Error('포인트 적립에 실패했습니다.');
  }

  return response.json() as Promise<{ points: number }>;
}

function getApiBaseUrl() {
  const baseUrl = import.meta.env.VITE_API_BASE_URL;
  if (!baseUrl) {
    throw new Error('VITE_API_BASE_URL이 설정되지 않았습니다.');
  }
  return String(baseUrl).replace(/\/$/, '');
}
