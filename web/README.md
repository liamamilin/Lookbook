# Lookbook · 设计系统图鉴

Lookbook 把 [`../design-md/`](../design-md) 里的每一份 DESIGN.md 渲染成同一个示例页面，让你在动手之前就能看到一套设计系统用起来是什么样子。

在线访问：https://liamamilin.github.io/Lookbook/

模板数据来自 [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md)（MIT 许可）。

## 功能

- **模板库**：卡片缩略图，支持搜索（中英文）、分类筛选和深色/浅色筛选。
- **模板详情**有 5 个标签页：
  - **页面预览**：用该模板的令牌渲染一个完整的示例落地页。
  - **设计令牌**：色板（点击复制）、字号层级、圆角和间距。
  - **组件**：`components:` 里的每个组件都渲染成实物样例。
  - **导出**：AI 提示词（可附带完整 DESIGN.md）、CSS 变量、Tailwind v4 `@theme`、Tailwind v3 配置、W3C Design Tokens JSON（可导入 Figma 的 Tokens Studio）。
  - **原始文档**：渲染后的 DESIGN.md 全文。
- **风格对比**：两套设计系统在同一个示例页面上并排比较。
- **中文 / English** 界面切换。模板简介有中文译文，见 [`src/zh-descriptions.js`](src/zh-descriptions.js)。

## 开发

```bash
npm install
npm run dev      # http://127.0.0.1:5178
npm test         # vitest：数据解析、全部页面渲染、导出格式、文字对比度
npm run build    # 静态站点输出到 dist/
npm run preview  # 本地预览构建结果，http://127.0.0.1:5179
```

`npm run build` 会先执行 `vite build`，再运行 [`scripts/prerender.mjs`](scripts/prerender.mjs)。后者为每个页面生成预渲染的静态 HTML（模板库、关于、对比、每个模板、404），并生成 Open Graph 分享图、`robots.txt` 和 `sitemap.xml`。

## 配置

部署相关的设置都在 [`lookbook.config.js`](lookbook.config.js) 里：

| 字段 | 作用 |
|---|---|
| `siteUrl` | 站点的公开地址。设置后才会输出绝对路径的 `og:image`、canonical 和 `sitemap.xml`。 |
| `base` | 站点所在的路径。根域名填 `/`；GitHub Pages 的项目站点填 `/<仓库名>/`。也可以用环境变量 `LOOKBOOK_BASE` 覆盖。 |
| `feedbackUrl` | 页脚“反馈”链接指向的地址，为空时不显示。 |
| `analytics` | 统计脚本，例如 Plausible 或 Umami，为空时不注入。 |

## 结构

| 文件 | 内容 |
|---|---|
| `src/core.js` | 纯解析逻辑：README 分类、YAML 前置数据、`{colors.x}` 引用解析，以及无前置数据模板的颜色和字体推断。 |
| `vite.config.js` | `virtual:lookbook-data` 插件：构建时解析全部模板，只把令牌数据打进主包；DESIGN.md 原文按需懒加载。 |
| `src/render.js` | 示例页面、缩略图、令牌和组件的渲染，带对比度保护。 |
| `src/export.js` | CSS、Tailwind、DTCG 和 AI 提示词导出。 |
| `src/views.js` | 所有页面的 HTML，以及路由匹配。客户端和预渲染共用这一份。 |
| `src/main.js` | 客户端路由（History API）和交互。 |
| `tests/` | vitest 测试。 |

CI 配置在仓库根目录的 [`.github/workflows/lookbook.yml`](../.github/workflows/lookbook.yml)。
