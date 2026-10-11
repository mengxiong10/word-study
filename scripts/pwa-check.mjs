import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

// 真实 HTTP 与 Service Worker 验证；路由模拟无法验证离线导航。
const root = path.resolve('dist');
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (!pathname.startsWith('/study/')) {
    response.writeHead(404).end();
    return;
  }
  const file = path.resolve(root, pathname.slice('/study/'.length) || 'index.html');
  if (!file.startsWith(root + path.sep)) {
    response.writeHead(404).end();
    return;
  }
  try {
    const types = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.png': 'image/png',
      '.webmanifest': 'application/manifest+json',
    };
    response.writeHead(200, {
      'Content-Type': types[path.extname(file)] || 'application/octet-stream',
    });
    response.end(await readFile(file));
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {}),
    args: ['--no-sandbox'],
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const url = `http://127.0.0.1:${server.address().port}/study/`;
  await page.goto(url);
  await page.getByRole('button', { name: '开始今日学习', exact: true }).waitFor();
  const manifest = await page.evaluate(async () => {
    const link = document.querySelector('link[rel="manifest"]');
    return (await fetch(link.href)).json();
  });
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, './');
  for (const icon of manifest.icons) {
    const response = await context.request.get(new URL(icon.src, url).href);
    assert.equal(response.status(), 200);
    assert.equal(response.headers()['content-type'], 'image/png');
  }
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // 首次安装完成后重载，页面才进入 Service Worker 控制范围。
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  assert.equal(scope, url);
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: '开始今日学习', exact: true }).click();
  await page.getByRole('heading', { name: '中华文明传统文化', exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log('PWA 验收通过：manifest、图标、子目录 scope、断网重载及离线学习。');
} finally {
  await browser?.close();
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}
