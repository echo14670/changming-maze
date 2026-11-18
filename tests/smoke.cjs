const { chromium } = require('playwright-core')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const BUNDLE = path.join(ROOT, 'dist', 'bundle.js')
const SHOT_DIR = path.join(__dirname, 'shots')
const PAGE_URL = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/') + '?seed=20261205'

const BROWSERS = [
  { name: 'Chrome', executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' },
  { name: 'Edge', executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' },
]

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function runBrowser(config) {
  if (!fs.existsSync(config.executablePath)) {
    return { name: config.name, skipped: true, reason: 'browser not found' }
  }

  const browser = await chromium.launch({
    executablePath: config.executablePath,
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--allow-file-access-from-files'],
  })

  const errors = []
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push('pageerror: ' + error.message))

  try {
    await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 30000 })
    await page.waitForFunction(() => document.body.dataset.ready === 'true', null, { timeout: 30000 })
    await page.waitForTimeout(700)

    const diagnostics = await page.evaluate(() => window.changming.getDiagnostics())
    const state = await page.evaluate(() => window.changming.getState())

    assert(diagnostics.webglVersion.includes('WebGL 2'), '未创建 WebGL 2.0 上下文')
    assert(diagnostics.glError === 0, 'gl.getError() 非 0：' + diagnostics.glError)
    assert(diagnostics.drawCalls > 0, 'draw call 为 0')
    assert(diagnostics.triangles > 0, '三角面数为 0')
    assert(diagnostics.fps > 0, 'FPS 为 0')
    assert(diagnostics.phase === 'playing', 'phase 不是 playing')
    assert(diagnostics.screenshotReady === true, 'screenshotReady 不为 true')
    assert(state.seed === 20261205, 'seed 未从 URL 读取')

    const beforeZ = state.camera.position.z
    await page.keyboard.down('w')
    await page.waitForTimeout(350)
    await page.keyboard.up('w')
    const afterMove = await page.evaluate(() => window.changming.getState())
    assert(afterMove.camera.position.z < beforeZ - 0.05, 'W 键未让相机前移')

    const qualityChanged = await page.evaluate(() => window.changming.setQuality('low'))
    assert(qualityChanged === true, 'setQuality("low") 未生效')
    const lowQuality = await page.evaluate(() => window.changming.getDiagnostics())
    assert(lowQuality.quality === 'low', '画质档未切换到 low')
    await page.evaluate(() => window.changming.setQuality('high'))

    const shadowOff = await page.evaluate(() => window.changming.setFeature('shadow', false))
    assert(shadowOff === true, 'setFeature("shadow", false) 未生效')
    const afterOff = await page.evaluate(() => window.changming.getDiagnostics())
    assert(afterOff.features.shadow === false, '阴影开关状态未写入')
    await page.evaluate(() => window.changming.setFeature('shadow', true))

    const moved = await page.evaluate(() => window.changming.teleport([2, 1.6, 4]))
    assert(moved === true, 'teleport 未生效')
    const afterTeleport = await page.evaluate(() => window.changming.getState())
    assert(Math.abs(afterTeleport.camera.position.x - 2) < 0.01, 'teleport 后 camera.x 不正确')

    let collectedBefore = 0
    for (let index = 0; index < 3; index += 1) {
      const teleported = await page.evaluate((seedIndex) => window.changming.teleportToSeed(seedIndex), index)
      assert(teleported === true, `teleportToSeed(${index}) 未生效`)
      await page.waitForFunction(
        () => window.changming.getDiagnostics().focus?.type === 'seed',
        null,
        { timeout: 5000 },
      )
      const focus = await page.evaluate(() => window.changming.getDiagnostics().focus)
      assert(focus.type === 'seed', `火种 ${index + 1} 没有进入 focus`)
      const promptVisible = await page.locator('#interaction-prompt').evaluate((element) =>
        element.classList.contains('is-visible'),
      )
      assert(promptVisible, `火种 ${index + 1} 没有显示 E 键提示`)

      if (index === 0) {
        await page.screenshot({ path: path.join(SHOT_DIR, `fire-seed-focus-${config.name.toLowerCase()}.png`) })
      }
      await page.keyboard.press('e')
      await page.waitForFunction(
        (expected) => window.changming.getState().collected === expected,
        collectedBefore + 1,
        { timeout: 3000 },
      )
      collectedBefore += 1
    }

    const afterPickup = await page.evaluate(() => window.changming.getState())
    assert(afterPickup.collected === 3, '拾取三枚火种后 collected 不为 3')
    assert(afterPickup.gateUnlocked === true, '集齐火种后大门未解锁')
    assert(afterPickup.seedIds.length === 3, 'seedIds 数量不正确')

    const doorTeleported = await page.evaluate(() => window.changming.teleport([0, 1.62, 6.2]))
    assert(doorTeleported === true, '传送到灯塔大门失败')
    await page.waitForFunction(
      () => window.changming.getDiagnostics().focus?.type === 'gate',
      null,
      { timeout: 5000 },
    )
    await page.keyboard.press('e')
    await page.waitForTimeout(250)

    await page.screenshot({ path: path.join(SHOT_DIR, `engine-smoke-${config.name.toLowerCase()}.png`) })
    assert(errors.length === 0, '控制台存在错误：' + errors.join(' | '))

    const finalState = await page.evaluate(() => window.changming.getState())
    return {
      name: config.name,
      passed: true,
      diagnostics,
      pickup: {
        collected: finalState.collected,
        seedIds: finalState.seedIds,
        gateUnlocked: finalState.gateUnlocked,
      },
      errors,
    }
  } finally {
    await browser.close()
  }
}

async function main() {
  if (!fs.existsSync(BUNDLE)) {
    console.error('缺少 dist/bundle.js，请先运行 npm run build')
    process.exitCode = 1
    return
  }
  fs.mkdirSync(SHOT_DIR, { recursive: true })

  const results = []
  for (const config of BROWSERS) {
    try {
      const result = await runBrowser(config)
      results.push(result)
      if (!result.skipped) break
    } catch (error) {
      results.push({ name: config.name, passed: false, error: error instanceof Error ? error.message : String(error) })
    }
  }

  const passed = results.some((result) => result.passed)
  fs.writeFileSync(path.join(SHOT_DIR, 'smoke-results.json'), JSON.stringify(results, null, 2), 'utf8')
  console.log(JSON.stringify(results, null, 2))
  if (!passed) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
