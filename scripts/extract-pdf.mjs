import fs from 'node:fs';
import path from 'node:path';
const { getDocument } = await import(
  process.env.PDFJS_MODULE_PATH || 'pdfjs-dist/legacy/build/pdf.mjs'
).catch(() => {
  throw new Error(
    '请安装 pdfjs-dist@5.5.207，或通过 PDFJS_MODULE_PATH 指定 legacy/build/pdf.mjs 的绝对路径。',
  );
});
const pages = [];
for (const file of fs.readdirSync('data').filter((f) => f.endsWith('.pdf'))) {
  const doc = await getDocument({
    data: new Uint8Array(fs.readFileSync(path.join('data', file))),
    useSystemFonts: true,
  }).promise;
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const lines = [];
    for (const item of content.items
      .filter((x) => x.str?.trim())
      .sort((a, b) => b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4])) {
      const y = item.transform[5];
      let line = lines.find((l) => Math.abs(l.y - y) < 2);
      if (!line) {
        line = { y, items: [] };
        lines.push(line);
      }
      line.items.push({ x: item.transform[4], text: item.str, width: item.width });
    }
    for (const line of lines) {
      line.items.sort((a, b) => a.x - b.x);
      line.text = line.items.map((x) => x.text).join('');
    }
    pages.push({ book: file, page: i, lines, text: lines.map((l) => l.text).join('\n') });
  }
}
fs.writeFileSync('/tmp/word-pdf-pages.json', JSON.stringify(pages, null, 2));
fs.writeFileSync(
  '/tmp/word-pdf.txt',
  pages.map((p) => `\n--- ${p.book} PAGE ${p.page} ---\n${p.text}`).join('\n'),
);
console.log(`${pages.length} pages extracted`);

const chineseNumber = (value) => {
  const digits = { 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (!value.includes('十')) return digits[value];
  const [t, u] = value.split('十');
  return (t ? digits[t] : 1) * 10 + (u ? digits[u] : 0);
};
const header = /^【第([一二三四五六七八九十]+)组】(.+)[（(]\s*(\d+)\s*个[）)]$/;
const answerMap = new Map();
let answerCategory = 'idiom';
for (const page of pages.filter((p) => p.book.includes('答案')))
  for (const line of page.lines) {
    if (line.text === '高频实词部分') answerCategory = 'word';
    const m = line.text.match(/^例题\s*(\d+)(?:[～~]\s*例题\s*(\d+))?\s*([ABCD]+)$/);
    if (m) {
      const start = Number(m[1]),
        end = Number(m[2] ?? m[1]);
      if (m[3].length !== end - start + 1) throw Error(`Answer length mismatch ${line.text}`);
      for (let n = start; n <= end; n++)
        answerMap.set(`${answerCategory}-${n}`, {
          answerIndex: 'ABCD'.indexOf(m[3][n - start]),
          page: page.page,
        });
    }
  }
const groups = [],
  questions = [];
let group = null,
  question = null;
let category = 'idiom';
let studyActive = true;
const cleanLine = (line) => !/^高频成语实词词$|^1000$|^第\s*\d+\s*页$/.test(line.text);
const formatLine = (line) =>
  line.items.reduce(
    (str, item, i) =>
      str +
      (i && item.x - (line.items[i - 1].x + line.items[i - 1].width) > 3 ? '　' : '') +
      item.text,
    '',
  );
function finishQuestion() {
  if (!question) return;
  const combined = question.lines.map(formatLine).join('\n');
  const labels = [...combined.matchAll(/(?:^|\n|\u3000)([ABCD])[．.、]/g)];
  if (labels.length !== 4)
    throw Error(`${question.id}: found ${labels.length} option labels\n${combined}`);
  const options = labels.map((m, i) =>
    combined
      .slice(m.index + m[0].length, labels[i + 1]?.index ?? combined.length)
      .replace(/\n/g, '')
      .trim(),
  );
  const stem = combined.slice(0, labels[0].index).replace(/\n/g, '').trim();
  const answer = answerMap.get(`${question.category}-${question.source.number}`);
  if (!answer) throw Error(`Missing answer ${question.id}`);
  question.pages = [...new Set([question.source.page, ...question.lines.map((l) => l.page)])];
  question.source.endPage = question.pages.at(-1);
  questions.push({
    ...question,
    stem,
    options,
    answerIndex: answer.answerIndex,
    answerSource: { book: '高频成语实词1000词例题答案.pdf', page: answer.page },
    lines: undefined,
  });
  question = null;
}
for (const page of pages.filter((p) => !p.book.includes('答案'))) {
  if (page.book.includes('下册') && page.page >= 165 && page.page <= 167) {
    finishQuestion();
    continue;
  }
  const valid = page.lines.filter(cleanLine);
  for (const line of valid) {
    const m = line.text.match(header);
    if (m) {
      finishQuestion();
      category = page.book.includes('下册') && page.page >= 168 ? 'word' : 'idiom';
      const number = chineseNumber(m[1]);
      group = {
        id: `${category}-${String(number).padStart(2, '0')}`,
        category,
        number,
        title: m[2],
        wordCount: Number(m[3]),
        studyLines: [],
        source: { book: page.book, page: page.page, printedPage: page.page - 2 },
        pages: [],
      };
      groups.push(group);
      studyActive = true;
      continue;
    }
    if (!group || (group.source.book !== page.book && page.page < 7)) continue;
    if (!group.pages.includes(page.page)) group.pages.push(page.page);
    const qm = line.text.match(/^例题\s*(\d+)\s*(.*)$/);
    if (qm) {
      finishQuestion();
      question = {
        id: `original-${category}-${String(qm[1]).padStart(3, '0')}`,
        kind: 'original',
        category,
        groupIds: [group.id],
        exam: qm[2],
        source: {
          book: page.book,
          page: page.page,
          printedPage: page.page - 2,
          number: Number(qm[1]),
        },
        lines: [],
      };
      studyActive = false;
      continue;
    }
    if (/^(?:\d+\.\s*2\s*)?真题示例$/.test(line.text)) {
      studyActive = false;
      continue;
    }
    if (question) question.lines.push({ ...line, page: page.page });
    else if (studyActive) group.studyLines.push({ text: line.text, page: page.page });
  }
}
finishQuestion();
for (const g of groups) {
  // The duplicate title and summary table are retained in studyText; structured entries start at the pen markers.
  g.studyText = g.studyLines.map((l) => l.text).join('\n');
  g.terms = [];
  let term = null;
  const groupWords = g.studyLines.flatMap((l) =>
    l.text.startsWith('✎') ? [l.text.slice(1).trim()] : [],
  );
  for (const line of g.studyLines) {
    if (
      !line.text.startsWith('【例】') &&
      line.text.includes('、') &&
      !/[。；！？]/.test(line.text) &&
      groupWords.filter((w) => line.text.includes(w)).length >= 2
    )
      continue;
    const m = line.text.match(/^✎\s*(.+)$/);
    if (m) {
      term = {
        word: m[1],
        definition: '',
        examples: [],
        source: { book: g.source.book, page: line.page, printedPage: line.page - 2 },
      };
      g.terms.push(term);
      continue;
    }
    if (!term) continue;
    if (line.text.startsWith('【例】')) term.examples.push(line.text.slice(3));
    else if (term.examples.length) term.examples[term.examples.length - 1] += line.text;
    else term.definition += line.text;
  }
  delete g.studyLines;
}
if (groups.length !== 81 || questions.length !== 204)
  throw Error(`Unexpected counts: ${groups.length} groups, ${questions.length} questions`);
fs.mkdirSync('src/content', { recursive: true });
fs.writeFileSync('src/content/catalog.json', JSON.stringify({ groups, questions }, null, 2) + '\n');
console.log(
  `${groups.length} groups, ${questions.length} questions, ${groups.reduce((n, g) => n + g.terms.length, 0)} terms; all original answers matched.`,
);
