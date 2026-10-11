# 词间 · 考公词语研习

个人使用的成语与实词学习网页。先辨析近义词，再做语境选择题，通过间隔复习巩固，用未做题自测观察首次正确率。

## 启动

需要 Node.js 22.22 或更高版本。

```sh
npm ci
npm run dev
```

打开终端打印的地址。手机与电脑在同一局域网时，通过电脑的局域网 IP 和 Vite 端口访问。浏览器记录按访问地址保存：从 localhost 换到 IP 或换域名之前，请导出备份。

## 构建与部署

```sh
npm run build
npm run preview
```

将 `dist/` 下全部文件上传至静态托管服务即可。`base: './'` 支持部署到域名根目录或子目录；界面切换不使用服务端路由，无需配置 SPA 路由回退。需通过 HTTP(S) 访问，不能直接双击 HTML 代替部署。

生产构建产物位于 `dist/`。开启托管服务的 gzip/Brotli 压缩，题库随静态资源加载，不依赖运行时 AI 或后台服务。支持 PWA 安装与离线缓存，不提供账号或自动跨设备同步。

## 学习方式

- 今日任务：最多 5 道到期复习题，再学 1 组新词、练习 3 道题。成语与实词交替推进，均按资料顺序；也可在词组目录搜索并选择学习。
- 作答：选择后确认提交，显示解析，再反馈“已理解”或“仍拿不准”。提交前、查看解析后、任务中途均可刷新续学。
- 复习：同一任务内，同组多题只结算一次；任一题答错或拿不准，次日复习。全对且理解后依次安排 1、3、7、14、30 天，随后维持 30 天。优先使用没做过的同组题，题目耗尽后按最近作答时间轮换。
- 自测：按类别随机抽最多 10 道未提交作答的题，整组交卷才显示答案。不足 10 道时显示实际数量；已交卷的自测题参与复习。资料原题与原创题的首次自测成绩独立统计。
- 保存：仅当前浏览器本机存储。通过右上角“进度保存在本机”进入记录与备份。导入替换现有记录；无效备份不会覆盖记录。无效本机记录会阻止写入，并允许导出原始数据。

## 内容

`data/` 三份 PDF 整理为 **81 组、993 个词条条目、204 道原题**；每组补充 3 道原创语境题，总计 **447 道题**。词条总数按资料逐组标注与实际抽取合计，保留重复出现的条目；书名“1000词”不是实际条目合计。

原文词义、例句与新增辨析分开展示。所有题目提供新增解析，原题保留书名、PDF 物理页码、印刷页码、题号与配套答案位置。已核对 4 道跨页题和双栏选项顺序。实词第 14 组原资料无例题，提供原创练习。

有 2 道原题保留在内容中但不用于自测、正确率或掌握调度：成语 71 题选项语义近似，成语 133 题原 PDF 含错字/缺字。详见 [内容整理说明](docs/content.md)。

## 检查

```sh
npm run lint
npm run format:check
npm run typecheck
npm run check:content
npm test
npm run build
```

真实浏览器流程检查（先构建）：

```sh
npx playwright install chromium
npm run test:e2e
```

可通过 `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/绝对路径/chrome npm run test:e2e` 使用现有 Chromium。脚本用 Playwright 路由提供构建产物，不需要额外 HTTP 服务；验证桌面与 390px 手机布局、续学、练习、自测、搜索、复习与备份，并生成 `artifacts/` 截图。

本次实际通过及未验证部分见 [验收记录](docs/acceptance.md)。

## 结构

- `src/content/`：原资料抽取、原创题、新增辨析、逐题解析和核对提示；内容维护独立于界面。
- `src/learning.ts`：纯函数任务生成、答题记录、复习安排与统计。
- `src/storage.ts`：记录读取、备份校验与恢复。
- `src/App.tsx` / `src/style.css`：学习界面和响应式排版。
- `scripts/` / `tests/`：PDF 再抽取、内容校验、规则与渲染测试、真实浏览器验收。

## 开发规范与 Git hooks

ESLint 检查 TypeScript、React Hooks 和热更新导出；Prettier 统一格式。

```sh
npm run lint
npm run lint:fix
npm run format
npm run format:check
```

`npm install` / `npm ci` 自动通过 `prepare` 安装 Husky hooks。提交前由 lint-staged 对暂存的代码执行 ESLint 修复和 Prettier 格式化，错误会阻止提交；推送前执行类型检查和单元测试。`.husky/` 中的 hook 文件随源码提交。

## PWA 与离线使用

生产构建生成应用清单、192/512 像素图标和 Service Worker。部署到 HTTPS（本机 localhost 也可）后，浏览器支持时可安装“词间”，iOS 可通过 Safari 的“添加到主屏幕”使用。普通局域网 HTTP 地址可以浏览网页，但无法启用 Service Worker 离线缓存。

首次联网打开并完成缓存后，页面、题库和样式可离线使用，学习进度仍保存在当前浏览器。新版本在所有应用页面关闭后启用，再次打开即可使用；不会在答题期间强制刷新。开发服务器不启用 Service Worker。

部署时上传整个 `dist/`，包含 `sw.js`、Workbox 文件、应用清单和图标。建议 HTML、`sw.js` 和应用清单使用 `Cache-Control: no-cache`，带 hash 的 assets 使用长期缓存。

构建后验证子目录部署与断网重载：

```sh
npm run build
npm run test:pwa
```

和浏览器流程检查一样，可用 `PLAYWRIGHT_CHROMIUM_EXECUTABLE` 指定 Chromium。

## GitHub 与 Vercel 自动部署

远程仓库：`git@github.com:mengxiong10/word-study.git`。首次推送：

```sh
git branch -M main
git add .
git commit -m "feat: initialize word study app with PWA and development tooling"
git push -u origin main
```

在 Vercel 的 Add New → Project 中连接 GitHub，导入 `mengxiong10/word-study`，框架选 Vite、Root Directory 保持仓库根目录，Node.js 选 22.x，点击 Deploy。项目无需环境变量。`vercel.json` 已指定 `npm ci`、带质量检查的构建命令和 `dist` 输出目录，以及 PWA 更新相关的缓存头。

在项目 Settings → Git 中确认 Production Branch 为 `main`。此后推送 main 自动部署生产版本，其他分支及 PR 生成预览部署，无需另外配置 GitHub Actions 或 Vercel Token。学习记录按域名隔离，切换到正式域名前先导出备份。

参考：[Vercel GitHub 集成](https://vercel.com/docs/git/vercel-for-github)、[Vite 部署](https://vercel.com/docs/frameworks/frontend/vite)。
