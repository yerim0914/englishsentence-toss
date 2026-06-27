import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BookOpen,
  Check,
  ChevronLeft,
  Edit3,
  ExternalLink,
  Home,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import {
  SentenceItem,
  createSentence,
  loadSentences,
  parseEnglishSentences,
  saveSentences,
} from './lib/sentences';
import './styles/app.css';

type Tab = 'home' | 'memorize' | 'free' | 'meetup' | 'resources' | 'expression';
type BoardType = 'free' | 'meetup';
type StudyMode = 'add' | 'list' | 'study';
type PostMode = 'list' | 'detail' | 'form';

interface Post {
  id: number;
  boardType: BoardType;
  category: string;
  title: string;
  content: string;
  authorName: string;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

interface DailyExpression {
  id: number;
  expression: string;
  meaning: string;
  example: string;
  date: string;
}

interface ResourceLink {
  id: number;
  name: string;
  url: string;
  description: string;
  category: string;
}

interface PostFormState {
  category: string;
  title: string;
  content: string;
  authorName: string;
  password: string;
}

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787').replace(/\/$/, '');
const freeCategories = ['질문', '자료공유', '후기', '잡담'];
const meetupCategories = ['회화모임', '스터디', '과외', '언어교환'];
const emptyForm: PostFormState = {
  category: '질문',
  title: '',
  content: '',
  authorName: '',
  password: '',
};

function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [sentences, setSentences] = useState<SentenceItem[]>(loadSentences);
  const [posts, setPosts] = useState<Post[]>([]);
  const [resources, setResources] = useState<ResourceLink[]>([]);
  const [dailyExpression, setDailyExpression] = useState<DailyExpression | null>(null);
  const [apiStatus, setApiStatus] = useState('');

  const persistSentences = (next: SentenceItem[]) => {
    setSentences(next);
    saveSentences(next);
  };

  const refreshPosts = async (boardType?: BoardType, q = '', category = '') => {
    const params = new URLSearchParams();
    if (boardType) params.set('boardType', boardType);
    if (q.trim()) params.set('q', q.trim());
    if (category.trim()) params.set('category', category.trim());
    const data = await apiGet<{ posts: Post[] }>(`/api/posts?${params.toString()}`);
    setPosts(data.posts);
    return data.posts;
  };

  const loadPortalData = async () => {
    try {
      const [postData, resourceData, expressionData] = await Promise.all([
        apiGet<{ posts: Post[] }>('/api/posts'),
        apiGet<{ resources: ResourceLink[] }>('/api/resources'),
        apiGet<{ expression: DailyExpression | null }>('/api/daily-expression/today'),
      ]);
      setPosts(postData.posts);
      setResources(resourceData.resources);
      setDailyExpression(expressionData.expression);
      setApiStatus('');
    } catch (error) {
      setApiStatus(getErrorMessage(error));
    }
  };

  useEffect(() => {
    loadPortalData();
  }, []);

  return (
    <main className="app-shell">
      {tab === 'home' && (
        <HomeView
          sentences={sentences}
          posts={posts}
          resources={resources}
          dailyExpression={dailyExpression}
          apiStatus={apiStatus}
          onNavigate={setTab}
        />
      )}
      {tab === 'memorize' && (
        <MemorizeView
          items={sentences}
          onBack={() => setTab('home')}
          onSave={persistSentences}
        />
      )}
      {tab === 'free' && (
        <BoardView
          boardType="free"
          title="자유게시판"
          categories={freeCategories}
          onBack={() => setTab('home')}
          onRefresh={refreshPosts}
        />
      )}
      {tab === 'meetup' && (
        <BoardView
          boardType="meetup"
          title="모여라"
          categories={meetupCategories}
          onBack={() => setTab('home')}
          onRefresh={refreshPosts}
        />
      )}
      {tab === 'resources' && (
        <ResourcesView resources={resources} onBack={() => setTab('home')} />
      )}
      {tab === 'expression' && (
        <ExpressionView expression={dailyExpression} onBack={() => setTab('home')} />
      )}
      <BottomNav active={tab} onNavigate={setTab} />
    </main>
  );
}

function HomeView({
  sentences,
  posts,
  resources,
  dailyExpression,
  apiStatus,
  onNavigate,
}: {
  sentences: SentenceItem[];
  posts: Post[];
  resources: ResourceLink[];
  dailyExpression: DailyExpression | null;
  apiStatus: string;
  onNavigate: (tab: Tab) => void;
}) {
  const latestFree = posts.filter((post) => post.boardType === 'free').slice(0, 3);
  const latestMeetup = posts.filter((post) => post.boardType === 'meetup').slice(0, 3);
  const popular = [...posts].sort((a, b) => b.viewCount - a.viewCount).slice(0, 3);

  return (
    <section className="screen home-screen">
      <section className="hero-panel">
        <div>
          <span className="eyebrow">English Community</span>
          <h1>영어를 같이 모으고, 같이 써먹는 공간</h1>
          <p>문장암기, 질문 게시판, 회화 모임, 과외 모집, 학습 사이트를 한곳에 모았습니다.</p>
        </div>
        <button onClick={() => onNavigate('free')}>
          <MessageSquare size={20} />
          글 보러가기
        </button>
      </section>

      {apiStatus && <div className="notice">서버 연결 확인이 필요해요: {apiStatus}</div>}

      <section className="expression-card" onClick={() => onNavigate('expression')}>
        <span>오늘의 표현</span>
        <strong>{dailyExpression?.expression ?? 'That works for me.'}</strong>
        <p>{dailyExpression?.meaning ?? '저는 그거 괜찮아요.'}</p>
      </section>

      <div className="quick-grid">
        <button onClick={() => onNavigate('memorize')}>
          <BookOpen size={22} />
          <strong>{sentences.length}문장</strong>
          <span>문장암기</span>
        </button>
        <button onClick={() => onNavigate('meetup')}>
          <Users size={22} />
          <strong>모여라</strong>
          <span>회화·스터디·과외</span>
        </button>
        <button onClick={() => onNavigate('resources')}>
          <ExternalLink size={22} />
          <strong>{resources.length}개</strong>
          <span>추천 사이트</span>
        </button>
      </div>

      <PostPreview title="인기 글" posts={popular} emptyText="아직 인기 글이 없습니다." onMore={() => onNavigate('free')} />
      <PostPreview title="자유게시판 최신 글" posts={latestFree} emptyText="첫 자유 글을 남겨보세요." onMore={() => onNavigate('free')} />
      <PostPreview title="모여라 최신 글" posts={latestMeetup} emptyText="첫 모임 글을 남겨보세요." onMore={() => onNavigate('meetup')} />
    </section>
  );
}

function PostPreview({
  title,
  posts,
  emptyText,
  onMore,
}: {
  title: string;
  posts: Post[];
  emptyText: string;
  onMore: () => void;
}) {
  return (
    <section className="section-block">
      <div className="section-heading">
        <h2>{title}</h2>
        <button onClick={onMore}>전체보기</button>
      </div>
      <div className="compact-list">
        {posts.length === 0 && <EmptyState text={emptyText} />}
        {posts.map((post) => (
          <article className="compact-post" key={post.id}>
            <span>{post.category}</span>
            <strong>{post.title}</strong>
            <small>{post.authorName} · 조회 {post.viewCount}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function BoardView({
  boardType,
  title,
  categories,
  onBack,
  onRefresh,
}: {
  boardType: BoardType;
  title: string;
  categories: string[];
  onBack: () => void;
  onRefresh: (boardType: BoardType, q?: string, category?: string) => Promise<Post[]>;
}) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [selected, setSelected] = useState<Post | null>(null);
  const [editing, setEditing] = useState<Post | null>(null);
  const [mode, setMode] = useState<PostMode>('list');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');

  const load = async (nextQuery = query, nextCategory = category) => {
    try {
      setStatus('');
      setPosts(await onRefresh(boardType, nextQuery, nextCategory));
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  };

  useEffect(() => {
    load('', '');
  }, [boardType]);

  const openPost = async (postId: number) => {
    try {
      const data = await apiGet<{ post: Post }>(`/api/posts/${postId}`);
      setSelected(data.post);
      setMode('detail');
      setStatus('');
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  };

  return (
    <section className="screen">
      <Header
        title={title}
        onBack={onBack}
        action={
          <button
            onClick={() => {
              setEditing(null);
              setMode('form');
            }}
            aria-label="글쓰기"
          >
            <Plus size={20} />
          </button>
        }
      />
      {mode === 'list' && (
        <>
          <div className="board-tools">
            <label className="search-box">
              <Search size={18} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="검색어" />
            </label>
            <select
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
                load(query, event.target.value);
              }}
            >
              <option value="">전체</option>
              {categories.map((item) => <option key={item}>{item}</option>)}
            </select>
            <button onClick={() => load(query, category)}>검색</button>
          </div>
          {status && <div className="notice">{status}</div>}
          <div className="post-list">
            {posts.length === 0 && <EmptyState text="게시글이 없습니다." />}
            {posts.map((post) => (
              <button className="post-row" key={post.id} onClick={() => openPost(post.id)}>
                <span>{post.category}</span>
                <strong>{post.title}</strong>
                <small>{post.authorName} · 조회 {post.viewCount} · {formatDate(post.createdAt)}</small>
              </button>
            ))}
          </div>
        </>
      )}
      {mode === 'detail' && selected && (
        <PostDetail
          post={selected}
          onBack={() => {
            setMode('list');
            load();
          }}
          onEdit={() => {
            setEditing(selected);
            setMode('form');
          }}
          onDeleted={() => {
            setSelected(null);
            setMode('list');
            load();
          }}
        />
      )}
      {mode === 'form' && (
        <PostForm
          boardType={boardType}
          categories={categories}
          editing={editing}
          onCancel={() => setMode(editing ? 'detail' : 'list')}
          onSaved={async (postId) => {
            await load();
            await openPost(postId);
          }}
        />
      )}
    </section>
  );
}

function PostDetail({
  post,
  onBack,
  onEdit,
  onDeleted,
}: {
  post: Post;
  onBack: () => void;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');

  const deletePost = async () => {
    try {
      await apiRequest(`/api/posts/${post.id}`, {
        method: 'DELETE',
        body: JSON.stringify({ password }),
      });
      onDeleted();
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  };

  return (
    <article className="post-detail">
      <button className="inline-back" onClick={onBack}>
        <ChevronLeft size={18} />
        목록
      </button>
      <span className="category-pill">{post.category}</span>
      <h2>{post.title}</h2>
      <p className="post-meta">{post.authorName} · 조회 {post.viewCount} · {formatDate(post.createdAt)}</p>
      <div className="post-content">{post.content}</div>
      <div className="danger-zone">
        <label>
          <span>글 비밀번호</span>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        <div className="sheet-actions inline-actions">
          <button onClick={onEdit}>
            <Pencil size={17} />
            수정
          </button>
          <button disabled={password.length < 4} onClick={deletePost}>
            <Trash2 size={17} />
            삭제
          </button>
        </div>
        {status && <p className="form-status">{status}</p>}
      </div>
    </article>
  );
}

function PostForm({
  boardType,
  categories,
  editing,
  onCancel,
  onSaved,
}: {
  boardType: BoardType;
  categories: string[];
  editing: Post | null;
  onCancel: () => void;
  onSaved: (postId: number) => void;
}) {
  const [form, setForm] = useState<PostFormState>({
    ...emptyForm,
    category: editing?.category ?? categories[0],
    title: editing?.title ?? '',
    content: editing?.content ?? '',
    authorName: editing?.authorName ?? '',
    password: '',
  });
  const [status, setStatus] = useState('');
  const canSave = form.title.trim() && form.content.trim() && form.authorName.trim() && form.password.length >= 4;

  const save = async () => {
    try {
      const payload = { ...form, boardType };
      const data = editing
        ? await apiRequest<{ ok: true }>(`/api/posts/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) }).then(() => ({ id: editing.id }))
        : await apiRequest<{ id: number }>('/api/posts', { method: 'POST', body: JSON.stringify(payload) });
      onSaved(data.id);
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  };

  return (
    <div className="post-form">
      <button className="inline-back" onClick={onCancel}>
        <ChevronLeft size={18} />
        돌아가기
      </button>
      <label className="field">
        <span>카테고리</span>
        <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
          {categories.map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>
      <label className="field">
        <span>제목</span>
        <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
      </label>
      <label className="field">
        <span>내용</span>
        <textarea rows={8} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} />
      </label>
      <label className="field">
        <span>작성자</span>
        <input value={form.authorName} onChange={(event) => setForm({ ...form, authorName: event.target.value })} />
      </label>
      <label className="field">
        <span>{editing ? '수정 비밀번호' : '글 비밀번호'}</span>
        <input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
      </label>
      <button className="fixed-button" disabled={!canSave} onClick={save}>
        <Check size={20} />
        저장
      </button>
      {status && <p className="form-status">{status}</p>}
    </div>
  );
}

function MemorizeView({
  items,
  onBack,
  onSave,
}: {
  items: SentenceItem[];
  onBack: () => void;
  onSave: (items: SentenceItem[]) => void;
}) {
  const [mode, setMode] = useState<StudyMode>('add');
  const [english, setEnglish] = useState('');
  const [korean, setKorean] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const parsed = useMemo(() => parseEnglishSentences(bulkText), [bulkText]);
  const current = items[index];

  const addSentence = () => {
    if (!english.trim() || !korean.trim()) return;
    onSave([createSentence(english, korean, 'manual'), ...items]);
    setEnglish('');
    setKorean('');
    setMode('list');
  };

  const addBulkSentences = () => {
    const next = parsed.map((sentence) => createSentence(sentence, '뜻을 입력해 주세요.', 'text'));
    if (next.length === 0) return;
    onSave([...next, ...items]);
    setBulkText('');
    setMode('list');
  };

  return (
    <section className="screen study-screen">
      <Header title="문장암기" onBack={onBack} />
      <div className="study-mode-control" role="group" aria-label="문장암기 메뉴">
        <button className={mode === 'add' ? 'active' : ''} onClick={() => setMode('add')}>
          <Plus size={18} />
          추가
        </button>
        <button className={mode === 'list' ? 'active' : ''} onClick={() => setMode('list')}>
          <Edit3 size={18} />
          목록
        </button>
        <button className={mode === 'study' ? 'active' : ''} onClick={() => setMode('study')}>
          <BookOpen size={18} />
          암기
        </button>
      </div>

      {mode === 'add' && (
        <>
          <label className="field">
            <span>영어 문장</span>
            <textarea rows={3} value={english} onChange={(event) => setEnglish(event.target.value)} />
          </label>
          <label className="field">
            <span>한국어 뜻</span>
            <textarea rows={3} value={korean} onChange={(event) => setKorean(event.target.value)} />
          </label>
          <button className="fixed-button" disabled={!english.trim() || !korean.trim()} onClick={addSentence}>
            <Check size={20} />
            한 문장 저장
          </button>
          <label className="field">
            <span>여러 영어 문장 붙여넣기</span>
            <textarea rows={7} value={bulkText} onChange={(event) => setBulkText(event.target.value)} />
          </label>
          <button className="secondary-button" disabled={parsed.length === 0} onClick={addBulkSentences}>
            {parsed.length}문장 가져오기
          </button>
        </>
      )}

      {mode === 'list' && (
        <div className="sentence-list">
          {items.length === 0 && <EmptyState text="저장된 문장이 없습니다." />}
          {items.map((item) => (
            <article className="sentence-card" key={item.id}>
              <div>
                <p className="english">{item.english}</p>
                <p className="korean">{item.korean}</p>
              </div>
              <button aria-label="삭제" onClick={() => onSave(items.filter((row) => row.id !== item.id))}>
                <Trash2 size={18} />
              </button>
            </article>
          ))}
        </div>
      )}

      {mode === 'study' && (
        <>
          {!current && <EmptyState text="암기할 문장을 먼저 추가하세요." />}
          {current && (
            <>
              <div className="study-progress">{index + 1} / {items.length}</div>
              <div className="study-card">
                <span>한국어 뜻</span>
                <p>{current.korean}</p>
              </div>
              {revealed ? (
                <div className="answer-card">
                  <span>영어 문장</span>
                  <p>{current.english}</p>
                </div>
              ) : (
                <button className="reveal-button" onClick={() => setRevealed(true)}>정답 보기</button>
              )}
              <div className="study-controls">
                <button disabled={index === 0} onClick={() => { setIndex(Math.max(0, index - 1)); setRevealed(false); }}>
                  이전
                </button>
                <button disabled={index === items.length - 1} onClick={() => { setIndex(Math.min(items.length - 1, index + 1)); setRevealed(false); }}>
                  다음
                </button>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}

function ResourcesView({ resources, onBack }: { resources: ResourceLink[]; onBack: () => void }) {
  const grouped = groupBy(resources, (resource) => resource.category);
  return (
    <section className="screen">
      <Header title="추천 영어 사이트" onBack={onBack} />
      {Object.entries(grouped).map(([category, items]) => (
        <section className="section-block" key={category}>
          <div className="section-heading"><h2>{category}</h2></div>
          <div className="resource-grid">
            {items.map((resource) => (
              <a className="resource-card" key={resource.id} href={resource.url} target="_blank" rel="noreferrer">
                <strong>{resource.name}</strong>
                <p>{resource.description}</p>
                <span>
                  열기
                  <ExternalLink size={15} />
                </span>
              </a>
            ))}
          </div>
        </section>
      ))}
    </section>
  );
}

function ExpressionView({ expression, onBack }: { expression: DailyExpression | null; onBack: () => void }) {
  return (
    <section className="screen">
      <Header title="오늘의 표현" onBack={onBack} />
      <article className="daily-detail">
        <Sparkles size={28} />
        <span>{expression?.date ?? new Date().toISOString().slice(0, 10)}</span>
        <h1>{expression?.expression ?? 'That works for me.'}</h1>
        <p>{expression?.meaning ?? '저는 그거 괜찮아요.'}</p>
        <div>
          <strong>Example</strong>
          <em>{expression?.example ?? 'Tuesday at seven works for me.'}</em>
        </div>
      </article>
    </section>
  );
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
    { id: 'memorize', label: '암기', icon: <BookOpen size={20} /> },
    { id: 'free', label: '게시판', icon: <MessageSquare size={20} /> },
    { id: 'meetup', label: '모여라', icon: <Users size={20} /> },
    { id: 'resources', label: '사이트', icon: <ExternalLink size={20} /> },
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

async function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(String((payload as { error?: string }).error ?? `Request failed: ${response.status}`));
  }
  return payload as T;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '요청을 처리하지 못했습니다.';
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' }).format(new Date(value));
}

function groupBy<T>(items: T[], getKey: (item: T) => string): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((groups, item) => {
    const key = getKey(item);
    groups[key] = [...(groups[key] ?? []), item];
    return groups;
  }, {});
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
