# 参与贡献

欢迎提交 Issue 和 Pull Request：https://github.com/liamamilin/Lookbook/issues

## 新增或修改设计系统

1. 新建或修改 `design-md/<slug>/DESIGN.md`。建议使用 YAML 前置数据，包括 `colors`、`typography`、`rounded`、`spacing` 和 `components`。
2. 在 [`CATALOG.md`](CATALOG.md) 对应的分类下添加或修改这一行：
   `- [**Name**](https://getdesign.md/<slug>/design-md) - tagline`
3. （可选）在 [`web/src/zh-descriptions.js`](web/src/zh-descriptions.js) 里补上中文简介。
4. 在 `web/` 目录下运行 `npm test`，确认解析、渲染和对比度检查全部通过。
5. 运行 `npm run dev`，在浏览器里实际看一遍预览效果。

## 修改前端

前端代码在 [`web/`](web)，结构说明见 [`web/README.md`](web/README.md)。界面文案需要同时提供中文和英文，统一写在 `web/src/i18n.js` 里。

## Pull Request

- 一个 PR 只做一件事。
- 修改了预览效果的，请附上前后对比截图。
