# 渲染模块

负责人：黄勇杰

第一周目标是在不改动现有入口的前提下，提供一套可独立接入的渲染管线。当前主入口
`src/main.js` 保持原样，模块通过 `render-lab.html` 进行可视化验收。

## 管线顺序

```text
场景几何
  -> 月光平行光 / 灯笼聚光 / 火盆点光
  -> 阴影贴图
  -> Gerstner 水面
  -> 指数雾 / 地面雾层 / 灯笼体积光
  -> HalfFloat HDR RenderTarget
  -> Bloom
  -> 暗角
  -> ACES Filmic Tone Mapping
  -> sRGB 输出
```

## 对外接口

```js
import { createRenderPipeline } from './render/index.js'

const pipeline = createRenderPipeline({
  scene,
  camera,
  renderer: engineRenderer.renderer,
  engine: engineRenderer,
  quality: 'high',
  water: {
    size: { x: 13, z: 9 },
    position: { x: 0, y: 0.1, z: 0 },
  },
})

pipeline.update(dt)
pipeline.render(dt)
pipeline.resize(width, height, pixelRatio)
pipeline.setQuality('low')
pipeline.setFeature('shadow', false)
```

`engine` 是引擎模块的 `createRenderer()` 返回值。传入后会注册以下特性，可直接使用
项目已有的 `window.changming.setFeature()` 或 `renderer.setFeature()`：

`shadow` / `lantern` / `volumetric` / `water` / `bloom` / `pbr`

不传 `engine` 时，管线仍可独立工作，特性通过 `pipeline.setFeature()` 控制。

## 文件

| 文件 | 内容 |
| --- | --- |
| `index.js` | 渲染模块统一出口 |
| `pipeline.js` | 管线组装、特性开关注册、画质切换 |
| `config.js` | 高 / 中 / 低画质参数 |
| `lighting.js` | 三类光源与灯笼动态阴影 |
| `lighting-model.js` | PBR / Blinn-Phong 可逆切换 |
| `volumetric.js` | 指数雾、地面雾层、灯笼体积光锥 |
| `water-surface.js` | 四层 Gerstner 波、法线扰动、简化月光反射 |
| `post-processing.js` | HDR Bloom、暗角、ACES、sRGB 输出 |
| `lab/main.js` | 独立渲染验收场景 |

## 构建与验收

```bash
node tools/build-render-lab.mjs
node tools/capture-render-comparisons.cjs
```

构建后在支持 WebGL2 的 Chrome / Edge 中直接打开 `render-lab.html`。自动验收会生成：

- `docs/render/screenshots/01-shadow-comparison.png`
- `docs/render/screenshots/02-volumetric-fog-comparison.png`
- `docs/render/screenshots/03-water-comparison.png`
- `docs/render/screenshots/04-post-processing-comparison.png`
- `docs/render/screenshots/render-results.json`
