# PR 描述

标题：`[render] 第一周渲染管线与特性开关`

## 做了什么

- 新增独立 `src/render/` 管线，不改原入口和原始源码。
- 新增月光、灯笼、火盆三类光源。
- 新增 2048 PCF Soft 阴影、灯笼动态投影和 bias 配置。
- 新增指数雾、地面雾层和灯笼体积光。
- 新增四层 Gerstner 水面与简化月光反射。
- 新增 Bloom、ACES、暗角和 HDR 后期链。
- 新增 PBR / Blinn-Phong 可逆切换。
- 新增高 / 中 / 低画质档和六项 `setFeature` 开关。
- 新增 `render-lab.html` 独立验收页与自动对比截图脚本。

## 怎么测

```bash
node tools/build-render-lab.mjs
node tools/capture-render-comparisons.cjs
```

自动脚本会验证 WebGL2、glError、FPS、draw call、三角面数、六项特性开关和三档画质，
并生成四张对比图。当前结果：控制台零 error，四组画面对比均超过像素差异阈值。

## 截图

- [阴影对比](screenshots/01-shadow-comparison.png)
- [雾与体积光对比](screenshots/02-volumetric-fog-comparison.png)
- [水面对比](screenshots/03-water-comparison.png)
- [后期对比](screenshots/04-post-processing-comparison.png)

## 接口与边界

渲染模块通过 `createRenderPipeline()` 对外提供 `update` / `render` / `resize` /
`setQuality` / `setFeature`。把现有 `createRenderer()` 返回值传入 `engine` 后，
特性会注册到项目已有的 `renderer.setFeature()`。

本 PR 不修改 `index.html`、`src/main.js`、`package.json` 或原有模块，集成调用由技术负责人
在合并阶段接入。
