# PR 描述

标题：`[game] 第二周玩法与 UI：标题界面、R 检查点、小地图迷雾`

## 做了什么

- 新增 `src/ui/title-screen.js`：标题/开始界面，点击任意处 / 开始按钮 / `Enter` / `Space`
  进入游戏，开始时解锁 WebAudio 并切 `title → playing`。
- 新增 `src/game/respawn.js`：`R` 检查点回退 + 落水/卡墙自动重生，同步 `state.checkpoint`。
- 新增 `src/ui/minimap.js`：Canvas 2D 小地图 + 迷雾，走过格揭示，大门/入口/火种/朝向标记。
- `src/ui/hud.js` 新增 `show()` / `hide()`；`hud.css` 补齐 4 个未定义的 `--hud-*` 变量，
  按 `body[data-phase]` 控制 HUD 显隐，并补 720px 以下窄屏布局。
- `src/main.js` 删除「临时强制 playing」占位，按接口顺序接入 TitleScreen / Minimap / Respawn，
  接管 `ending:start` 的状态入口（锁输入、HUD 淡出）。
- 新增 `tools/capture-game-ui.cjs`（截图）与 `tools/check-game-ui.cjs`（自检），
  对应 `npm run capture:game-ui` / `npm run test:game`。
- 同步 `docs/接口文档.md`（v0.4.1 → v0.4.2，新增两个事件与三个组件签名）、README 与
  `docs/game/` 下的交付/试玩文档。

## 为什么

第二周方案里张洋的五项任务（开始界面、`R`、小地图、HUD 打磨、结局入口预留）在 `main`
上仍是缺口：入口靠一句 `state.phase = 'playing'` 硬跳过标题，没有检查点，也没有小地图。
本 PR 只补这些缺口，不改别人的模块。

## 接口变化

事件表新增两行：

```text
game:start      { }                                     TitleScreen → 任意观察者
player:respawn  { reason, count }                       Respawn → UI / Audio
```

无破坏性变更：`createHud` 原有方法签名不变，`window.changming` 诊断 API 未变，
`world` / `render` / `audio` 一行未改。

## 怎么测

```bash
npm run build
npm run test:config
npm run test:maze
npm test
npm run test:game
npm run capture:game-ui
```

当前自动结果：

- `build` 通过，`dist/bundle.js` 2.0mb；
- `test:config` 5 pass，`test:maze` 4 pass；
- `npm test`（Edge）通过：3/3 火种、`gateUnlocked`、开门音效、console error 0；
- `test:game` 全绿：标题期输入锁定（位移 0.000）、迷雾揭示 `0 → 9 → 15 → 21 → 30`、
  `R` 回到安全点（误差 < 0.01m）、卡墙 0.45s 自动重生且落点可行走、700/390 窄屏零重叠；
- 高/低画质 draw calls 仍为 125 / 72（UI 全是 DOM + Canvas 2D）。

## 截图

- [标题 / 开始界面](screenshots/01-title-screen.png)
- [HUD + 小地图迷雾](screenshots/02-hud-minimap.png)
- [火种 focus 提示](screenshots/03-seed-focus.png)
- [R 回检查点提示](screenshots/04-respawn-toast.png)
- [集齐后大门提示](screenshots/05-gate-ready.png)
- [窄屏 700px / 390px](screenshots/06-narrow-700.png)

## 检查

- [x] 没有提交 `node_modules/`、`dist/`
- [x] 未新增外部资产，`assets/LICENSES.md` 无需改动
- [x] 接口变更已同步 `docs/接口文档.md`
- [x] 只改了 `src/game/`、`src/ui/`、`src/main.js`（接入）、`tools/`（本人脚本）与文档

## 已知边界

第一人称仍由引擎 `cameraRig` 承担，正式 `createPlayer`（头部微晃、落水音效）未做；
结局镜头只做了状态入口，12–15s 五点路径留到第三周。
