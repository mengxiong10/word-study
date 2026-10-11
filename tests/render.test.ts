import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import App from '../src/App';
import { catalog } from '../src/catalog';
import { createTask, emptyState, finishTask, recordAnswer } from '../src/learning';
import { STORAGE_KEY } from '../src/storage';
import type { State } from '../src/model';
function render(state: State) {
  const storage = {
    getItem: (key: string) => (key === STORAGE_KEY ? JSON.stringify(state) : null),
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 1,
  };
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  try {
    return renderToStaticMarkup(React.createElement(App));
  } finally {
    Reflect.deleteProperty(globalThis, 'localStorage');
  }
}
// 服务端渲染覆盖内容接入及各学习状态，但不代替真实浏览器交互/布局验收。
test('空记录首页显示真实空统计和完整资料总数', () => {
  const html = render(emptyState());
  assert.match(html, /开始今日学习/);
  assert.match(html, /204 道原题/);
  assert.match(html, /243 道原创练习/);
  assert.match(html, /中华文明传统文化/);
  assert.doesNotMatch(html, /NaN/);
});
test('新组学习可显示原文词义、例句及新增辨析', () => {
  const s = emptyState();
  s.task = createTask(s, catalog, 'group', 'idiom-01')!;
  const html = render(s);
  assert.match(html, /源远流长/);
  assert.match(html, /查看 3 条例句/);
  assert.match(html, /本组辨析/);
  assert.match(html, /开始语境练习/);
});
test('已选项和已揭晓状态能完整渲染，解析不会缺失', () => {
  const s = emptyState();
  const task = createTask(s, catalog, 'group', 'idiom-01')!;
  const id = task.questionIds[0];
  s.task = { ...task, phase: 'quiz', choices: { [id]: 1 }, revealed: [id] };
  const html = render(s);
  assert.match(html, /selected/);
  assert.match(html, /先找到语境里的线索/);
  assert.match(html, /仍拿不准/);
  assert.match(html, /新增解题说明/);
});
test('自测交卷前不渲染正确答案和解题解析', () => {
  const s = emptyState();
  s.task = createTask(s, catalog, 'selftest', 'word')!;
  const html = render(s);
  assert.match(html, /未做题自测/);
  assert.doesNotMatch(html, /先找到语境里的线索/);
  assert.doesNotMatch(html, /正确选项/);
});
test('争议题明确显示提示且不用于掌握调度', () => {
  const q = catalog.questions.find((q) => q.assessmentExcluded)!;
  assert.ok(q);
  const s = emptyState();
  const t = createTask(s, catalog, 'group', q.groupIds[0])!;
  s.task = {
    ...t,
    questionIds: [q.id],
    index: 0,
    phase: 'quiz',
    choices: { [q.id]: q.answerIndex },
    revealed: [q.id],
  };
  const html = render(s);
  assert.match(html, /资料核对提示/);
  const done = finishTask(recordAnswer(s, catalog, q.id, true), catalog);
  assert.deepEqual(done.progress, {});
  assert.ok(!createTask(emptyState(), catalog, 'selftest', q.category)!.questionIds.includes(q.id));
});
