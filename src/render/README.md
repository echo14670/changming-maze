# 渲染模块

负责人：黄勇杰

第二周已将管线接入 `src/main.js`，主场景由后处理管线接管每帧渲染。
`render-lab.html` 保留为独立可视化验收页。

## 管线顺序

```text
场景几何
  -> 月光平行光 / 灯笼聚光 / 火盆点光
  -> 阴影贴图
  -> Gerstner 水面
  -> 指数雾 / 地面雾层 / 灯笼体积光
  -> 相机局部雨丝 / 地面涟漪（可选）
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

`shadow` / `lantern` / `volumetric` / `water` / `rain` / `bloom` / `pbr`

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
| `rain.js` | 相机局部雨丝、程序化地面涟漪 |
| `post-processing.js` | HDR Bloom、暗角、ACES、sRGB 输出 |
| `lab/main.js` | 独立渲染验收场景 |

## 构建与验收

```bash
node tools/build-render-lab.mjs
node tools/capture-render-comparisons.cjs
npm run capture:main-render
```

构建后在支持 WebGL2 的 Chrome / Edge 中直接打开 `render-lab.html`。自动验收会生成：

- `docs/render/screenshots/01-shadow-comparison.png`
- `docs/render/screenshots/02-volumetric-fog-comparison.png`
- `docs/render/screenshots/03-water-comparison.png`
- `docs/render/screenshots/04-post-processing-comparison.png`
- `docs/render/screenshots/render-results.json`
- `docs/render/screenshots/main-01-shadow-comparison.png`
- `docs/render/screenshots/main-02-volumetric-fog-comparison.png`
- `docs/render/screenshots/main-03-water-comparison.png`
- `docs/render/screenshots/main-04-post-processing-comparison.png`
- `docs/render/screenshots/main-05-rain-comparison.png`
- `docs/render/screenshots/main-render-results.json`

第二周完整记录见 [黄勇杰-第二周交付.md](黄勇杰-第二周交付.md)。
