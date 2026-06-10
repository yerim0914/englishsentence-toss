export type RewardKind = 'first_sentence' | 'study_10';

export interface RewardState {
  firstSentenceClaimed: boolean;
  claimedStudyMilestones: number[];
}

export interface RewardOffer {
  kind: RewardKind;
  title: string;
  description: string;
  amount: number;
  promotionCode?: string;
  milestone?: number;
}

const rewardStateKey = 'english-sentence.reward-state.v1';

export function loadRewardState(): RewardState {
  try {
    const raw = window.localStorage.getItem(rewardStateKey);
    if (!raw) {
      return { firstSentenceClaimed: false, claimedStudyMilestones: [] };
    }

    const parsed = JSON.parse(raw) as RewardState;
    return {
      firstSentenceClaimed: Boolean(parsed.firstSentenceClaimed),
      claimedStudyMilestones: Array.isArray(parsed.claimedStudyMilestones)
        ? parsed.claimedStudyMilestones.filter((value) => Number.isInteger(value))
        : [],
    };
  } catch {
    return { firstSentenceClaimed: false, claimedStudyMilestones: [] };
  }
}

export function saveRewardState(state: RewardState) {
  window.localStorage.setItem(rewardStateKey, JSON.stringify(state));
}

export function getRewardOffers({
  isLoggedIn,
  sentenceCount,
  studiedCount,
  rewardState,
}: {
  isLoggedIn: boolean;
  sentenceCount: number;
  studiedCount: number;
  rewardState: RewardState;
}): RewardOffer[] {
  if (!isLoggedIn) {
    return [];
  }

  const offers: RewardOffer[] = [];

  if (sentenceCount >= 1 && !rewardState.firstSentenceClaimed) {
    offers.push({
      kind: 'first_sentence',
      title: '첫 문장 저장 리워드',
      description: '광고 시청 완료 후 토스포인트 1원을 지급해요.',
      amount: 1,
      promotionCode: import.meta.env.VITE_FIRST_SENTENCE_PROMOTION_CODE,
    });
  }

  const earnedMilestone = Math.floor(studiedCount / 10);
  const claimed = new Set(rewardState.claimedStudyMilestones);
  for (let milestone = 1; milestone <= earnedMilestone; milestone += 1) {
    if (!claimed.has(milestone)) {
      offers.push({
        kind: 'study_10',
        title: `${milestone * 10}문장 암기 리워드`,
        description: '광고 시청 완료 후 토스포인트 1원을 지급해요.',
        amount: 1,
        promotionCode: import.meta.env.VITE_STUDY_10_PROMOTION_CODE,
        milestone,
      });
      break;
    }
  }

  return offers;
}

export async function showRewardedAd() {
  const adGroupId = import.meta.env.VITE_REWARDED_AD_GROUP_ID;
  if (!adGroupId) {
    throw new Error('VITE_REWARDED_AD_GROUP_ID가 설정되지 않았습니다.');
  }

  const { loadFullScreenAd, showFullScreenAd } = await import('@apps-in-toss/web-framework');
  if (!loadFullScreenAd.isSupported() || !showFullScreenAd.isSupported()) {
    throw new Error('현재 환경에서 보상형 광고를 사용할 수 없습니다.');
  }

  await loadAd(loadFullScreenAd, adGroupId);
  await showAd(showFullScreenAd, adGroupId);
}

export async function grantTossPointReward(offer: RewardOffer) {
  if (!offer.promotionCode) {
    throw new Error('프로모션 코드가 설정되지 않았습니다.');
  }

  const sdk = await import('@apps-in-toss/web-framework');
  const grantPromotionReward = (sdk as Record<string, unknown>).grantPromotionReward;
  if (typeof grantPromotionReward === 'function') {
    const result = await grantPromotionReward({
      params: {
        promotionCode: offer.promotionCode,
        amount: offer.amount,
      },
    });
    assertPromotionResult(result);
    return;
  }

  await grantRewardFromServer(offer);
}

export function markRewardClaimed(state: RewardState, offer: RewardOffer): RewardState {
  if (offer.kind === 'first_sentence') {
    return { ...state, firstSentenceClaimed: true };
  }

  if (!offer.milestone) {
    return state;
  }

  return {
    ...state,
    claimedStudyMilestones: [...new Set([...state.claimedStudyMilestones, offer.milestone])].sort(
      (a, b) => a - b
    ),
  };
}

async function grantRewardFromServer(offer: RewardOffer) {
  const baseUrl = import.meta.env.VITE_API_BASE_URL;
  if (!baseUrl) {
    throw new Error('SDK 지급 함수 또는 VITE_API_BASE_URL 설정이 필요합니다.');
  }

  const response = await fetch(`${String(baseUrl).replace(/\/$/, '')}/api/me/toss-point-rewards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind: offer.kind,
      promotionCode: offer.promotionCode,
      amount: offer.amount,
      milestone: offer.milestone,
    }),
  });

  if (!response.ok) {
    throw new Error('토스포인트 지급 요청에 실패했습니다.');
  }
}

function loadAd(
  loadFullScreenAd: typeof import('@apps-in-toss/web-framework').loadFullScreenAd,
  adGroupId: string
) {
  return new Promise<void>((resolve, reject) => {
    const unregister = loadFullScreenAd({
      options: { adGroupId },
      onEvent: (event) => {
        if (event.type === 'loaded') {
          unregister();
          resolve();
        }
      },
      onError: (error) => {
        unregister();
        reject(error);
      },
    });
  });
}

function showAd(
  showFullScreenAd: typeof import('@apps-in-toss/web-framework').showFullScreenAd,
  adGroupId: string
) {
  return new Promise<void>((resolve, reject) => {
    let rewarded = false;
    const unregister = showFullScreenAd({
      options: { adGroupId },
      onEvent: (event) => {
        if (event.type === 'userEarnedReward') {
          rewarded = true;
          resolve();
        }
        if (event.type === 'failedToShow') {
          unregister();
          reject(new Error('광고 표시가 실패했습니다.'));
        }
        if (event.type === 'dismissed') {
          unregister();
          if (!rewarded) {
            reject(new Error('광고 시청이 완료되지 않았습니다.'));
          }
        }
      },
      onError: (error) => {
        unregister();
        reject(error);
      },
    });
  });
}

function assertPromotionResult(result: unknown) {
  if (!result) {
    throw new Error('지원하지 않는 토스 앱 버전입니다.');
  }
  if (result === 'ERROR') {
    throw new Error('토스포인트 지급 중 오류가 발생했습니다.');
  }
  if (typeof result === 'object' && result && 'errorCode' in result) {
    const error = result as { errorCode: string; message?: string };
    throw new Error(error.message ?? `토스포인트 지급 실패: ${error.errorCode}`);
  }
}
