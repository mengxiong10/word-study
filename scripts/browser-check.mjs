import { chromium } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const raw = JSON.parse(await readFile('src/content/catalog.json', 'utf8'));
const authored = JSON.parse(await readFile('src/content/authored.json', 'utf8'));
const qs = new Map([...raw.questions, ...authored].map((q) => [q.id, q]));
await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
    : {}),
  args: ['--no-sandbox'],
});
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  });
  // 用路由提供构建产物，独立验证静态部署且无需另起HTTP服务。
  await context.route('http://word.test/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const target = path.resolve('dist', '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!target.startsWith(path.resolve('dist') + path.sep)) return route.abort();
    try {
      const ext = path.extname(target);
      await route.fulfill({
        body: await readFile(target),
        contentType:
          ext === '.js'
            ? 'application/javascript'
            : ext === '.css'
              ? 'text/css'
              : ext === '.json'
                ? 'application/json'
                : 'text/html',
      });
    } catch {
      await route.fulfill({ status: 404, body: 'Not found' });
    }
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://word.test/');
  await page.getByRole('button', { name: '开始今日学习', exact: true }).waitFor();
  await page.screenshot({ path: 'artifacts/home-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'artifacts/home-mobile.png', fullPage: true });
  const assertWidth = async () =>
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      '页面不应横向溢出',
    );
  await assertWidth();
  await page.getByRole('button', { name: '开始今日学习', exact: true }).click();
  await page.getByRole('heading', { name: '中华文明传统文化', exact: true }).waitFor();
  await page.screenshot({ path: 'artifacts/study-mobile.png', fullPage: true });
  await assertWidth();
  await page.getByRole('button', { name: '开始语境练习', exact: true }).click();
  await page.locator('.option').nth(1).click();
  await page.reload();
  assert.equal(await page.locator('.option.selected').count(), 1);
  await page.getByRole('button', { name: '确认答案', exact: true }).click();
  await page.getByText('先找到语境里的线索', { exact: true }).waitFor();
  await page.screenshot({ path: 'artifacts/explanation-mobile.png', fullPage: true });
  await assertWidth();
  await page.getByRole('button', { name: '仍拿不准', exact: true }).click();
  for (let i = 0; i < 2; i++) {
    await page.locator('.option').first().click();
    await page.getByRole('button', { name: '确认答案', exact: true }).click();
    await page.getByRole('button', { name: /已理解/ }).click();
  }
  await page.getByText('本次学习完成', { exact: true }).waitFor();
  const learnedState = await page.evaluate(() => JSON.parse(localStorage.getItem('word-study-v1')));
  assert.equal(learnedState.attempts.length, 3);
  assert.equal(learnedState.progress['idiom-01'].stage, 0);
  await page.getByRole('button', { name: '回到今日学习', exact: true }).click();
  await page.locator('.mobile-nav').getByRole('button', { name: '词组', exact: true }).click();
  await page.getByRole('button', { name: '实词 14' }).click();
  await page.getByRole('textbox', { name: '搜索词语或主题' }).fill('雕刻');
  assert.ok((await page.locator('.group-row').count()) > 0);
  await assertWidth();
  await page.locator('.mobile-nav').getByRole('button', { name: '自测', exact: true }).click();
  await page.locator('.test-categories').getByRole('button', { name: '开始自测' }).nth(1).click();
  for (let i = 0; i < 10; i++) {
    const s = await page.evaluate(() => JSON.parse(localStorage.getItem('word-study-v1')));
    const q = qs.get(s.task.questionIds[s.task.index]);
    assert.equal(await page.locator('.explanation').count(), 0);
    await page.locator('.option').nth(q.answerIndex).click();
    await page
      .getByRole('button', { name: i === 9 ? '交卷并查看解析' : '下一题', exact: true })
      .click();
  }
  await page.getByText('本次学习完成', { exact: true }).waitFor();
  await page.locator('.local-status').click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载 JSON 备份' }).click();
  const download = await downloadPromise;
  const backupPath = path.resolve('artifacts/backup.json');
  await download.saveAs(backupPath);
  page.on('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '清空记录', exact: true }).click();
  assert.equal(
    await page.evaluate(() => JSON.parse(localStorage.getItem('word-study-v1')).attempts.length),
    0,
  );
  await page.locator('input[type=file]').setInputFiles(backupPath);
  await page.getByText('备份已恢复，可以继续学习。', { exact: true }).waitFor();
  assert.equal(
    await page.evaluate(() => JSON.parse(localStorage.getItem('word-study-v1')).attempts.length),
    13,
  );
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
  await page.getByText('备份格式或内容无效，现有学习记录未更改。', { exact: true }).waitFor();
  assert.equal(
    await page.evaluate(() => JSON.parse(localStorage.getItem('word-study-v1')).attempts.length),
    13,
  );
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('word-study-v1')));
  Object.values(saved.progress).forEach((p) => (p.due = '2000-01-01'));
  await page.evaluate((s) => localStorage.setItem('word-study-v1', JSON.stringify(s)), saved);
  await page.reload();
  await page.locator('.mobile-nav').getByRole('button', { name: '复习', exact: true }).click();
  await page.getByRole('button', { name: '开始复习', exact: true }).click();
  await page.locator('.options').waitFor();
  await assertWidth();
  assert.deepEqual(errors, []);
  console.log(
    '浏览器验收通过：桌面/390px手机、刷新续学、练习与信心反馈、自测交卷、搜索、备份导入导出、无效备份、到期复习；截图在 artifacts/。',
  );
} finally {
  await browser.close();
}
