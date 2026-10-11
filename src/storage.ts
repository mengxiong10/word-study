import type { Catalog, State } from './model';
import { emptyState } from './learning';
export const STORAGE_KEY = 'word-study-v1';
function invalid(): never {
  throw new Error('备份格式或内容无效，现有学习记录未更改。');
}
function object(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === 'object' && !Array.isArray(x);
}
function date(x: unknown): x is string {
  return (
    typeof x === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(x) &&
    !Number.isNaN(Date.parse(x)) &&
    new Date(`${x}T12:00:00`).toISOString().slice(0, 10) === x
  );
}
export function validateState(value: unknown, catalog: Catalog): State {
  if (
    !object(value) ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.attempts) ||
    !object(value.progress) ||
    (value.nextCategory !== 'idiom' && value.nextCategory !== 'word')
  )
    invalid();
  const qs = new Map(catalog.questions.map((q) => [q.id, q]));
  const gs = new Set(catalog.groups.map((g) => g.id));
  const aids = new Set();
  for (const a of value.attempts) {
    if (
      !object(a) ||
      typeof a.id !== 'string' ||
      aids.has(a.id) ||
      typeof a.questionId !== 'string' ||
      !qs.has(a.questionId) ||
      typeof a.selected !== 'number' ||
      !Number.isInteger(a.selected) ||
      a.selected < 0 ||
      a.selected > 3 ||
      typeof a.confident !== 'boolean' ||
      typeof a.at !== 'string' ||
      Number.isNaN(Date.parse(a.at)) ||
      typeof a.mode !== 'string' ||
      !['daily', 'group', 'review', 'selftest'].includes(a.mode) ||
      a.correct !== (a.selected === qs.get(a.questionId)!.answerIndex)
    )
      invalid();
    aids.add(a.id);
  }
  for (const [gid, p] of Object.entries(value.progress))
    if (
      !gs.has(gid) ||
      !object(p) ||
      typeof p.learned !== 'boolean' ||
      typeof p.stage !== 'number' ||
      !Number.isInteger(p.stage) ||
      p.stage < 0 ||
      p.stage > 5 ||
      !date(p.due) ||
      !date(p.lastReviewed)
    )
      invalid();
  const t = value.task;
  if (t !== null) {
    if (
      !object(t) ||
      typeof t.id !== 'string' ||
      typeof t.mode !== 'string' ||
      !['daily', 'group', 'review', 'selftest'].includes(t.mode) ||
      typeof t.phase !== 'string' ||
      !['study', 'quiz', 'results'].includes(t.phase) ||
      (t.groupId !== undefined && (typeof t.groupId !== 'string' || !gs.has(t.groupId))) ||
      !Array.isArray(t.questionIds) ||
      !t.questionIds.length ||
      new Set(t.questionIds).size !== t.questionIds.length ||
      t.questionIds.some((id: unknown) => typeof id !== 'string' || !qs.has(id)) ||
      typeof t.index !== 'number' ||
      !Number.isInteger(t.index) ||
      t.index < 0 ||
      t.index >= t.questionIds.length ||
      typeof t.reviewCount !== 'number' ||
      !Number.isInteger(t.reviewCount) ||
      t.reviewCount < 0 ||
      t.reviewCount > t.questionIds.length ||
      !object(t.choices) ||
      !Array.isArray(t.revealed) ||
      !Array.isArray(t.committed)
    )
      invalid();
    for (const [id, choice] of Object.entries(t.choices))
      if (
        !(t.questionIds as unknown[]).includes(id) ||
        !Number.isInteger(choice) ||
        Number(choice) < 0 ||
        Number(choice) > 3
      )
        invalid();
    for (const list of [t.revealed, t.committed])
      if (
        new Set(list).size !== list.length ||
        list.some(
          (id: string) =>
            !(t.questionIds as unknown[]).includes(id) ||
            (t.choices as Record<string, unknown>)[id] === undefined,
        )
      )
        invalid();
    if (t.phase === 'study' && (!t.groupId || t.index !== t.reviewCount)) invalid();
    for (const id of t.committed) {
      const attempt = value.attempts.find((a: unknown) => object(a) && a.id === `${t.id}:${id}`);
      if (
        !object(attempt) ||
        attempt.questionId !== id ||
        attempt.selected !== (t.choices as Record<string, unknown>)[id] ||
        attempt.mode !== t.mode
      )
        invalid();
    }
    if (
      t.committed.some((id: string) => !aids.has(`${t.id}:${id}`)) ||
      (t.phase === 'results' && t.committed.length !== t.questionIds.length)
    )
      invalid();
  }
  return structuredClone(value) as State;
}
export function readState(catalog: Catalog): { state: State; error?: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return { state: raw ? validateState(JSON.parse(raw), catalog) : emptyState() };
  } catch {
    return {
      state: emptyState(),
      error: '无法读取本机记录。原记录未覆盖，请先导出原始备份或检查浏览器存储设置。',
    };
  }
}
export function makeBackup(state: State) {
  return JSON.stringify(
    { app: 'word-study', schemaVersion: 1, exportedAt: new Date().toISOString(), state },
    null,
    2,
  );
}
export function parseBackup(raw: string, catalog: Catalog): State {
  try {
    const obj = JSON.parse(raw);
    if (!object(obj) || obj.app !== 'word-study' || obj.schemaVersion !== 1) invalid();
    return validateState(obj.state, catalog);
  } catch {
    return invalid();
  }
}
