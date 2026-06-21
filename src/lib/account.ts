export interface StudyStats {
  studiedCount: number;
  learningStars: number;
  memorizedSentenceIds: string[];
  hasUsedFreeOcr: boolean;
}

const statsKey = 'english-sentence.study-stats.v1';

export function loadStudyStats(): StudyStats {
  try {
    const raw = window.localStorage.getItem(statsKey);
    if (!raw) {
      return { studiedCount: 0, learningStars: 0, memorizedSentenceIds: [], hasUsedFreeOcr: false };
    }
    const stats = JSON.parse(raw) as StudyStats;
    return {
      studiedCount: Number(stats.studiedCount) || 0,
      learningStars: Number(stats.learningStars) || Number((stats as { points?: number }).points) || 0,
      memorizedSentenceIds: Array.isArray(stats.memorizedSentenceIds) ? stats.memorizedSentenceIds : [],
      hasUsedFreeOcr: stats.hasUsedFreeOcr === true,
    };
  } catch {
    return { studiedCount: 0, learningStars: 0, memorizedSentenceIds: [], hasUsedFreeOcr: false };
  }
}

export function saveStudyStats(stats: StudyStats) {
  window.localStorage.setItem(statsKey, JSON.stringify(stats));
}
