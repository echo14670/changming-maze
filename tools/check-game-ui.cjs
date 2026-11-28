// 玩法 / UI 自检：小地图迷雾、R 检查点、卡墙自动重生、标题期输入锁定、窄屏布局。
// 用法：npm run build && npm run test:game
const { chromium } = require('playwright-core')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const SHOT_DIR = path.join(ROOT, 'docs', 'game', 'screenshots')
const PAGE_URL =
  'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/') + '?seed=20261205'

const CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
]

const results = {}
let previous = 0
const trail = []
function check(name, ok, detail) {
  results[name] = { ok, detail }
  if (!ok) throw new Error(`${name} 失败：${detail}`)
}

async function main() {
  fs.mkdirSync(SHOT_DIR, { recursive: true })
  const executablePath = CANDIDATES.find((candidate) => fs.existsSync(candidate))
  if (!executablePath) {
    console.error('未找到 Chrome / Edge，跳过玩法自检')
    process.exitCode = 1
    return
  }

  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--allow-file-access-from-files'],
  })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })

  try {
    await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 30000 })
    await page.waitForFunction(() => document.body.dataset.ready === 'true', null, {
      timeout: 30000,
    })

    // 1. 标题期锁定输入：此时按 W 不应移动
    const titlePos = await page.evaluate(() => window.changming.getState())
    await page.keyboard.down('w')
    await page.waitForTimeout(900)
    await page.keyboard.up('w')
    const titlePos2 = await page.evaluate(() => window.changming.getState())
    const movedAtTitle = Math.abs(titlePos2.camera.position.z - titlePos.camera.position.z)
    check('标题期输入锁定', titlePos2.phase === 'title' && movedAtTitle < 0.01, `moved=${movedAtTitle}`)

    // 2. 开始游戏
    await page.click('canvas')
    await page.waitForFunction(() => window.changming.getState().phase === 'playing', null, {
      timeout: 5000,
    })
    const afterStart = await page.evaluate(() => window.changming.getState().phase)
    check('title → playing', afterStart === 'playing', afterStart)

    // 3. 小地图迷雾：逐格传送，揭示格数必须严格增长
    const cells = [
      [12, 7],
      [10, 7],
      [8, 7],
      [12, 3],
    ]
    previous = await page.evaluate(() => window.__changming.minimap.getVisitedCount())
    trail.push(previous)
    for (const [row, col] of cells) {
      const center = await page.evaluate(
        ({ row: r, col: c }) => window.__changming.world.cellToWorld(r, c),
        { row, col },
      )
      await page.evaluate(
        (p) => window.changming.teleport([p.x, 1.62, p.z]),
        center,
      )
      await page.waitForTimeout(400)
      const current = await page.evaluate(() => window.__changming.minimap.getVisitedCount())
      check(`迷雾揭示 ${row},${col}`, current > previous, `${previous} → ${current}`)
      previous = current
      trail.push(current)
    }

    // 4. R 手动回检查点
    const respawnBefore = await page.evaluate(() => window.__changming.respawn.getRespawnCount())
    await page.keyboard.press('r')
    await page.waitForFunction(
      (before) => window.__changming.respawn.getRespawnCount() > before,
      respawnBefore,
      { timeout: 5000 },
    )
    const respawnAfter = await page.evaluate(() => ({
      count: window.__changming.respawn.getRespawnCount(),
      safe: window.__changming.respawn.getSafePosition(),
      pos: window.changming.getState().camera.position,
    }))
    const backToSafe =
      Math.abs(respawnAfter.pos.x - respawnAfter.safe.x) < 0.01 &&
      Math.abs(respawnAfter.pos.z - respawnAfter.safe.z) < 0.01
    check('R 回检查点', backToSafe, JSON.stringify(respawnAfter))

    // 5. 站进墙体 → 自动重生，且重生点必须可行走
    const blocked = await page.evaluate(() => {
      const w = window.__changming.world
      for (let row = 0; row < 15; row += 1) {
        for (let col = 0; col < 15; col += 1) {
          const center = w.cellToWorld(row, col)
          if (!w.isWalkable(center.x, center.z, 0.34)) {
            return { x: center.x, z: center.z, row, col }
          }
        }
      }
      return null
    })
    check('找到不可行走坐标', Boolean(blocked), JSON.stringify(blocked))
    const autoBefore = await page.evaluate(() => window.__changming.respawn.getRespawnCount())
    await page.evaluate((p) => window.changming.teleport([p.x, 1.62, p.z]), blocked)
    await page.waitForFunction(
      (before) => window.__changming.respawn.getRespawnCount() > before,
      autoBefore,
      { timeout: 10000 },
    )
    const autoAfter = await page.evaluate(() => {
      const position = window.changming.getState().camera.position
      return {
        count: window.__changming.respawn.getRespawnCount(),
        walkable: window.__changming.world.isWalkable(position.x, position.z, 0.34),
        reason: window.__changming.respawn.getRespawnCount(),
      }
    })
    check('卡墙自动重生到可行走点', autoAfter.walkable === true, JSON.stringify(autoAfter))

    // 6. 窄屏布局：不溢出、不遮挡交互提示与顶部卡片
    for (const width of [700, 390]) {
      await page.setViewportSize({ width, height: 844 })
      await page.waitForTimeout(400)
      const layout = await page.evaluate(() => {
        const intersects = (a, b) =>
          !(a.right < b.left || b.right < a.left || a.bottom < b.top || b.bottom < a.top)
        const map = document.querySelector('#minimap').getBoundingClientRect()
        const prompt = document.querySelector('#interaction-prompt').getBoundingClientRect()
        const objective = document.querySelector('.hud-objective').getBoundingClientRect()
        const region = document.querySelector('.hud-region').getBoundingClientRect()
        const brand = document.querySelector('.hud-brand').getBoundingClientRect()
        return {
          overflow: map.right > window.innerWidth || map.bottom > window.innerHeight,
          overlapPrompt: intersects(map, prompt),
          overlapObjective: intersects(map, objective),
          overlapRegion: intersects(map, region) || intersects(map, brand),
          overlapTop: intersects(region, objective),
        }
      })
      check(
        `窄屏 ${width} 布局`,
        !layout.overflow &&
          !layout.overlapPrompt &&
          !layout.overlapObjective &&
          !layout.overlapRegion &&
          !layout.overlapTop,
        JSON.stringify(layout),
      )
      await page.screenshot({
        path: path.join(SHOT_DIR, width === 700 ? '06-narrow-700.png' : '07-narrow-390.png'),
      })
    }

    check('控制台零 error', errors.length === 0, errors.join(' | '))
  } finally {
    await browser.close()
  }

  fs.writeFileSync(
    path.join(SHOT_DIR, 'game-check-results.json'),
    JSON.stringify({ trail, results }, null, 2),
    'utf8',
  )
  console.log(JSON.stringify({ trail, results }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
