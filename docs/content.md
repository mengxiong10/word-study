# 内容整理说明

## 来源与数量

| 类别 | 词组数 | 原题数 | 原创练习数 |
| ---- | -----: | -----: | ---------: |
| 成语 |     67 |    177 |        201 |
| 实词 |     14 |     27 |         42 |
| 合计 |     81 |    204 |        243 |

抽取词条共 993 个条目，各组 `terms.length` 与资料标注 `wordCount` 完全一致，不按词语去重。原资料的实词第 14 组没有原题。所有页码默认使用从 1 开始的 PDF 物理页码，印刷页码另存 `printedPage`。

## 数据契约

词组包含 `id/category/number/title/studyText/terms/source/pages/wordCount`。词条包含词语、释义、原文例句及页码。`studyText` 保留原文，界面优先呈现结构化词条。

题目包含 `id/kind/category/groupIds/stem/options/answerIndex/source`，原题还保留考试来源、答案册位置及跨页范围。答案索引 0–3 对应 A–D。使用 `original-idiom-001`、`original-word-001` 区分类别和题号，避免实词编号重启导致覆盖。

新增解析包含 `clue/correctReason/optionReasons[4]`。词组辨析包含 `summary/distinctions[{term,note}]`。原创题正答属于所关联词组，题目按不同语境设计，选项不重复；已检查近义选项可能双解的情况。

`content-notes.json` 中的核对提示会给对应题增加 `editorialNote` 和 `assessmentExcluded`，用于作答前提示、解析提示及排除计分；原题文本与配套答案不会因提示被更改。

## 原资料疑点

| 题目     | 依据与处理                                                                                                                   |
| -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 成语 71  | 配套答案给 A“无可厚非 / 以上率下”，B“无可非议 / 率先垂范”语义接近。保留 A 并提示近似争议，待有更可靠依据再决定是否解除排除。 |
| 成语 133 | 下册 PDF 物理第 74 页确实印有“恶性竟争”“甚至产生面效果”。抽取文本与页面一致，属于原资料错字/缺字。保留原文，不猜补遗漏字。   |

两题仍保留完整原文、答案及辨析，普通词组练习可能出现，但不进入未做题自测，不计总体正确率，不用于掌握阶段；其余同组题正常安排复习。

## 抽取与复核

`scripts/extract-pdf.mjs` 使用 PDF.js 文本坐标重建每行文字，排除页眉页脚和目录页，连接跨页题目，区分双栏 A/B/C/D 选项，并与答案册逐号匹配。跨页原题为成语 29、118、130、157；第 177 题之后的实词目录不属于 D 选项。

如需重新抽取，额外安装 `pdfjs-dist@5.5.207`，或者设置 `PDFJS_MODULE_PATH` 指向已安装的 `legacy/build/pdf.mjs`：

```sh
PDFJS_MODULE_PATH=/绝对路径/pdfjs-dist/legacy/build/pdf.mjs node scripts/extract-pdf.mjs
npm run check:content
```

重新抽取会覆盖 `src/content/catalog.json`，不会覆盖独立保存的原创题和解析；改动后必须重新运行校验并核对来源。临时逐页文本写入 `/tmp/word-pdf-pages.json` 与 `/tmp/word-pdf.txt`。
