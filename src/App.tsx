import { useEffect, useRef, useState } from 'react';
import type { Category, Group, Question, State, Task } from './model';
import { catalog, contrasts, groupMap, questionMap } from './catalog';
import {
  abandonTask,
  createTask,
  dueGroups,
  emptyState,
  finishTask,
  firstTestStats,
  localDay,
  recordAnswer,
} from './learning';
import { makeBackup, parseBackup, readState, STORAGE_KEY, validateState } from './storage';

type Page = 'home' | 'library' | 'review' | 'test' | 'settings';
function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    home: (
      <>
        <path d="m3 10 9-7 9 7v10H3Z" />
        <path d="M9 20v-7h6v7" />
      </>
    ),
    book: (
      <>
        <path d="M12 5v15M3 4c4-1 6 0 9 2 3-2 5-3 9-2v15c-4-1-6 0-9 2-3-2-5-3-9-2Z" />
      </>
    ),
    repeat: (
      <>
        <path d="M20 8a8 8 0 0 0-14-3L3 8m0-5v5h5M4 16a8 8 0 0 0 14 3l3-3m0 5v-5h-5" />
      </>
    ),
    test: (
      <>
        <rect x="5" y="4" width="14" height="17" rx="2" />
        <path d="M9 4V2h6v2M9 10l2 2 4-4M9 16h6" />
      </>
    ),
    settings: (
      <>
        <path d="M4 7h16M4 17h16" />
        <circle cx="9" cy="7" r="3" />
        <circle cx="15" cy="17" r="3" />
      </>
    ),
    arrow: (
      <>
        <path d="M4 12h16m-6-6 6 6-6 6" />
      </>
    ),
    check: <path d="m5 12 4 4 10-10" />,
    search: (
      <>
        <circle cx="10" cy="10" r="6" />
        <path d="m15 15 5 5" />
      </>
    ),
    chevron: <path d="m9 5 7 7-7 7" />,
    back: <path d="m14 5-7 7 7 7" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V4m-5 5 5-5 5 5M4 17v4h16v-4" />
      </>
    ),
    leaf: (
      <>
        <path d="M20 3c-9-1-17 3-16 10s12 9 16-10Z" />
        <path d="m4 20 12-12" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.book}
    </svg>
  );
}
const labels = { idiom: '成语', word: '实词' };
const alphabet = ['A', 'B', 'C', 'D'];
function Source({ question, group }: { question?: Question; group?: Group }) {
  const s = question?.source || group?.source;
  return (
    <span className="source">
      {s
        ? `${s.book.includes('上册') ? '上册' : '下册'} · PDF 第 ${s.page} 页${question?.source ? ` · 例题 ${question.source.number}` : ''}`
        : '依据词组编写 · 原创练习'}
    </span>
  );
}
function Explanation({ question }: { question: Question }) {
  return (
    <div className="explanation">
      {question.editorialNote && (
        <div className="editorial-note">
          <b>资料核对提示</b>
          <p>{question.editorialNote}</p>
        </div>
      )}
      <div className="eyebrow">新增解题说明 · 依据词义与题干编写</div>
      <h3>先找到语境里的线索</h3>
      <p>{question.explanation.clue}</p>
      <div className="correct-reason">
        <b>正确选项 {alphabet[question.answerIndex]}</b>
        <p>{question.explanation.correctReason}</p>
      </div>
      <details>
        <summary>逐项辨析</summary>
        <div className="option-reasons">
          {question.options.map((option, i) => (
            <div key={i}>
              <b className={i === question.answerIndex ? 'green' : ''}>
                {alphabet[i]} · {option}
              </b>
              <p>{question.explanation.optionReasons[i]}</p>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
function Study({ group, onStart }: { group: Group; onStart: () => void }) {
  const contrast = contrasts[group.id];
  return (
    <section className="study">
      <div className="eyebrow">
        辨析手记 / {labels[group.category]} · 第 {String(group.number).padStart(2, '0')} 组
      </div>
      <h1>{group.title}</h1>
      <Source group={group} />
      <div className="study-intro">
        <span className="mini-label">本组辨析</span>
        <p>
          {contrast?.summary ||
            '阅读词义和例句，注意适用对象、搭配、语义侧重与感情色彩，再进入语境练习。'}
        </p>
      </div>
      {contrast?.distinctions?.length > 0 && (
        <div className="distinctions">
          {contrast.distinctions.map((d, i) => (
            <p key={i}>
              <b>{d.term}</b>
              <span>{d.note}</span>
            </p>
          ))}
        </div>
      )}
      <div className="section-heading">
        <h2>把词放回语境</h2>
        <span>{group.terms?.length || group.wordCount} 个词条 · 资料原文</span>
      </div>
      <div className="terms">
        {group.terms?.map((term, i) => (
          <article className="term" key={`${term.word}-${i}`}>
            <span className="term-number">{String(i + 1).padStart(2, '0')}</span>
            <div>
              <h3>{term.word}</h3>
              <p>{term.definition}</p>
              {term.examples.length > 0 && (
                <details>
                  <summary>查看 {term.examples.length} 条例句</summary>
                  {term.examples.map((ex, j) => (
                    <blockquote key={j}>{ex}</blockquote>
                  ))}
                </details>
              )}
            </div>
          </article>
        )) || <p className="raw-text">{group.studyText}</p>}
      </div>
      <div className="study-action">
        <p>理解区别后，用选择题检验一下。</p>
        <button className="primary" onClick={onStart}>
          开始语境练习 <Icon name="arrow" />
        </button>
      </div>
    </section>
  );
}
export default function App() {
  const [loaded] = useState(() => readState(catalog));
  const [state, setState] = useState<State>(loaded.state);
  const [locked, setLocked] = useState(!!loaded.error);
  const [message, setMessage] = useState(loaded.error || '');
  const [page, setPage] = useState<Page>('home');
  const [showTask, setShowTask] = useState(
    !!loaded.state.task && loaded.state.task.phase !== 'results',
  );
  const [category, setCategory] = useState<Category>('idiom');
  const [search, setSearch] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [day, setDay] = useState(localDay());
  const fileRef = useRef<HTMLInputElement>(null);
  const due = dueGroups(state, catalog, day);
  const learned = catalog.groups.filter((g) => state.progress[g.id]?.learned).length;
  const assessed = state.attempts.filter((a) => !questionMap.get(a.questionId)?.assessmentExcluded);
  const correct = assessed.filter((a) => a.correct).length;
  const next =
    catalog.groups.find(
      (g) => g.category === state.nextCategory && !state.progress[g.id]?.learned,
    ) || catalog.groups.find((g) => !state.progress[g.id]?.learned);
  function update(nextState: State, force = false) {
    if (locked && !force) {
      setMessage('请先备份原始记录，再导入有效备份或清空记录以恢复保存。');
      return false;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
      setState(nextState);
      if (force) setLocked(false);
      return true;
    } catch {
      setMessage('浏览器无法保存进度，本次操作未写入。请检查存储空间或隐私设置。');
      return false;
    }
  }
  useEffect(() => {
    const timer = setInterval(() => setDay(localDay()), 30000);
    function sync(e: StorageEvent) {
      if (e.key !== STORAGE_KEY) return;
      try {
        setState(e.newValue ? validateState(JSON.parse(e.newValue), catalog) : emptyState());
        setLocked(false);
        setMessage('学习记录已与另一个标签页同步。');
      } catch {
        setLocked(true);
        setMessage('另一个标签页的记录无法读取，请检查备份。');
      }
    }
    window.addEventListener('storage', sync);
    return () => {
      clearInterval(timer);
      window.removeEventListener('storage', sync);
    };
  }, []);
  function navigate(p: Page) {
    setPage(p);
    setShowTask(false);
    setPreview(null);
    window.scrollTo(0, 0);
  }
  function start(mode: Task['mode'], arg?: string) {
    if (
      state.task &&
      state.task.phase !== 'results' &&
      !window.confirm(
        '当前还有未完成的任务。切换会放弃任务中的未提交作答，已保存的答题记录会保留。继续吗？',
      )
    )
      return;
    const base = abandonTask(state, catalog, day);
    const task = createTask(base, catalog, mode, arg, day);
    if (!task) {
      setMessage(
        mode === 'selftest'
          ? '这个类别已没有未做题，可以到词组目录继续练习。'
          : mode === 'review'
            ? '今天没有到期词组，明天再来看看。'
            : '所有词组都已学习，今天也没有到期复习。可选择词组继续练习。',
      );
      return;
    }
    if (!update({ ...base, task })) return;
    setShowTask(true);
    setPreview(null);
    window.scrollTo(0, 0);
  }
  function exportBackup() {
    try {
      const raw = locked ? localStorage.getItem(STORAGE_KEY) : null;
      const blob = new Blob([raw || makeBackup(state)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `词间学习备份-${day}${locked ? '-原始记录' : ''}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage('备份已导出，请保存在浏览器以外的位置。');
    } catch {
      setMessage('浏览器无法读取或导出记录，请检查浏览器的存储与下载设置。');
    }
  }
  async function importBackup(file: File) {
    try {
      const incoming = parseBackup(await file.text(), catalog);
      if (
        !window.confirm(
          `导入 ${incoming.attempts.length} 条答题记录，并替换本机现有进度？建议先导出备份。`,
        )
      )
        return;
      if (!update(incoming, true)) return;
      setShowTask(false);
      setPreview(null);
      setMessage('备份已恢复，可以继续学习。');
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }
  const task = state.task;
  function setTask(partial: Partial<Task>) {
    if (task) update({ ...state, task: { ...task, ...partial } });
  }
  function rate(confident: boolean) {
    if (!task) return;
    let changed = recordAnswer(state, catalog, task.questionIds[task.index], confident);
    if (!changed.task) return;
    if (task.index === task.questionIds.length - 1) {
      changed = finishTask(changed, catalog, day);
    } else {
      changed = {
        ...changed,
        task: {
          ...changed.task,
          index: task.index + 1,
          phase: task.groupId && task.index + 1 === task.reviewCount ? 'study' : 'quiz',
        },
      };
    }
    update(changed);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function submitTest() {
    if (!task || task.questionIds.some((id) => task.choices[id] === undefined)) return;
    let changed = state;
    task.questionIds.forEach((id) => {
      changed = recordAnswer(changed, catalog, id, true);
    });
    update(finishTask(changed, catalog, day));
    window.scrollTo(0, 0);
  }
  const navs: { id: Page; label: string; icon: string }[] = [
    { id: 'home', label: '今日学习', icon: 'home' },
    { id: 'library', label: '词组目录', icon: 'book' },
    { id: 'review', label: '间隔复习', icon: 'repeat' },
    { id: 'test', label: '未做题自测', icon: 'test' },
  ];
  function renderTask() {
    if (!task) return null;
    if (task.phase === 'study' && task.groupId)
      return (
        <Study group={groupMap.get(task.groupId)!} onStart={() => setTask({ phase: 'quiz' })} />
      );
    if (task.phase === 'results') {
      const attempts = state.attempts.filter((a) => a.id.startsWith(`${task.id}:`));
      const assessedAttempts = attempts.filter(
        (a) => !questionMap.get(a.questionId)?.assessmentExcluded,
      );
      const hit = assessedAttempts.filter((a) => a.correct).length;
      return (
        <section className="results">
          <div className="eyebrow">本次学习完成</div>
          <h1>
            {hit === assessedAttempts.length ? '每一次辨析，都在积累。' : '找到薄弱处，就是进步。'}
          </h1>
          <div className="result-score">
            <strong>
              {hit}
              <small> / {assessedAttempts.length}</small>
            </strong>
            <span>答对题数</span>
          </div>
          <p>相关词组已安排下一次复习。答错或拿不准的内容，明天会更早出现。</p>
          <button className="primary" onClick={() => navigate('home')}>
            回到今日学习 <Icon name="arrow" />
          </button>
          <div className="section-heading">
            <h2>本次题目回顾</h2>
            <span>展开查看解析</span>
          </div>
          {attempts.map((a) => {
            const q = questionMap.get(a.questionId)!;
            return (
              <details className="result-detail" key={a.id}>
                <summary>
                  <span className={`answer-mark ${a.correct ? 'correct' : 'incorrect'}`}>
                    {a.correct ? '✓' : '×'}
                  </span>
                  <span>{q.stem}</span>
                  <Icon name="chevron" />
                </summary>
                <p className="answer-summary">
                  你的答案：{alphabet[a.selected]} · {q.options[a.selected]}
                  <br />
                  正确答案：{alphabet[q.answerIndex]} · {q.options[q.answerIndex]}
                  {!a.confident && (
                    <>
                      <br />
                      本题反馈：仍拿不准
                    </>
                  )}
                </p>
                <Source question={q} />
                <Explanation question={q} />
              </details>
            );
          })}
        </section>
      );
    }
    const q = questionMap.get(task.questionIds[task.index])!;
    const chosen = task.choices[q.id];
    const revealed = task.revealed.includes(q.id);
    const selftest = task.mode === 'selftest';
    return (
      <section className="quiz">
        <div className="quiz-heading">
          <span className="eyebrow">
            {selftest ? '未做题自测' : task.index < task.reviewCount ? '到期复习' : '语境练习'}
          </span>
          <span>
            {task.index + 1} / {task.questionIds.length}
          </span>
        </div>
        <div className="progress-track">
          <div style={{ width: `${((task.index + 1) / task.questionIds.length) * 100}%` }} />
        </div>
        <div className="question-meta">
          <span className={`tag ${q.kind === 'authored' ? 'orange' : ''}`}>
            {q.kind === 'original' ? '资料原题' : '原创练习'}
          </span>
          <span>
            {labels[q.category]} · {q.groupIds.map((id) => groupMap.get(id)?.title).join(' / ')}
          </span>
        </div>
        <h1 className="question-stem">{q.stem}</h1>
        {q.editorialNote && (
          <div className="editorial-note">
            <b>资料核对提示 · 本题不计掌握成绩</b>
            <p>{q.editorialNote}</p>
          </div>
        )}
        <div className="options" role="group" aria-label="答案选项">
          {q.options.map((option, i) => (
            <button
              key={i}
              disabled={revealed}
              aria-pressed={chosen === i}
              className={`option ${chosen === i ? 'selected' : ''} ${revealed && i === q.answerIndex ? 'right' : ''} ${revealed && chosen === i && i !== q.answerIndex ? 'wrong' : ''}`}
              onClick={() => setTask({ choices: { ...task.choices, [q.id]: i } })}
            >
              <span>{alphabet[i]}</span>
              <p>{option}</p>
              {revealed && i === q.answerIndex && <Icon name="check" />}
            </button>
          ))}
        </div>
        <Source question={q} />
        {!revealed && !selftest && (
          <button
            className="primary quiz-submit"
            disabled={chosen === undefined}
            onClick={() => setTask({ revealed: [...task.revealed, q.id] })}
          >
            确认答案 <Icon name="arrow" />
          </button>
        )}
        {selftest && (
          <div className="test-controls">
            <button
              className="secondary"
              disabled={task.index === 0}
              onClick={() => setTask({ index: task.index - 1 })}
            >
              上一题
            </button>
            {task.index < task.questionIds.length - 1 ? (
              <button
                className="primary"
                disabled={chosen === undefined}
                onClick={() => {
                  setTask({ index: task.index + 1 });
                  window.scrollTo(0, 0);
                }}
              >
                下一题 <Icon name="arrow" />
              </button>
            ) : (
              <button
                className="primary"
                disabled={task.questionIds.some((id) => task.choices[id] === undefined)}
                onClick={submitTest}
              >
                交卷并查看解析
              </button>
            )}
          </div>
        )}
        {revealed && (
          <>
            <div className={`feedback-strip ${chosen === q.answerIndex ? 'good' : 'bad'}`}>
              {chosen === q.answerIndex
                ? '选对了，再确认一下你的理解。'
                : `正确答案是 ${alphabet[q.answerIndex]}。看看语境的关键在哪里。`}
            </div>
            <Explanation question={q} />
            <div className="confidence">
              <p>看过解析后，你能区分这些词了吗？</p>
              <div>
                <button className="secondary" onClick={() => rate(false)}>
                  仍拿不准
                </button>
                <button className="primary" onClick={() => rate(true)}>
                  已理解{task.index === task.questionIds.length - 1 ? '，完成' : '，继续'}{' '}
                  <Icon name="arrow" />
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    );
  }
  function renderHome() {
    return (
      <>
        <header className="page-heading">
          <div>
            <div className="eyebrow">一点积累，日有所进</div>
            <h1>
              今日学习<span className="heading-dot">。</span>
            </h1>
          </div>
          <span className="date">
            {new Date().toLocaleDateString('zh-CN', {
              month: 'long',
              day: 'numeric',
              weekday: 'long',
            })}
          </span>
        </header>
        <div className="home-columns">
          <div>
            <section className="hero">
              <div className="hero-top">
                <span className="tag">词义 → 语境 → 选择</span>
                <span className="hero-index">01 / 日常研习</span>
              </div>
              <h2>
                把意思记住，
                <br />
                把词选对。
              </h2>
              <p>
                不只认识一个词，更知道什么时候用它。
                <br className="desktop-break" />
                从一组易混词开始，练出语境中的判断力。
              </p>
              <button
                className="primary"
                onClick={() =>
                  state.task && state.task.phase !== 'results'
                    ? (setShowTask(true), window.scrollTo(0, 0))
                    : start('daily')
                }
              >
                {state.task && state.task.phase !== 'results' ? '继续上次学习' : '开始今日学习'}
                <Icon name="arrow" />
              </button>
              <div className="hero-foot">
                <span>
                  <Icon name="clock" size={15} />约 5–15 分钟
                </span>
                <span>最多 5 道复习 · 1 组新词 · 3 道练习</span>
              </div>
              <div className="hero-art" aria-hidden="true">
                <span>词</span>
                <i />
                <b>辨其义 · 知其用</b>
              </div>
            </section>
            <section className="overview">
              <div className="section-heading">
                <h2>你的积累</h2>
                <span>每一小步都算数</span>
              </div>
              <div className="metrics">
                <div>
                  <span>已学习词组</span>
                  <strong>
                    {learned}
                    <small> / 81</small>
                  </strong>
                  <div className="tiny-track">
                    <i style={{ width: `${(learned / 81) * 100}%` }} />
                  </div>
                </div>
                <div>
                  <span>练习正确率</span>
                  <strong>
                    {assessed.length ? Math.round((correct / assessed.length) * 100) : '—'}
                    <small>{assessed.length ? ' %' : ''}</small>
                  </strong>
                  <p>{assessed.length} 次有效作答</p>
                </div>
                <div>
                  <span>今日待复习</span>
                  <strong>
                    {due.length}
                    <small> 组</small>
                  </strong>
                  <p>换一个语境，再检验一次</p>
                </div>
              </div>
            </section>
            <section className="next-section">
              <div className="section-heading">
                <h2>下一组，学什么</h2>
                <button className="text-button" onClick={() => navigate('library')}>
                  查看全部 <Icon name="arrow" size={15} />
                </button>
              </div>
              {next ? (
                <button className="next-group" onClick={() => setPreview(next.id)}>
                  <span className="group-seal">{labels[next.category]}</span>
                  <div>
                    <span className="eyebrow">
                      第 {String(next.number).padStart(2, '0')} 组 · {next.terms?.length} 个词条
                    </span>
                    <h3>{next.title}</h3>
                    <p>
                      {next.terms
                        ?.slice(0, 5)
                        .map((t) => t.word)
                        .join(' / ')}
                    </p>
                  </div>
                  <Icon name="chevron" />
                </button>
              ) : (
                <div className="empty">所有词组都已学习。去复习，看看是否仍能选对。</div>
              )}
            </section>
          </div>
          <aside className="home-aside">
            <section className="review-aside">
              <div className="aside-icon">
                <Icon name="repeat" size={25} />
              </div>
              <h2>让记忆，多停留一会儿。</h2>
              <p>答错或拿不准的词组，会更早回到你的练习里。</p>
              <div className="review-number">
                <strong>{due.length}</strong>
                <span>组词语到期</span>
              </div>
              <button className="secondary" onClick={() => navigate('review')}>
                {due.length ? '去复习' : '查看复习安排'}
                <Icon name="arrow" size={17} />
              </button>
            </section>
            <section className="method-note">
              <span className="eyebrow">词间的方法</span>
              <div>
                <span>01</span>
                <p>
                  <b>先看区别</b>抓住词义侧重与搭配。
                </p>
              </div>
              <div>
                <span>02</span>
                <p>
                  <b>再看语境</b>用题干线索排除干扰项。
                </p>
              </div>
              <div>
                <span>03</span>
                <p>
                  <b>换题重逢</b>记住区别，而不只记答案。
                </p>
              </div>
            </section>
            <div className="collection-note">
              <Icon name="book" size={17} />
              <span>
                两册资料 · 81 个词组
                <br />
                204 道原题 + 243 道原创练习
              </span>
            </div>
          </aside>
        </div>
      </>
    );
  }
  function renderLibrary() {
    const groups = catalog.groups.filter(
      (g) => g.category === category && (!search || `${g.title} ${g.studyText}`.includes(search)),
    );
    return (
      <>
        <div className="eyebrow">按主题，建立词义之间的联系</div>
        <h1>
          词组目录<span className="heading-dot">。</span>
        </h1>
        <div className="library-tools">
          <div className="tabs">
            {(['idiom', 'word'] as Category[]).map((c) => (
              <button
                key={c}
                className={category === c ? 'active' : ''}
                onClick={() => setCategory(c)}
              >
                {labels[c]} <span>{c === 'idiom' ? 67 : 14}</span>
              </button>
            ))}
          </div>
          <label className="search">
            <Icon name="search" size={18} />
            <input
              aria-label="搜索词语或主题"
              placeholder="搜索词语或主题"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        <p className="muted">按资料原顺序整理 · 共 {groups.length} 组 · 点击进入辨析与练习</p>
        <div className="group-list">
          {groups.map((g) => (
            <button key={g.id} className="group-row" onClick={() => setPreview(g.id)}>
              <span className="row-number">{String(g.number).padStart(2, '0')}</span>
              <div>
                <h3>{g.title}</h3>
                <p>
                  {g.terms
                    ?.slice(0, 6)
                    .map((t) => t.word)
                    .join(' / ')}
                </p>
              </div>
              <span className={`status ${state.progress[g.id]?.learned ? 'learned' : ''}`}>
                {state.progress[g.id]?.learned ? '已学习' : `${g.terms?.length} 词`}
              </span>
              <Icon name="chevron" size={17} />
            </button>
          ))}
        </div>
        {!groups.length && <div className="empty">没有找到相关词组，试试另一个词。</div>}
      </>
    );
  }
  function renderReview() {
    const pending = catalog.groups
      .filter((g) => state.progress[g.id])
      .sort((a, b) => state.progress[a.id].due.localeCompare(state.progress[b.id].due));
    return (
      <>
        <div className="eyebrow">给记忆一次再次遇见的机会</div>
        <h1>
          间隔复习<span className="heading-dot">。</span>
        </h1>
        <div className="intro-panel">
          <Icon name="repeat" size={28} />
          <div>
            <h2>{due.length ? `今天有 ${due.length} 组词语等你复习` : '今天没有到期的词组'}</h2>
            <p>每次最多 5 道题，优先换一道题检验同组词语。答错或拿不准，次日再见。</p>
          </div>
          {due.length > 0 && (
            <button className="primary" onClick={() => start('review')}>
              开始复习 <Icon name="arrow" />
            </button>
          )}
        </div>
        <div className="section-heading">
          <h2>复习日历</h2>
          <span>1 → 3 → 7 → 14 → 30 天</span>
        </div>
        {pending.length ? (
          <div className="group-list">
            {pending.map((g) => (
              <button className="group-row" key={g.id} onClick={() => setPreview(g.id)}>
                <span className="group-seal small">{labels[g.category]}</span>
                <div>
                  <h3>{g.title}</h3>
                  <p>
                    {state.progress[g.id].stage === 0
                      ? '需要巩固'
                      : `连续掌握 ${state.progress[g.id].stage} 次`}{' '}
                    · 上次 {state.progress[g.id].lastReviewed}
                  </p>
                </div>
                <span className={state.progress[g.id].due <= day ? 'due-label' : 'muted'}>
                  {state.progress[g.id].due <= day ? '已到期' : state.progress[g.id].due}
                </span>
                <Icon name="chevron" size={17} />
              </button>
            ))}
          </div>
        ) : (
          <div className="empty">
            <Icon name="leaf" size={34} />
            <h3>从第一组词开始积累</h3>
            <p>完成一次学习后，复习安排会出现在这里。</p>
            <button className="text-button" onClick={() => start('daily')}>
              开始今日学习 <Icon name="arrow" size={16} />
            </button>
          </div>
        )}
      </>
    );
  }
  function renderTest() {
    return (
      <>
        <div className="eyebrow">用陌生语境，检验真正的理解</div>
        <h1>
          未做题自测<span className="heading-dot">。</span>
        </h1>
        <p className="page-description">
          抽取未作答过的题目，最多 10 道。交卷前不展示答案，
          <br />
          首次成绩独立记录，帮助你观察语境判断能力。
        </p>
        <div className="test-categories">
          {(['idiom', 'word'] as Category[]).map((c) => {
            const done = new Set(state.attempts.map((a) => a.questionId));
            const count = catalog.questions.filter(
              (q) => q.category === c && !q.assessmentExcluded && !done.has(q.id),
            ).length;
            return (
              <section key={c}>
                <span className="test-char">{c === 'idiom' ? '成' : '实'}</span>
                <h2>{labels[c]}自测</h2>
                <p>
                  剩余 {count} 道未做题{count < 10 && count > 0 ? ` · 本次 ${count} 道` : ''}
                </p>
                <button className="primary" disabled={!count} onClick={() => start('selftest', c)}>
                  {count ? '开始自测' : '已完成全部题目'}
                  <Icon name="arrow" />
                </button>
              </section>
            );
          })}
        </div>
        <div className="section-heading">
          <h2>首次自测成绩</h2>
          <span>与日常重复练习分开统计</span>
        </div>
        <div className="metrics test-metrics">
          {(['original', 'authored'] as const).map((kind) => {
            const s = firstTestStats(state, catalog, kind);
            return (
              <div key={kind}>
                <span>{kind === 'original' ? '资料原题' : '原创练习'}</span>
                <strong>
                  {s.total ? Math.round((s.correct / s.total) * 100) : '—'}
                  <small>{s.total ? ' %' : ''}</small>
                </strong>
                <p>
                  {s.correct} 道答对 / {s.total} 道首次自测
                </p>
              </div>
            );
          })}
        </div>
      </>
    );
  }
  function renderSettings() {
    return (
      <>
        <div className="eyebrow">把积累，好好保存</div>
        <h1>
          学习记录<span className="heading-dot">。</span>
        </h1>
        <p className="page-description">
          进度只保存在当前浏览器，无需注册。换设备或清理浏览器前，
          <br />
          请导出备份；手机和电脑不会自动同步。
        </p>
        <div className="backup-actions">
          <section>
            <Icon name="download" size={25} />
            <h2>{locked ? '导出原始记录' : '导出备份'}</h2>
            <p>
              {state.attempts.length} 条作答记录 · {learned} 个已学词组
            </p>
            <button className="primary" onClick={exportBackup}>
              下载 JSON 备份
            </button>
          </section>
          <section>
            <Icon name="upload" size={25} />
            <h2>恢复备份</h2>
            <p>支持恢复进度、复习安排和未完成任务。</p>
            <button className="secondary" onClick={() => fileRef.current?.click()}>
              选择备份文件
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importBackup(f);
              }}
            />
          </section>
        </div>
        <div className="section-heading">
          <h2>资料与说明</h2>
        </div>
        <div className="about-copy">
          <p>
            学习内容来自 data 中《高频成语实词1000词》上下册及例题答案，整理为 81 组、993
            个词条条目、204 道原题。书名中的“1000词”与逐组标注合计数量不同，本站按资料实际内容收录。
          </p>
          <p>
            243 道原创练习、词组辨析和逐题解析为新增内容，均与资料原文明确区分。原题页码使用 PDF
            物理页码，答案依据配套答案文件。实词第 14 组原资料没有例题，本站提供原创练习。
          </p>
          <p>
            练习正确率反映所有已提交作答；未做题自测只统计首次作答且进入自测的题。有争议的资料题会标明核对提示，不纳入自测、正确率或掌握判定。正确率不等同于实际考试成绩。
          </p>
        </div>
        <div className="danger-zone">
          <div>
            <h3>清空本机记录</h3>
            <p>清空后无法恢复，请先导出备份。</p>
          </div>
          <button
            className="danger-button"
            onClick={() => {
              if (
                window.confirm('确定清空全部本机学习记录？此操作无法撤销，请先导出备份。') &&
                update(emptyState(), true)
              ) {
                setShowTask(false);
                setMessage('本机记录已清空。');
              }
            }}
          >
            清空记录
          </button>
        </div>
      </>
    );
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => navigate('home')}>
          <span className="brand-seal">词</span>
          <span>
            词间<small>考公词语研习</small>
          </span>
        </button>
        <div className="sidebar-label">学习工作台</div>
        <nav>
          {navs.map((n) => (
            <button
              key={n.id}
              className={page === n.id && !showTask ? 'active' : ''}
              onClick={() => navigate(n.id)}
            >
              <Icon name={n.icon} />
              <span>{n.label}</span>
              {n.id === 'review' && due.length > 0 && <small>{due.length}</small>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="personal-note">
            <span className="online-dot" />
            <div>
              个人学习空间<small>本机保存 · 无需登录</small>
            </div>
          </div>
          <button
            className={`settings-nav ${page === 'settings' ? 'active' : ''}`}
            onClick={() => navigate('settings')}
          >
            <Icon name="settings" />
            <span>记录与备份</span>
          </button>
          <p>辨其义，知其用。</p>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span>
            词间{' '}
            <span className="breadcrumb">
              / {showTask ? '学习中' : navs.find((n) => n.id === page)?.label || '记录与备份'}
            </span>
          </span>
          <button className="local-status" onClick={() => navigate('settings')}>
            <span className="online-dot" />
            {locked ? '记录需恢复' : '进度保存在本机'}
            <Icon name="settings" size={16} />
          </button>
        </header>
        <main>
          {message && (
            <div className="notice" role="status">
              <span>{message}</span>
              <button aria-label="关闭提示" onClick={() => setMessage('')}>
                ×
              </button>
            </div>
          )}
          {locked && (
            <div className="storage-warning">
              学习记录暂时无法保存。请到“记录与备份”导出原始记录，再恢复备份。
              <button className="text-button" onClick={() => navigate('settings')}>
                查看记录
              </button>
            </div>
          )}
          {(showTask || preview) && (
            <button
              className="back-link"
              onClick={() => {
                setShowTask(false);
                setPreview(null);
              }}
            >
              <Icon name="back" size={16} />
              返回学习工作台{showTask && task?.phase !== 'results' && <span>进度自动保存</span>}
            </button>
          )}
          {preview ? (
            <Study group={groupMap.get(preview)!} onStart={() => start('group', preview)} />
          ) : showTask ? (
            renderTask()
          ) : page === 'home' ? (
            renderHome()
          ) : page === 'library' ? (
            renderLibrary()
          ) : page === 'review' ? (
            renderReview()
          ) : page === 'test' ? (
            renderTest()
          ) : (
            renderSettings()
          )}
          <footer>
            <span>词间 · 在语境中积累判断力</span>
            <span>成语与实词 / 研习手记</span>
          </footer>
        </main>
      </div>
      <nav className="mobile-nav">
        {navs.map((n) => (
          <button
            className={page === n.id && !showTask ? 'active' : ''}
            key={n.id}
            onClick={() => navigate(n.id)}
          >
            <Icon name={n.icon} />
            <span>
              {n.id === 'test'
                ? '自测'
                : n.id === 'library'
                  ? '词组'
                  : n.id === 'review'
                    ? '复习'
                    : '今日'}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}
