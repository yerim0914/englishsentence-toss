import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
// Review rebuild marker: brand icon resubmitted 2026-06-15.
import {
  BookOpen,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Home,
  List,
  Pencil,
  Plus,
  Star,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  StudyStats,
  loadStudyStats,
  saveStudyStats,
} from './lib/account';
import {
  SentenceItem,
  createSentence,
  loadSentences,
  parseEnglishSentences,
  recognizeEnglishText,
  saveSentences,
  translateEnglishToKorean,
} from './lib/sentences';
import './styles/app.css';

type Tab = 'home' | 'add' | 'import' | 'list' | 'study';
const tossBannerAdGroupId = import.meta.env.VITE_TOSS_BANNER_AD_GROUP_ID ?? 'ait.v2.live.359967780f7d4b94';

function getInitialTab(): Tab {
  const route = window.location.pathname.replace(/^\/+|\/+$/g, '');
  return ['add', 'import', 'list', 'study'].includes(route) ? route as Tab : 'home';
}

function App() {
  const [items, setItems] = useState<SentenceItem[]>(loadSentences);
  const [stats, setStats] = useState<StudyStats>(loadStudyStats);
  const [status, setStatus] = useState('');
  const [tab, setTab] = useState<Tab>(getInitialTab);

  const persist = (next: SentenceItem[]) => {
    setItems(next);
    saveSentences(next);
  };

  const markSentenceStudied = (sentenceId: string) => {
    if (stats.memorizedSentenceIds.includes(sentenceId)) {
      setStatus('이미 암기 완료한 문장입니다.');
      return;
    }

    const nextStats = {
      ...stats,
      studiedCount: stats.studiedCount + 1,
      memorizedSentenceIds: [...stats.memorizedSentenceIds, sentenceId],
    };
    setStats(nextStats);
    saveStudyStats(nextStats);
    setStatus('암기 완료');
  };

  const completeStarChallenge = (sentenceIds: string[]) => {
    const nextStats = {
      ...stats,
      studiedCount: stats.studiedCount + sentenceIds.length,
      learningStars: stats.learningStars + 1,
      memorizedSentenceIds: [...new Set([...stats.memorizedSentenceIds, ...sentenceIds])],
    };
    setStats(nextStats);
    saveStudyStats(nextStats);
    setStatus('10문장 암기 완료 · 1별 적립');
  };

  const useOcrStar = () => {
    if (!stats.hasUsedFreeOcr) {
      const nextStats = { ...stats, hasUsedFreeOcr: true };
      setStats(nextStats);
      saveStudyStats(nextStats);
      setStatus('첫 이미지 인식 · 무료');
      return true;
    }

    if (stats.learningStars < 1) {
      setStatus('이미지 인식에는 1별이 필요해요.');
      return false;
    }

    const nextStats = { ...stats, learningStars: stats.learningStars - 1 };
    setStats(nextStats);
    saveStudyStats(nextStats);
    setStatus('이미지 인식 · 1별 사용');
    return true;
  };

  return (
    <main className="app-shell">
      {tab === 'home' && (
        <HomeView
          count={items.length}
          stats={stats}
          status={status}
          onNavigate={setTab}
        />
      )}
      {tab === 'add' && (
        <AddView
          onBack={() => setTab('home')}
          onAdd={(english, korean) => {
            persist([createSentence(english, korean, 'manual'), ...items]);
            setTab('list');
          }}
        />
      )}
      {tab === 'import' && (
        <ImportView
          onBack={() => setTab('home')}
          availableStars={stats.learningStars}
          isFirstOcrFree={!stats.hasUsedFreeOcr}
          onUseOcrStar={useOcrStar}
          onSave={(rows) => {
            persist([...rows.map((row) => createSentence(row.english, row.korean, row.sourceType)), ...items]);
            setTab('list');
          }}
        />
      )}
      {tab === 'list' && (
        <ListView
          items={items}
          onBack={() => setTab('home')}
          onDelete={(id) => persist(items.filter((item) => item.id !== id))}
          onUpdate={(id, english, korean) =>
            persist(
              items.map((item) =>
                item.id === id ? { ...item, english: english.trim(), korean: korean.trim() } : item
              )
            )
          }
          onClear={() => persist([])}
        />
      )}
      {tab === 'study' && (
        <StudyView
          items={items}
          memorizedSentenceIds={stats.memorizedSentenceIds}
          onBack={() => setTab('home')}
          onMemorized={markSentenceStudied}
          onChallengeComplete={completeStarChallenge}
        />
      )}
      <BottomNav active={tab} onNavigate={setTab} />
    </main>
  );
}

function HomeView({
  count,
  stats,
  status,
  onNavigate,
}: {
  count: number;
  stats: StudyStats;
  status: string;
  onNavigate: (tab: Tab) => void;
}) {
  return (
    <section className="screen home-screen">
      <div className="summary">
        <div>
          <span className="summary-label">저장된 문장</span>
          <strong>{count}</strong>
        </div>
        <div className="summary-points">
          <Star size={20} />
          <span>{stats.learningStars}별</span>
        </div>
      </div>
      <BannerAd placement="home" />
      <StudySummary stats={stats} status={status} />
      <div className="home-title">
        <h1>영어문장암기</h1>
        <p>한국어 뜻을 보고 영어 문장을 떠올리는 짧은 반복 학습 앱입니다.</p>
      </div>
      <div className="action-grid">
        <button className="primary-action" onClick={() => onNavigate('add')}>
          <Plus size={22} />
          직접 추가
        </button>
        <button className="primary-action" onClick={() => onNavigate('import')}>
          <Upload size={22} />
          텍스트 가져오기
        </button>
        <button className="primary-action" onClick={() => onNavigate('study')} disabled={count === 0}>
          <BookOpen size={22} />
          암기 시작
        </button>
        <button className="primary-action" onClick={() => onNavigate('list')}>
          <List size={22} />
          문장 목록
        </button>
      </div>
    </section>
  );
}

function StudySummary({ stats, status }: { stats: StudyStats; status: string }) {
  return (
    <section className="study-summary-panel">
      <div>
        <div className="study-summary-title">
          <Star size={20} />
          <strong>학습 현황</strong>
        </div>
        <p>암기 {stats.studiedCount}회 · 보유 별 {stats.learningStars}개</p>
        {status && <span className="status-text">{status}</span>}
      </div>
    </section>
  );
}

function AddView({
  onBack,
  onAdd,
}: {
  onBack: () => void;
  onAdd: (english: string, korean: string) => void;
}) {
  const [english, setEnglish] = useState('');
  const [korean, setKorean] = useState('');
  const canSave = english.trim().length > 0 && korean.trim().length > 0;

  return (
    <section className="screen">
      <Header title="문장 추가" onBack={onBack} />
      <label className="field">
        <span>영어 문장</span>
        <textarea value={english} onChange={(event) => setEnglish(event.target.value)} rows={4} />
      </label>
      <label className="field">
        <span>한국어 뜻</span>
        <textarea value={korean} onChange={(event) => setKorean(event.target.value)} rows={4} />
      </label>
      <button className="fixed-button" disabled={!canSave} onClick={() => onAdd(english, korean)}>
        <Check size={20} />
        저장
      </button>
    </section>
  );
}

function ImportView({
  onBack,
  availableStars,
  isFirstOcrFree,
  onUseOcrStar,
  onSave,
}: {
  onBack: () => void;
  availableStars: number;
  isFirstOcrFree: boolean;
  onUseOcrStar: () => boolean;
  onSave: (rows: Array<{ english: string; korean: string; sourceType: 'text' | 'image' }>) => void;
}) {
  const [raw, setRaw] = useState('');
  const [meanings, setMeanings] = useState<Record<string, string>>({});
  const [sourceType, setSourceType] = useState<'text' | 'image'>('text');
  const [previewUrl, setPreviewUrl] = useState('');
  const [ocrStatus, setOcrStatus] = useState('');
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationPrompt, setTranslationPrompt] = useState<string[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const parsed = useMemo(() => parseEnglishSentences(raw), [raw]);
  const rows = parsed.map((english) => ({ english, korean: meanings[english]?.trim() ?? '', sourceType }));
  const canSave = rows.some((row) => row.english && row.korean);

  const fillKoreanMeanings = async (sentences: string[]) => {
    const missing = sentences.filter((sentence) => !meanings[sentence]?.trim());
    if (missing.length === 0) {
      return;
    }

    setIsTranslating(true);
    setOcrStatus('한국어 뜻을 채우고 있어요.');

    try {
      const translations = await translateEnglishToKorean(missing);
      setMeanings((current) => ({ ...translations, ...current }));
      setOcrStatus('한국어 뜻 자동 채우기 완료');
    } catch (error) {
      setOcrStatus(error instanceof Error ? error.message : '한국어 뜻 자동 채우기에 실패했습니다.');
    } finally {
      setIsTranslating(false);
    }
  };

  const recognizeImageDataUri = async (imageDataUri: string) => {
    setPreviewUrl(imageDataUri);
    setSourceType('image');
    setIsRecognizing(true);
    setOcrStatus('이미지를 확인하고 있어요.');

    try {
      const text = await recognizeEnglishText(imageDataUri);
      const sentences = parseEnglishSentences(text);
      if (sentences.length > 0 && !onUseOcrStar()) {
        setOcrStatus('이미지 인식에는 1별이 필요해요.');
        return;
      }
      setRaw(sentences.join('\n'));
      setOcrStatus(sentences.length > 0 ? '인식 완료' : '인식된 문장이 없습니다.');
      setTranslationPrompt(sentences.length > 0 ? sentences : null);
    } catch (error) {
      setOcrStatus(error instanceof Error ? error.message : '이미지 인식에 실패했습니다.');
    } finally {
      setIsRecognizing(false);
    }
  };

  const recognizeImageFile = async (file?: File) => {
    if (!file) {
      return;
    }
    await recognizeImageDataUri(await fileToDataUri(file));
  };

  const selectImage = () => {
    if (!isFirstOcrFree && availableStars < 1) {
      setOcrStatus('이미지 인식에는 1별이 필요해요.');
      return;
    }
    fileInputRef.current?.click();
  };

  return (
    <section className="screen">
      <Header title="텍스트 가져오기" onBack={onBack} />
      <p className="ocr-cost-label">
        {isFirstOcrFree ? '첫 이미지 인식은 무료예요.' : '이미지 인식 시 1별이 사용됩니다.'}
      </p>
      <button className="image-picker" disabled={isRecognizing} onClick={selectImage}>
        <Camera size={22} />
        <span>{isRecognizing || isTranslating ? '처리 중' : '이미지로 문장 인식'}</span>
      </button>
      {!isFirstOcrFree && availableStars < 1 && <p className="ocr-cost-hint">별 따기 암기를 완료하면 이미지 인식에 쓸 별을 얻어요.</p>}
      <input
        ref={fileInputRef}
        className="hidden-file-input"
        type="file"
        accept="image/*"
        disabled={isRecognizing}
        onChange={(event) => {
          recognizeImageFile(event.currentTarget.files?.[0]);
          event.currentTarget.value = '';
        }}
      />
      {(previewUrl || ocrStatus) && (
        <div className="ocr-panel">
          {previewUrl && <img src={previewUrl} alt="인식할 이미지" />}
          {ocrStatus && <span>{ocrStatus}</span>}
        </div>
      )}
      <label className="field">
        <span>인식된 영어 텍스트</span>
        <textarea
          value={raw}
          onChange={(event) => {
            setRaw(event.target.value);
            setSourceType('text');
          }}
          rows={8}
          placeholder="사진에서 인식된 문장이 여기에 들어옵니다. 직접 붙여넣어도 됩니다."
        />
      </label>
      <div className="review-list">
        {parsed.map((english) => (
          <div className="review-row" key={english}>
            <p>{english}</p>
            <input
              value={meanings[english] ?? ''}
              onChange={(event) => setMeanings({ ...meanings, [english]: event.target.value })}
              placeholder="한국어 뜻"
            />
          </div>
        ))}
      </div>
      <button
        className="fixed-button"
        disabled={!canSave}
        onClick={() => onSave(rows.filter((row) => row.english && row.korean))}
      >
        <Check size={20} />
        저장
      </button>
      {translationPrompt && (
        <div className="sheet-backdrop">
          <div className="sheet translation-sheet">
            <h2>한국어 뜻을 자동으로 채울까요?</h2>
            <p>인식된 영어 문장을 번역한 뒤 직접 수정할 수 있어요.</p>
            <div className="sheet-actions">
              <button onClick={() => setTranslationPrompt(null)}>직접 입력</button>
              <button
                disabled={isTranslating}
                onClick={async () => {
                  const sentences = translationPrompt;
                  setTranslationPrompt(null);
                  await fillKoreanMeanings(sentences);
                }}
              >
                자동 채우기
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function fileToDataUri(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result ?? '')));
    reader.addEventListener('error', () => reject(reader.error ?? new Error('이미지를 읽지 못했습니다.')));
    reader.readAsDataURL(file);
  });
}

function ListView({
  items,
  onBack,
  onDelete,
  onUpdate,
  onClear,
}: {
  items: SentenceItem[];
  onBack: () => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, english: string, korean: string) => void;
  onClear: () => void;
}) {
  const [editing, setEditing] = useState<SentenceItem | null>(null);

  return (
    <section className="screen">
      <Header title="문장 목록" onBack={onBack} action={items.length ? <button onClick={onClear}><Trash2 size={18} /></button> : null} />
      <div className="sentence-list">
        {items.length === 0 && <EmptyState text="저장된 문장이 없습니다." />}
        {items.map((item, index) => (
          <React.Fragment key={item.id}>
            <article className="sentence-card">
              <div>
                <p className="english">{item.english}</p>
                <p className="korean">{item.korean}</p>
              </div>
              <div className="card-tools">
                <button onClick={() => setEditing(item)} aria-label="수정">
                  <Pencil size={18} />
                </button>
                <button onClick={() => onDelete(item.id)} aria-label="삭제">
                  <Trash2 size={18} />
                </button>
              </div>
            </article>
            {index === 0 && (
              <div className="list-ad-slot">
                <BannerAd placement="list" />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
      {editing && (
        <EditSheet
          item={editing}
          onClose={() => setEditing(null)}
          onSave={(english, korean) => {
            onUpdate(editing.id, english, korean);
            setEditing(null);
          }}
        />
      )}
    </section>
  );
}

function StudyView({
  items,
  memorizedSentenceIds,
  onBack,
  onMemorized,
  onChallengeComplete,
}: {
  items: SentenceItem[];
  memorizedSentenceIds: string[];
  onBack: () => void;
  onMemorized: (sentenceId: string) => void;
  onChallengeComplete: (sentenceIds: string[]) => void;
}) {
  const [mode, setMode] = useState<'card' | 'list' | 'challenge'>('card');
  const [index, setIndex] = useState(0);
  const [revealedIds, setRevealedIds] = useState<string[]>([]);
  const [challengeItems, setChallengeItems] = useState<SentenceItem[]>([]);
  const [challengeIndex, setChallengeIndex] = useState(0);
  const [challengeRevealed, setChallengeRevealed] = useState(false);
  const [challengeComplete, setChallengeComplete] = useState(false);
  const challengeAwardedRef = useRef(false);
  const item = items[index];

  if (!item) {
    return (
      <section className="screen">
        <Header title="암기" onBack={onBack} />
        <EmptyState text="암기할 문장을 먼저 추가하세요." />
      </section>
    );
  }

  const revealSentence = (sentenceId: string) => {
    setRevealedIds((current) => current.includes(sentenceId) ? current : [...current, sentenceId]);
  };

  const isRevealed = revealedIds.includes(item.id);
  const challengeItem = challengeItems[challengeIndex];

  const startChallenge = () => {
    if (items.length < 10) {
      return;
    }

    const shuffled = [...items];
    for (let current = shuffled.length - 1; current > 0; current -= 1) {
      const random = Math.floor(Math.random() * (current + 1));
      [shuffled[current], shuffled[random]] = [shuffled[random], shuffled[current]];
    }
    setChallengeItems(shuffled.slice(0, 10));
    setChallengeIndex(0);
    setChallengeRevealed(false);
    setChallengeComplete(false);
    challengeAwardedRef.current = false;
  };

  const finishChallengeSentence = () => {
    if (challengeIndex < challengeItems.length - 1) {
      setChallengeIndex((current) => current + 1);
      setChallengeRevealed(false);
      return;
    }
    if (challengeAwardedRef.current) {
      return;
    }
    challengeAwardedRef.current = true;
    onChallengeComplete(challengeItems.map((sentence) => sentence.id));
    setChallengeComplete(true);
  };

  return (
    <section className="screen study-screen">
      <Header title="암기" onBack={onBack} />
      <div className="study-mode-control" role="group" aria-label="암기 방식">
        <button className={mode === 'card' ? 'active' : ''} onClick={() => setMode('card')}>
          <BookOpen size={18} />
          한 문장씩
        </button>
        <button className={mode === 'list' ? 'active' : ''} onClick={() => setMode('list')}>
          <List size={18} />
          전체 목록
        </button>
        <button className={mode === 'challenge' ? 'active' : ''} onClick={() => setMode('challenge')}>
          <Star size={18} />
          별 따기
        </button>
      </div>

      {mode === 'card' && (
        <>
          <div className="study-progress">{index + 1} / {items.length}</div>
          <div className="study-card">
            <span>한국어 뜻</span>
            <p>{item.korean}</p>
          </div>
          {isRevealed ? (
            <div className="answer-card">
              <span>영어 문장</span>
              <p>{item.english}</p>
            </div>
          ) : (
            <button className="reveal-button" onClick={() => revealSentence(item.id)}>
              정답 보기
            </button>
          )}
          <button
            className="memorized-button"
            disabled={!isRevealed || memorizedSentenceIds.includes(item.id)}
            onClick={() => onMemorized(item.id)}
          >
            <Check size={20} />
            {memorizedSentenceIds.includes(item.id) ? '암기 완료' : '외웠어요'}
          </button>
          <BannerAd placement="study" />
          <div className="study-controls">
            <button onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0}>
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={() => setIndex(Math.min(items.length - 1, index + 1))}
              disabled={index === items.length - 1}
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </>
      )}

      {mode === 'list' && (
        <>
          <div className="study-list">
            {items.map((sentence, sentenceIndex) => {
              const revealed = revealedIds.includes(sentence.id);
              const memorized = memorizedSentenceIds.includes(sentence.id);

              return (
                <article className="study-list-row" key={sentence.id}>
                  <div className="study-list-meta">
                    <span>{sentenceIndex + 1}</span>
                    {memorized && <span className="memorized-label"><Check size={14} /> 완료</span>}
                  </div>
                  <p className="study-list-korean">{sentence.korean}</p>
                  {revealed ? (
                    <div className="study-list-answer">
                      <p>{sentence.english}</p>
                      <button disabled={memorized} onClick={() => onMemorized(sentence.id)}>
                        <Check size={17} />
                        {memorized ? '암기 완료' : '외웠어요'}
                      </button>
                    </div>
                  ) : (
                    <button className="list-reveal-button" onClick={() => revealSentence(sentence.id)}>
                      영어 보기
                    </button>
                  )}
                </article>
              );
            })}
          </div>
          <BannerAd placement="study-list" />
        </>
      )}

      {mode === 'challenge' && !challengeItem && !challengeComplete && (
        <div className="challenge-panel">
          <div className="challenge-icon"><Star size={30} /></div>
          <h3>10개를 랜덤으로 외워볼까요?</h3>
          <p>10문장을 끝까지 완료하면 1별을 받아요.</p>
          <button disabled={items.length < 10} onClick={startChallenge}>
            <Star size={19} />
            별 따기 시작
          </button>
          {items.length < 10 && <span>문장을 10개 이상 저장해야 시작할 수 있어요.</span>}
        </div>
      )}

      {mode === 'challenge' && challengeItem && !challengeComplete && (
        <>
          <div className="study-progress">별 따기 {challengeIndex + 1} / 10</div>
          <div className="study-card">
            <span>한국어 뜻</span>
            <p>{challengeItem.korean}</p>
          </div>
          {challengeRevealed ? (
            <div className="answer-card">
              <span>영어 문장</span>
              <p>{challengeItem.english}</p>
            </div>
          ) : (
            <button className="reveal-button" onClick={() => setChallengeRevealed(true)}>정답 보기</button>
          )}
          <button className="memorized-button" disabled={!challengeRevealed} onClick={finishChallengeSentence}>
            <Check size={20} />
            {challengeIndex === 9 ? '완료하고 1별 받기' : '외웠어요'}
          </button>
        </>
      )}

      {mode === 'challenge' && challengeComplete && (
        <div className="challenge-panel challenge-complete">
          <div className="challenge-icon"><Star size={30} fill="currentColor" /></div>
          <strong>+1별 획득</strong>
          <h3>10문장 암기를 완료했어요.</h3>
          <button onClick={startChallenge}>다시 도전</button>
        </div>
      )}
      {mode === 'challenge' && <BannerAd placement="study-challenge" />}
    </section>
  );
}

function EditSheet({
  item,
  onClose,
  onSave,
}: {
  item: SentenceItem;
  onClose: () => void;
  onSave: (english: string, korean: string) => void;
}) {
  const [english, setEnglish] = useState(item.english);
  const [korean, setKorean] = useState(item.korean);

  return (
    <div className="sheet-backdrop">
      <div className="sheet">
        <h2>문장 수정</h2>
        <label className="field">
          <span>영어 문장</span>
          <textarea value={english} onChange={(event) => setEnglish(event.target.value)} rows={4} />
        </label>
        <label className="field">
          <span>한국어 뜻</span>
          <textarea value={korean} onChange={(event) => setKorean(event.target.value)} rows={4} />
        </label>
        <div className="sheet-actions">
          <button onClick={onClose}>취소</button>
          <button onClick={() => onSave(english, korean)} disabled={!english.trim() || !korean.trim()}>
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

function BannerAd({ placement }: { placement: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    let destroyAd: (() => void) | undefined;

    async function attachAd() {
      try {
        const { TossAds } = await import('@apps-in-toss/web-framework');

        if (!TossAds.initialize.isSupported() || !TossAds.attachBanner.isSupported()) {
          return;
        }

        TossAds.initialize({
          callbacks: {
            onInitialized: () => {
              if (isCancelled || !containerRef.current) {
                return;
              }

              const slot = TossAds.attachBanner(tossBannerAdGroupId, containerRef.current, {
                theme: 'light',
                tone: 'grey',
                variant: 'expanded',
                callbacks: {
                  onAdRendered: () => setIsVisible(true),
                  onNoFill: () => setIsVisible(false),
                  onAdFailedToRender: () => setIsVisible(false),
                },
              });
              destroyAd = slot.destroy;
            },
            onInitializationFailed: () => setIsVisible(false),
          },
        });
      } catch {
        setIsVisible(false);
      }
    }

    attachAd();

    return () => {
      isCancelled = true;
      destroyAd?.();
    };
  }, [placement]);

  return <div ref={containerRef} className={isVisible ? 'banner-ad' : 'banner-ad banner-ad-empty'} />;
}

function Header({ title, onBack, action }: { title: string; onBack: () => void; action?: React.ReactNode }) {
  return (
    <header className="header">
      <button onClick={onBack} aria-label="뒤로">
        <ChevronLeft size={22} />
      </button>
      <h2>{title}</h2>
      <div className="header-action">{action}</div>
    </header>
  );
}

function BottomNav({ active, onNavigate }: { active: Tab; onNavigate: (tab: Tab) => void }) {
  const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
    { id: 'home', label: '홈', icon: <Home size={20} /> },
    { id: 'add', label: '추가', icon: <Plus size={20} /> },
    { id: 'import', label: '가져오기', icon: <Upload size={20} /> },
    { id: 'list', label: '목록', icon: <List size={20} /> },
    { id: 'study', label: '암기', icon: <BookOpen size={20} /> },
  ];

  return (
    <nav className="bottom-nav">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={active === tab.id ? 'active' : ''}
          onClick={() => onNavigate(tab.id)}
        >
          {tab.icon}
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
