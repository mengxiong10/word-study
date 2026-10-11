import test from 'node:test';
import assert from 'node:assert/strict';
import {
  abandonTask,
  addDays,
  createTask,
  dueGroups,
  emptyState,
  finishTask,
  firstTestStats,
  recordAnswer,
} from '../src/learning';
import { makeBackup, parseBackup, validateState } from '../src/storage';
import type { Catalog, State } from '../src/model';
const explanation = {
  clue: '语境线索',
  correctReason: '语义匹配',
  optionReasons: ['正确', '不匹配', '不匹配', '不匹配'],
};
const catalog: Catalog = {
  groups: [
    {
      id: 'i1',
      category: 'idiom',
      number: 1,
      title: '文化',
      studyText: '词义',
      source: { book: '上册', page: 1 },
    },
    {
      id: 'i2',
      category: 'idiom',
      number: 2,
      title: '创新',
      studyText: '词义',
      source: { book: '上册', page: 2 },
    },
    {
      id: 'w1',
      category: 'word',
      number: 1,
      title: '关系',
      studyText: '词义',
      source: { book: '下册', page: 3 },
    },
  ],
  questions: ['i1', 'i2', 'w1'].flatMap((gid) =>
    Array.from({ length: 4 }, (_, i) => ({
      id: `${gid}-${i}`,
      kind: i === 0 ? ('original' as const) : ('authored' as const),
      category: gid === 'w1' ? ('word' as const) : ('idiom' as const),
      groupIds: [gid],
      stem: '选择合适词语',
      options: ['甲', '乙', '丙', '丁'],
      answerIndex: 0,
      explanation,
    })),
  ),
};
const day = '2026-10-11';
function completed(
  group = 'i1',
  answers = [0, 0, 0],
  confidence = true,
  state = emptyState(),
): State {
  const task = createTask(state, catalog, 'group', group, day, () => 0.5)!;
  let s = {
    ...state,
    task: {
      ...task,
      phase: 'quiz' as const,
      choices: Object.fromEntries(task.questionIds.map((id, i) => [id, answers[i]])),
    },
  };
  for (const id of task.questionIds)
    s = recordAnswer(s, catalog, id, confidence, `${day}T12:00:00.000Z`) as typeof s;
  return finishTask(s, catalog, day);
}
// 三道同组题只推进一次，防止把短期记忆误认为长期掌握。
test('同组全对且理解只推进一个复习阶段', () => {
  const s = completed();
  assert.equal(s.progress.i1.stage, 1);
  assert.equal(s.progress.i1.due, '2026-10-12');
  assert.equal(s.attempts.length, 3);
});
test('任意一道错题使本组次日复习', () => {
  const s = completed('i1', [0, 1, 0]);
  assert.equal(s.progress.i1.stage, 0);
  assert.equal(s.progress.i1.due, '2026-10-12');
});
test('猜对但拿不准不能延长间隔', () => {
  const s = completed('i1', [0, 0, 0], false);
  assert.equal(s.progress.i1.stage, 0);
});
test('连续掌握按1/3/7/14/30天推进且封顶', () => {
  let s = emptyState();
  for (const [i, n] of [1, 3, 7, 14, 30, 30].entries()) {
    s = completed('i1', [0, 0, 0], true, { ...s, task: null });
    assert.equal(s.progress.i1.stage, Math.min(i + 1, 5));
    assert.equal(s.progress.i1.due, addDays(day, n));
  }
});
test('未完成整组不会提前结算掌握', () => {
  const s = { ...emptyState(), task: createTask(emptyState(), catalog, 'group', 'i1', day)! };
  s.task!.choices[s.task!.questionIds[0]] = 0;
  const recorded = recordAnswer(s, catalog, s.task!.questionIds[0], true);
  assert.deepEqual(finishTask(recorded, catalog, day).progress, {});
});
test('重复点击反馈不会重复写入答题', () => {
  const s = completed();
  const id = s.task!.questionIds[0];
  assert.equal(recordAnswer(s, catalog, id, true).attempts.length, 3);
  assert.deepEqual(finishTask(s, catalog, day), s);
});
test('日常先到期复习再学新组并交替类别', () => {
  const initial = completed();
  const s = { ...initial, nextCategory: 'word' as const };
  const task = createTask(s, catalog, 'daily', undefined, '2026-10-12')!;
  assert.equal(task.groupId, 'w1');
  assert.equal(task.reviewCount, 1);
  assert.equal(task.phase, 'quiz');
});
test('复习优先换未做过的题', () => {
  const s = completed();
  const t = createTask(s, catalog, 'review', undefined, '2026-10-12')!;
  assert.equal(t.questionIds[0], 'i1-3');
});
test('一类学完后继续另一类', () => {
  const s = completed();
  s.progress.i2 = { ...s.progress.i1, learned: true };
  const t = createTask(s, catalog, 'daily', undefined, day)!;
  assert.equal(t.groupId, 'w1');
});
test('自测只选当前类别未提交过的题并提示实际题量', () => {
  const s = completed();
  const t = createTask(s, catalog, 'selftest', 'idiom', day, () => 0.3)!;
  assert.equal(t.questionIds.length, 5);
  assert.ok(t.questionIds.every((id) => !s.attempts.some((a) => a.questionId === id)));
});
test('题库耗尽返回空任务', () => {
  let s = completed('i1');
  s = completed('i2', [0, 0, 0], true, s);
  s.attempts.push(
    ...['i1-3', 'i2-3'].map((questionId) => ({
      id: questionId,
      questionId,
      selected: 0,
      correct: true,
      confident: true,
      at: new Date().toISOString(),
      mode: 'group' as const,
    })),
  );
  assert.equal(createTask(s, catalog, 'selftest', 'idiom'), null);
});
test('首次自测成绩排除重复练习并区分题目来源', () => {
  const s = emptyState();
  s.attempts = [
    {
      id: 'a',
      questionId: 'i1-0',
      selected: 0,
      correct: true,
      confident: true,
      at: new Date().toISOString(),
      mode: 'selftest',
    },
    {
      id: 'b',
      questionId: 'i1-0',
      selected: 1,
      correct: false,
      confident: true,
      at: new Date().toISOString(),
      mode: 'group',
    },
    {
      id: 'c',
      questionId: 'i1-1',
      selected: 1,
      correct: false,
      confident: true,
      at: new Date().toISOString(),
      mode: 'selftest',
    },
  ];
  assert.deepEqual(firstTestStats(s, catalog, 'original'), { total: 1, correct: 1 });
  assert.deepEqual(firstTestStats(s, catalog, 'authored'), { total: 1, correct: 0 });
});
test('跨月跨年按本地日历加天数', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
});
test('备份完整恢复答题、阶段和未完成任务', () => {
  const s = completed();
  s.task = createTask(s, catalog, 'selftest', 'word')!;
  s.task.choices[s.task.questionIds[0]] = 2;
  assert.deepEqual(parseBackup(makeBackup(s), catalog), s);
});
test('拒绝未知题目、篡改成绩、无效日期和重复作答ID', () => {
  for (const mutate of [
    (s: State) => {
      s.attempts[0].questionId = 'missing';
    },
    (s: State) => {
      s.attempts[0].correct = false;
    },
    (s: State) => {
      s.progress.i1.due = '2026-02-30';
    },
    (s: State) => {
      s.attempts.push(s.attempts[0]);
    },
  ]) {
    const s = completed();
    mutate(s);
    assert.throws(() => validateState(s, catalog));
  }
});
test('拒绝未知版本、非法选项和损坏文件', () => {
  assert.throws(() => parseBackup('{bad', catalog));
  const s = completed();
  s.task!.choices[s.task!.questionIds[0]] = 7;
  assert.throws(() => validateState(s, catalog));
  assert.throws(() =>
    parseBackup(
      JSON.stringify({ app: 'word-study', schemaVersion: 2, state: emptyState() }),
      catalog,
    ),
  );
});
test('到期排序与跨日判定准确', () => {
  const s = completed();
  assert.equal(dueGroups(s, catalog, day).length, 0);
  assert.equal(dueGroups(s, catalog, '2026-10-12')[0].id, 'i1');
});

// 放弃剩余题目不能让已答错的词语失去复习机会。
test('切换任务时已提交部分安排复习，未完成组不计已学', () => {
  const task = createTask(emptyState(), catalog, 'group', 'i1', day)!;
  task.choices[task.questionIds[0]] = 1;
  const s = recordAnswer({ ...emptyState(), task }, catalog, task.questionIds[0], true);
  const ended = abandonTask(s, catalog, day);
  assert.equal(ended.task, null);
  assert.equal(ended.progress.i1.due, '2026-10-12');
  assert.equal(ended.progress.i1.learned, false);
  assert.equal(ended.attempts.length, 1);
});
