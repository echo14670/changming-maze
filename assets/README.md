# 资产

- 外部模型、贴图、HDRI 只使用 **CC0 / CC BY** 等允许再分发的素材；
- 每个资产在 `LICENSES.md` 登记：文件名、来源 URL、作者、许可、修改说明；
- 程序化生成的石/苔/砖/木/水纹理优先，减少外部依赖。

最终提交前把 `LICENSES.md` 补全。

## 当前素材构成（v0.5.0）

本项目不包含外部图片、模型或音频文件，所有视觉与听觉素材均由代码实时生成：

| 类别 | 生成位置 | 说明 |
| --- | --- | --- |
| 石墙、苔石、赤砖、大理石、木纹 | `src/world/materials.js` | Canvas 2D 程序化纹理，按四区域配色 |
| 墙体法线细节 | `src/world/materials.js` | `bumpMap` 高度纹理参与光照；法线纹理生成器 `makeNormalMap()` 已提供，接入见第三周计划 |
| 迷宫、地面、墙帽、水渠、外圈残柱 | `src/maze/`、`src/world/maze-mesh.js` | 几何体 + 区域实例化 + 静态合批 |
| 灯塔、礁岛、破船、外海与船灯 | `src/world/lighthouse.js`、`island.js`、`ocean.js` | 代码构建；外海为自定义 shader |
| 地标、标牌、火盆与火种基座 | `src/world/landmarks.js` | 代码构建 |
| 海浪/风声环境音、脚步/拾取/开门音效 | `src/audio/AudioManager.js` | Web Audio 合成，不加载音频文件 |

## 文档用截图

`docs/world/screenshots/` 是四区域实拍截图（1440×900，`main` 场景、`seed=20261205`）：

| 文件 | 区域 | 内容 |
| --- | --- | --- |
| `01-outer-court.png` | 外庭 | 石道、火种微光、小地图迷雾 |
| `02-water-court.png` | 水院 | 浅水渠、月池与水面高光 |
| `03-ember-hall.png` | 烬厅 | 赤砖墙、火盆与暖色灯光 |
| `04-atrium.png` | 中庭 | 大理石墙、灯塔大门与长明之门标记 |

重新生成：

```bash
npm run build
npm run capture:regions
```

脚本见 `tools/capture-region-shots.cjs`：按区域挑选视野最长的可行走格，朝向走廊纵深截图，
HUD 区域名与截图一一对应。