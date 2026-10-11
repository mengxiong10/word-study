import type { Catalog, State, Task, Category, Question } from './model';
let taskSequence = 0;
export const emptyState = (): State => ({
  schemaVersion: 1,
  attempts: [],
  progress: {},
  task: null,
  nextCategory: 'idiom',
});
export function localDay(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function addDays(day: string, count: number): string {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + count);
  return localDay(d);
}
export function dueGroups(state: State, catalog: Catalog, day = localDay()) {
  return catalog.groups
    .filter((g) => state.progress[g.id]?.due <= day)
    .sort(
      (a, b) =>
        state.progress[a.id].due.localeCompare(state.progress[b.id].due) || a.number - b.number,
    );
}
function rankQuestions(state: State, questions: Question[]) {
  const latest = new Map<string, string>();
  state.attempts.forEach((a) => latest.set(a.questionId, a.at));
  return [...questions].sort(
    (a, b) =>
      Number(latest.has(a.id)) - Number(latest.has(b.id)) ||
      (latest.get(a.id) || '').localeCompare(latest.get(b.id) || '') ||
      Number(a.kind === 'authored') - Number(b.kind === 'authored'),
  );
}
export function createTask(
  state: State,
  catalog: Catalog,
  mode: Task['mode'],
  arg?: string,
  day = localDay(),
  random = Math.random,
): Task | null {
  const id = `task-${Date.now()}-${Math.floor(random() * 1e9)}-${++taskSequence}`;
  let groupId: string | undefined;
  let ids: string[] = [];
  let reviewCount = 0;
  if (mode === 'selftest') {
    const done = new Set(state.attempts.map((a) => a.questionId));
    const candidates = catalog.questions.filter(
      (q) => q.category === (arg || 'idiom') && !q.assessmentExcluded && !done.has(q.id),
    );
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    ids = candidates.slice(0, 10).map((q) => q.id);
  } else {
    if (mode === 'daily' || mode === 'review') {
      ids = dueGroups(state, catalog, day)
        .slice(0, 5)
        .flatMap((g) =>
          rankQuestions(
            state,
            catalog.questions.filter((q) => q.groupIds.includes(g.id) && !q.assessmentExcluded),
          )
            .slice(0, 1)
            .map((q) => q.id),
        );
      ids = [...new Set(ids)];
      reviewCount = ids.length;
    }
    if (mode === 'group') groupId = arg;
    if (mode === 'daily') {
      const next = (category: Category) =>
        catalog.groups.find((g) => g.category === category && !state.progress[g.id]?.learned);
      groupId = (
        next(state.nextCategory) || next(state.nextCategory === 'idiom' ? 'word' : 'idiom')
      )?.id;
    }
    if (groupId)
      ids.push(
        ...rankQuestions(
          state,
          catalog.questions.filter((q) => q.groupIds.includes(groupId!) && !ids.includes(q.id)),
        )
          .slice(0, 3)
          .map((q) => q.id),
      );
  }
  if (!ids.length) return null;
  return {
    id,
    mode,
    ...(groupId ? { groupId } : {}),
    questionIds: ids,
    reviewCount,
    index: 0,
    phase: reviewCount === 0 && groupId ? 'study' : 'quiz',
    choices: {},
    revealed: [],
    committed: [],
  };
}
export function recordAnswer(
  state: State,
  catalog: Catalog,
  questionId: string,
  confident: boolean,
  at = new Date().toISOString(),
): State {
  const task = state.task;
  if (!task || task.committed.includes(questionId)) return state;
  const question = catalog.questions.find((q) => q.id === questionId);
  const selected = task.choices[questionId];
  if (!question || selected === undefined || !task.questionIds.includes(questionId)) return state;
  return {
    ...state,
    attempts: [
      ...state.attempts,
      {
        id: `${task.id}:${questionId}`,
        questionId,
        selected,
        correct: selected === question.answerIndex,
        confident,
        at,
        mode: task.mode,
      },
    ],
    task: { ...task, committed: [...task.committed, questionId] },
  };
}
export function finishTask(state: State, catalog: Catalog, day = localDay()): State {
  const task = state.task;
  if (!task || task.committed.length !== task.questionIds.length || task.phase === 'results')
    return state;
  const progress = { ...state.progress };
  const groupIds = new Set(
    task.questionIds.flatMap((id) => catalog.questions.find((q) => q.id === id)!.groupIds),
  );
  for (const gid of groupIds) {
    const qids = new Set(
      catalog.questions.filter((q) => q.groupIds.includes(gid)).map((q) => q.id),
    );
    const attempts = state.attempts.filter(
      (a) =>
        a.id.startsWith(`${task.id}:`) &&
        qids.has(a.questionId) &&
        !catalog.questions.find((q) => q.id === a.questionId)?.assessmentExcluded,
    );
    if (!attempts.length) continue;
    const passed = attempts.every((a) => a.correct && a.confident);
    const stage = passed ? Math.min((progress[gid]?.stage || 0) + 1, 5) : 0;
    const interval = passed ? [1, 3, 7, 14, 30][stage - 1] : 1;
    progress[gid] = {
      learned: progress[gid]?.learned || gid === task.groupId,
      stage,
      due: addDays(day, interval),
      lastReviewed: day,
    };
  }
  const category = catalog.groups.find((g) => g.id === task.groupId)?.category;
  return {
    ...state,
    progress,
    nextCategory:
      task.mode === 'daily' && category
        ? category === 'idiom'
          ? 'word'
          : 'idiom'
        : state.nextCategory,
    task: { ...task, phase: 'results' },
  };
}
export function firstTestStats(state: State, catalog: Catalog, kind: Question['kind']) {
  const ids = new Set<string>();
  const first = state.attempts.filter((a) => {
    if (ids.has(a.questionId)) return false;
    ids.add(a.questionId);
    return (
      a.mode === 'selftest' &&
      catalog.questions.find((q) => q.id === a.questionId)?.kind === kind &&
      !catalog.questions.find((q) => q.id === a.questionId)?.assessmentExcluded
    );
  });
  return { total: first.length, correct: first.filter((a) => a.correct).length };
}

// 切换任务时，已提交的作答仍需进入复习；未完成新词组不标为已学习。
export function abandonTask(state: State, catalog: Catalog, day = localDay()): State {
  const task = state.task;
  if (!task || task.phase === 'results' || !task.committed.length) return { ...state, task: null };
  const partial = {
    ...task,
    questionIds: [...task.committed],
    index: 0,
    reviewCount: task.committed.length,
    phase: 'quiz' as const,
    groupId: undefined,
  };
  return { ...finishTask({ ...state, task: partial }, catalog, day), task: null };
}
