# PR 描述

标题：`[render] 第二周主场景渲染调优与 rain 特性`

## 做了什么

- 在已接入的 `createRenderPipeline()` 上补真实迷宫场景参数调优。
- 新增 `src/render/rain.js`，实现相机局部雨丝与程序化地面涟漪。
- 新增 `rain` 特性，主场景、验收台、URL 参数和诊断接口均可开关。
- 新增 `npm run capture:main-render` 与 `tools/capture-main-render.cjs`。
- 自动生成主场景阴影、体积光、水面、后期、雨/涟漪五组对比图。
- 自动在 Chrome / Edge 中预热后采样 1440 × 900 高低画质性能。
- 更新渲染 README、接口契约和第二周交付记录。

## 接口变化

`setFeature` 新增第七项特性：

```text
shadow / lantern / volumetric / water / rain / bloom / pbr
```

`rain` 在三档画质中默认关闭，避免非雨天场景增加无意义开销。低画质手动开启时仍使用
720 个雨滴和较低透明度的涟漪。

## 怎么测

```bash
npm run build
npm run test:config
npm run capture:main-render
npm run capture:render-lab
npm test
```

当前自动结果：

- 五组主场景对比均达到像素差异阈值；
- Chrome 高 / 低画质 292.3 / 300.0 FPS；
- Edge 高 / 低画质 278.8 / 299.8 FPS；
- GL error 0，控制台 error 0。

## 截图

- [主场景阴影对比](screenshots/main-01-shadow-comparison.png)
- [主场景体积光对比](screenshots/main-02-volumetric-fog-comparison.png)
- [主场景水面对比](screenshots/main-03-water-comparison.png)
- [主场景后期对比](screenshots/main-04-post-processing-comparison.png)
- [主场景雨/涟漪对比](screenshots/main-05-rain-comparison.png)

## 已知边界

高画质固定机位仍有 256 draw calls，低画质 163；60 / 30 FPS 目标已达成，但团队
“全场景 150 draw calls 以下”的目标仍需与迷宫/世界模块继续合批。真实 GPU 高 DPR
长路径采样留到第三周。
