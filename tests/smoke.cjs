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
    // 验证 AudioManager 是否挂载
const hasAudio = await page.evaluate(() => !!window.changming.audio);
assert(hasAudio, 'AudioManager 未成功挂载到 window.changming');

// 模拟点击屏幕解锁音频
await page.click('canvas');
const audioUnlocked = await page.evaluate(() => window.changming.audio.unlocked);
assert(audioUnlocked === true, '首次点击后 AudioContext 未解锁');

// 包一层播放方法，验证事件确实触发音频
await page.evaluate(() => {
  const audio = window.changming.audio
  window.__audioCalls = { pickup: 0, door: 0 }
  const pickup = audio.playPickup.bind(audio)
  const door = audio.playDoor.bind(audio)
  audio.playPickup = () => { window.__audioCalls.pickup += 1; return pickup() }
  audio.playDoor = () => { window.__audioCalls.door += 1; return door() }
})

    const diagnostics = await page.evaluate(() => window.changming.getDiagnostics())
    const state = await page.evaluate(() => window.changming.getState())

    assert(diagnostics.webglVersion.includes('WebGL 2'), '未创建 WebGL 2.0 上下文')
    assert(diagnostics.glError === 0, 'gl.getError() 非 0：' + diagnostics.glError)
    assert(diagnostics.drawCalls > 0, 'draw call 为 0')
    assert(diagnostics.triangles > 0, '三角面数为 0')
    assert(diagnostics.fps > 0, 'FPS 为 0')
    assert(diagnostics.renderMode === 'pipeline', '主场景未由 render pipeline 接管')
    assert(diagnostics.phase === 'playing', 'phase 不是 playing')
    assert(diagnostics.screenshotReady === true, 'screenshotReady 不为 true')
    assert(state.seed === 20261205, 'seed 未从 URL 读取')
    assert(diagnostics.features.lantern === true, '玩家灯笼未注册为 feature')

    const pipelineDiagnostics = await page.evaluate(() => window.changming.getPipelineDiagnostics())
    assert(pipelineDiagnostics, '缺少渲染管线诊断 getPipelineDiagnostics()')
    assert(pipelineDiagnostics.quality === 'high', '渲染管线画质不是 high')
    for (const name of ['shadow', 'lantern', 'volumetric', 'water', 'bloom', 'pbr']) {
      assert(name in pipelineDiagnostics.features, `渲染管线缺少特性 ${name}`)
    }

    const lantern = await page.evaluate(() => {
      const light = window.__changming.playerLantern?.getLight?.()
      return light
        ? { type: light.type, visible: light.visible, castShadow: light.castShadow, intensity: light.intensity }
        : null
    })
    assert(lantern?.type === 'SpotLight', '玩家灯笼不是 SpotLight')
    assert(lantern.visible === true, '玩家灯笼默认不可见')
    assert(lantern.castShadow === true, '玩家灯笼没有开启阴影')
    assert(lantern.intensity > 0, '玩家灯笼强度为 0')

    const lanternOff = await page.evaluate(() => window.changming.setFeature('lantern', false))
    assert(lanternOff === true, 'setFeature("lantern", false) 未生效')
    const lanternFeature = await page.evaluate(() => window.changming.getDiagnostics().features.lantern)
    assert(lanternFeature === false, '灯笼开关状态未写入')
    await page.evaluate(() => window.changming.setFeature('lantern', true))

    const beforeZ = state.camera.position.z
    await page.keyboard.down('w')
    await page.waitForTimeout(350)
    await page.keyboard.up('w')
    const afterMove = await page.evaluate(() => window.changming.getState())
    assert(afterMove.camera.position.z < beforeZ - 0.05, 'W 键未让相机前移')

    const qualityChanged = await page.evaluate(() => window.changming.setQuality('low'))
    assert(qualityChanged === true, 'setQuality("low") 未生效')
    const lowQuality = await page.evaluate(() => ({
      diagnostics: window.changming.getDiagnostics(),
      pipeline: window.changming.getPipelineDiagnostics(),
    }))
    assert(lowQuality.diagnostics.quality === 'low', '画质档未切换到 low')
    assert(lowQuality.pipeline.quality === 'low', '渲染管线未同步 low 画质')
    assert(lowQuality.diagnostics.features.bloom === false, 'low 画质未关闭 Bloom')
    assert(lowQuality.diagnostics.features.volumetric === false, 'low 画质未关闭体积光')
    assert(lowQuality.diagnostics.features.pbr === false, 'low 画质未切到 Blinn-Phong')
    await page.evaluate(() => window.changming.setQuality('high'))
    const highQuality = await page.evaluate(() => window.changming.getDiagnostics())
    assert(highQuality.features.bloom === true, 'high 画质未恢复 Bloom')
    assert(highQuality.features.volumetric === true, 'high 画质未恢复体积光')

    const featureToggles = await page.evaluate(() => {
      const results = {}
      for (const name of ['shadow', 'lantern', 'volumetric', 'water', 'bloom', 'pbr']) {
        const off = window.changming.setFeature(name, false)
        const offState = window.changming.getDiagnostics().features[name]
        const on = window.changming.setFeature(name, true)
        const onState = window.changming.getDiagnostics().features[name]
        results[name] = { off, offState, on, onState }
      }
      return results
    })
    for (const [name, result] of Object.entries(featureToggles)) {
      assert(result.off === true && result.offState === false, `setFeature("${name}", false) 未生效`)
      assert(result.on === true && result.onState === true, `setFeature("${name}", true) 未恢复`)
    }

    const waterSwap = await page.evaluate(() => {
      window.changming.setFeature('water', true)
      const enabled = {
        oceanVisible: window.__changming.world.ocean.mesh.visible,
        waterVisible: window.__changming.pipeline.water.mesh.visible,
      }
      window.changming.setFeature('water', false)
      const disabled = {
        oceanVisible: window.__changming.world.ocean.mesh.visible,
        waterVisible: window.__changming.pipeline.water.mesh.visible,
      }
      return { enabled, disabled }
    })
    assert(waterSwap.enabled.waterVisible === true, 'water 特性未显示 Gerstner 水面')
    assert(waterSwap.enabled.oceanVisible === false, 'water 特性未隐藏 B 海面')
    assert(waterSwap.disabled.oceanVisible === true, '关闭 water 后 B 海面未恢复')

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

    const audioAfterPickup = await page.evaluate(() => window.__audioCalls)
    assert(audioAfterPickup.pickup === 3, `拾取音效触发次数不正确：${audioAfterPickup.pickup}`)

    const doorTeleported = await page.evaluate(() => window.changming.teleport([0, 1.62, 6.2]))
    assert(doorTeleported === true, '传送到灯塔大门失败')
    await page.waitForFunction(
      () => window.changming.getDiagnostics().focus?.type === 'gate',
      null,
      { timeout: 5000 },
    )
    await page.keyboard.press('e')
    await page.waitForTimeout(300)

    const audioAfterDoor = await page.evaluate(() => window.__audioCalls)
    assert(audioAfterDoor.door >= 1, '开门音效没有触发')

    await page.screenshot({ path: path.join(SHOT_DIR, `engine-smoke-${config.name.toLowerCase()}.png`) })
    assert(errors.length === 0, '控制台存在错误：' + errors.join(' | '))

    // 1440×900 下记录高/低画质的 FPS 与 draw call；headless 数据只用于横向对比回归。
    const performance = await page.evaluate(async () => {
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
      const sample = async (quality) => {
        window.changming.setQuality(quality)
        // 切档会重建阴影贴图/水面几何并重编译材质，等 3 秒让 FPS 窗口稳定。
        await wait(3000)
        const current = window.changming.getDiagnostics()
        return {
          quality,
          fps: current.fps,
          drawCalls: current.drawCalls,
          triangles: current.triangles,
          features: current.features,
        }
      }
      const high = await sample('high')
      const low = await sample('low')
      await sample('high')
      return { viewport: '1440x900', renderer: 'headless swiftshader', high, low }
    })

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
      audio: audioAfterDoor,
      lantern,
      performance,
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
    } catch (error) {
      results.push({ name: config.name, passed: false, error: error instanceof Error ? error.message : String(error) })
    }
  }

  const attempted = results.filter((result) => !result.skipped)
  const passed = attempted.length > 0 && attempted.every((result) => result.passed)
  fs.writeFileSync(path.join(SHOT_DIR, 'smoke-results.json'), JSON.stringify(results, null, 2), 'utf8')
  console.log(JSON.stringify(results, null, 2))
  if (!passed) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
