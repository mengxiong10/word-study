# 验收记录

日期：2026-10-11。此记录区分已执行的检查和受环境限制未完成的检查。

## 已通过

| 检查                    | 结果                                                                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `npm run check:content` | 81组、993词条、204原题、243原创题完整；唯一ID、四选项、答案索引、词组类别关联、每组三原创题及全部解析检查通过。        |
| `npm test`              | 23项通过：18项任务/复习/统计/备份规则测试，5项真实内容接入后的 React 服务端渲染测试。                                  |
| `npm run build`         | TypeScript严格检查与Vite生产构建通过，生成静态HTML、CSS、JS。                                                          |
| PDF核对                 | 各组词条数量与标注一致；配套204答案与题号关联；4道跨页题完整，双栏选项按A/B/C/D排列；第133题错字/缺字经原PDF页面核实。 |
| 原创题复核              | 每组3题，正确选项属于对应词组，逐项补齐理由；修正多组同义干扰项导致的歧义。                                            |

规则测试覆盖同组多题只推进一次、猜对拿不准次日复习、1/3/7/14/30天推进、题目轮换、类别交替、题库耗尽、首次自测来源分开统计、跨月跨年、备份恢复与拒绝无效备份、切换任务后已提交答题仍安排复习。

渲染测试覆盖首页实际空统计、原文词义/例句/新增辨析、已选与已揭晓状态、自测交卷前不展示答案，以及争议题提示和排除掌握判定。服务端渲染检查不等于真实浏览器交互或视觉验收。

## 未完成的验证

`npm run test:e2e` 已实际尝试，当前沙箱不允许 Chromium 所需系统调用，启动时报 `sandbox_host_linux.cc: shutdown: Operation not permitted`。完整 Chromium 也因 Crashpad socket 的 `setsockopt: Operation not permitted` 退出。

`npm run dev -- --port 4175` 同样因 `listen EPERM 0.0.0.0:4175` 无法开启本地服务。这是当前运行环境限制，未获得可交互预览或手机/桌面截图。因此**真实浏览器点击流程、手机布局和视觉效果尚未验收**，不能宣称E2E通过。

已交付 `scripts/browser-check.mjs`，可在允许浏览器启动的环境执行 `npm run build`、`npx playwright install chromium`、`npm run test:e2e`；其断言和截图步骤尚未在本环境运行完成。

网络访问被限制，不能从 npm 拉取依赖或验证一次全新的 `npm ci`。本次构建使用机器已有的对应版本依赖，`package-lock.json` 固定版本并提供正常安装路径。

## 交付注意

- 已生成 `dist/` 及静态发布包，未部署公网。
- 题库和解析全部随静态文件加载。构建提示单个JS包超过500kB，属题库内置的体积警告，构建成功；部署时建议启用gzip/Brotli。
- 两道有疑点原题保留原文及答案，排除自测、正确率与掌握调度，详见内容说明。其余新增题和解析为本站编写，并非资料自带解析。
- 学习效果是否迁移到考试陌生题，需要实际使用后的首次自测数据判断；没有虚构效果数据。

## 2026-10-11：开发工具与 PWA

- 加入 ESLint flat config（TypeScript、React Hooks、React Refresh）、Prettier 命令，以及 Husky + lint-staged。
- `npm run lint`、`npm run format:check`、`npm run typecheck`、`npm test`（23 项）、`npm run check:content` 与生产构建通过。构建保留主包体积提示，完整题库在 5 MiB 的预缓存上限内。
- Husky 已安装，仓库 `core.hooksPath` 为 `.husky/_`。在独立临时仓库验证 pre-commit 自动格式化有效文件，并阻止包含 ESLint 错误的提交；项目暂存区未用于测试。pre-push 执行的类型检查与单元测试分别通过。
- `npm run test:pwa` 通过真实 localhost HTTP + Chromium 检查：应用清单、图标、`/study/` 子目录 Service Worker scope、首次缓存后重载、断网重载与离线学习。
- `npm run test:e2e` 通过桌面与 390px 手机布局、刷新续学、练习、信心反馈、自测交卷、搜索、备份导入导出、无效备份与到期复习检查。截图保存在 `artifacts/`。
- 更新 `word-study-static.tar.gz`，包含 PWA 清单、图标、Service Worker 和完整题库。
- 浏览器安装到主屏幕的系统操作、iOS 真机安装和线上 HTTPS 部署未执行。

配置依据：[typescript-eslint](https://typescript-eslint.io/getting-started/)、[Husky](https://typicode.github.io/husky/get-started.html)、[Vite PWA](https://vite-pwa-org.netlify.app/guide/)。
