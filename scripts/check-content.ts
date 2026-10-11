import assert from 'node:assert/strict';
import { catalog, contrasts } from '../src/catalog';
assert.equal(catalog.groups.length, 81);
assert.equal(catalog.groups.filter((g) => g.category === 'idiom').length, 67);
assert.equal(catalog.groups.filter((g) => g.category === 'word').length, 14);
assert.equal(catalog.questions.filter((q) => q.kind === 'original').length, 204);
assert.equal(catalog.questions.filter((q) => q.kind === 'authored').length, 243);
assert.equal(
  catalog.questions.filter((q) => q.kind === 'original' && q.category === 'idiom').length,
  177,
);
assert.equal(
  catalog.questions.filter((q) => q.kind === 'original' && q.category === 'word').length,
  27,
);
assert.equal(new Set(catalog.groups.map((g) => g.id)).size, 81);
assert.equal(new Set(catalog.questions.map((q) => q.id)).size, 447);
const groups = new Map(catalog.groups.map((g) => [g.id, g]));
let terms = 0;
for (const g of catalog.groups) {
  assert.equal(g.terms?.length, g.wordCount, `词条数量 ${g.id}`);
  terms += g.terms!.length;
  assert.ok(g.studyText && g.title && g.source.page > 0);
  assert.equal(
    catalog.questions.filter((q) => q.kind === 'authored' && q.groupIds.includes(g.id)).length,
    3,
    `原创题 ${g.id}`,
  );
  assert.ok(contrasts[g.id]?.summary, `辨析缺失 ${g.id}`);
  for (const t of g.terms!)
    assert.ok(t.word && t.definition && t.source.page > 0, `词条缺失 ${g.id}`);
}
assert.equal(terms, 993);
for (const q of catalog.questions) {
  assert.ok(q.stem.length > 12, `题干 ${q.id}`);
  assert.equal(q.options.length, 4, q.id);
  assert.equal(new Set(q.options).size, 4, `重复选项 ${q.id}`);
  assert.ok(
    q.options.every((x) => x.trim().length > 0),
    q.id,
  );
  assert.ok(Number.isInteger(q.answerIndex) && q.answerIndex >= 0 && q.answerIndex <= 3, q.id);
  assert.ok(
    q.groupIds.length && q.groupIds.every((id) => groups.get(id)?.category === q.category),
    `组关联 ${q.id}`,
  );
  assert.ok(q.explanation?.clue?.length > 5, `线索 ${q.id}`);
  assert.ok(q.explanation.correctReason.length > 5, `解析 ${q.id}`);
  assert.equal(q.explanation.optionReasons.length, 4, `选项解析 ${q.id}`);
  assert.ok(
    q.explanation.optionReasons.every((x) => x.length > 5),
    q.id,
  );
  if (q.kind === 'original')
    assert.ok(q.source?.book && q.source.page > 0 && q.source.number > 0, q.id);
}
console.log('内容校验通过：81组 / 993词条 / 204原题 / 243原创题；题号、答案、词组关联与解析完整。');
