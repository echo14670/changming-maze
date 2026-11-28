// 玩法 / UI 截图：标题界面、HUD + 小地图、火种 focus、大门提示、重生提示。
// 用法：npm run build && node tools/capture-game-ui.cjs
const { chromium } = require('playwright-core')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const SHOT_DIR = path.join(ROOT, 'docs', 'game', 'screenshots')
const PAGE_URL =
  'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/') + '?seed=20261205'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const executablePath = fs.existsSync(EDGE) ? EDGE : CHROME

async function main() {
  fs.mkdirSync(SHOT_DIR, { recursive: true })
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--allow-file-access-from-files'],
  })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 30000 })
  await page.waitForFunction(() => document.body.dataset.ready === 'true', null, {
    timeout: 30000,
  })
  await page.waitForTimeout(500)

  // 1. 标题 / 开始界面
  await page.screenshot({ path: path.join(SHOT_DIR, '01-title-screen.png') })

  // 2. 点击开始 → HUD + 小地图
  await page.click('canvas')
  await page.waitForFunction(() => window.changming.getState().phase === 'playing')
  // 走一段路，让小地图迷雾可见
  await page.keyboard.down('w')
  await page.waitForTimeout(2600)
  await page.keyboard.up('w')
  await page.waitForTimeout(400)
  await page.screenshot({ path: path.join(SHOT_DIR, '02-hud-minimap.png') })

  // 3. 火种 focus 提示
  await page.evaluate(() => window.changming.teleportToSeed(0))
  await page.waitForFunction(
    () => window.changming.getDiagnostics().focus?.type === 'seed',
    null,
    { timeout: 5000 },
  )
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(SHOT_DIR, '03-seed-focus.png') })

  // 4. R 回检查点提示（headless 帧率低，直接调用接口后立刻截，避免错过 2.6s 提示窗口）
  await page.keyboard.press('r')
  await page.waitForFunction(
    () => window.__changming.respawn.getRespawnCount() >= 1,
    null,
    { timeout: 5000 },
  )
  await page.evaluate(() => window.__changming.respawn.respawn('manual'))
  await page.screenshot({ path: path.join(SHOT_DIR, '04-respawn-toast.png') })

  // 5. 集齐后大门提示
  await page.evaluate(() => window.changming.giveSeeds(3))
  await page.evaluate(() => window.changming.teleport([0, 1.62, 6.2]))
  await page.waitForFunction(
    () => window.changming.getDiagnostics().focus?.type === 'gate',
    null,
    { timeout: 5000 },
  )
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(SHOT_DIR, '05-gate-ready.png') })

  await browser.close()
  if (errors.length) {
    console.error('页面报错：', errors.join(' | '))
    process.exitCode = 1
    return
  }
  console.log('已输出 5 张截图到 docs/game/screenshots/')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
