const { chromium } = require('playwright-core')
const { buildSync } = require('esbuild')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const PAGE_URL =
  'file:///' +
  path.join(ROOT, 'index.html').replace(/\\/g, '/') +
  '?seed=20261205&quality=high'
const DIST_SHOT_DIR = path.join(ROOT, 'dist', 'main-render-shots')
const OUTPUT_DIR = path.join(ROOT, 'docs', 'render', 'screenshots')
const RESULTS_FILE = path.join(OUTPUT_DIR, 'main-render-results.json')
const BROWSERS = [
  {
    name: 'Chrome',
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  },
  {
    name: 'Edge',
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  },
]

const CORE_FEATURES = [
  'shadow',
  'lantern',
  'volumetric',
  'water',
  'bloom',
  'pbr',
]

const COMPARISONS = [
  {
    id: 'main-01-shadow-comparison',
    title: '主场景 · 阴影',
    detail: '月光平行光 / 灯笼动态投影 / PCF Soft',
    feature: 'shadow',
    pose: { seedIndex: 2 },
  },
  {
    id: 'main-02-volumetric-fog-comparison',
    title: '主场景 · 雾与体积光',
    detail: '迷宫指数雾 / 地面雾层 / 灯笼体积光',
    feature: 'volumetric',
    pose: { position: [0, 1.62, 35], look: { yaw: 0, pitch: -0.04 } },
  },
  {
    id: 'main-03-water-comparison',
    title: '主场景 · 水面',
    detail: '外海 Gerstner 波 / 法线扰动 / 月光反射',
    feature: 'water',
    pose: {
      position: [0, 1.62, 43],
      look: { yaw: Math.PI, pitch: -0.18 },
    },
  },
  {
    id: 'main-04-post-processing-comparison',
    title: '主场景 · 后期',
    detail: 'HDR Bloom / ACES / 暗角',
    feature: 'bloom',
    pose: { seedIndex: 1 },
  },
  {
    id: 'main-05-rain-comparison',
    title: '主场景 · 雨与涟漪',
    detail: '相机局部雨丝 / 程序化地面涟漪',
    feature: 'rain',
    minimumDifference: 0.0005,
    pose: { position: [0, 1.62, 35], look: { yaw: 0, pitch: -0.08 } },
  },
]

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function runBuild() {
  buildSync({
    absWorkingDir: ROOT,
    entryPoints: ['src/main.js'],
    outfile: 'dist/bundle.js',
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['chrome120', 'edge120'],
    sourcemap: false,
    minify: false,
    legalComments: 'none',
  })
}

function availableBrowsers() {
  return BROWSERS.filter((browser) => fs.existsSync(browser.executablePath))
}

async function waitForStableFrame(page, milliseconds = 850) {
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      }),
  )
  await page.waitForTimeout(milliseconds)
}

async function preparePage(browserConfig) {
  const browser = await chromium.launch({
    executablePath: browserConfig.executablePath,
    headless: true,
    args: [
      '--enable-unsafe-swiftshader',
      '--allow-file-access-from-files',
      '--disable-background-timer-throttling',
    ],
  })
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  })
  const errors = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))

  await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 30000 })
  await page.waitForFunction(
    () => window.changming?.screenshotReady?.() === true,
    null,
    { timeout: 30000 },
  )
  await page.addStyleTag({
    content:
      '#hud, .placeholder { display: none !important; } body { background: #02070a !important; }',
  })
  return { browser, page, errors }
}

async function applyComparisonPose(page, comparison, featureEnabled) {
  await page.evaluate(
    ({ coreFeatures, comparison, featureEnabled }) => {
      const api = window.changming
      const debug = window.__changming
      if (!api || !debug) throw new Error('main scene diagnostics unavailable')

      const pose = comparison.pose
      if (Number.isInteger(pose.seedIndex)) {
        if (!api.teleportToSeed(pose.seedIndex)) {
          throw new Error(`teleportToSeed(${pose.seedIndex}) failed`)
        }
      } else {
        api.teleport(pose.position)
      }
      if (pose.look) {
        debug.cameraRig.setLook(pose.look.yaw, pose.look.pitch)
      }

      for (const name of coreFeatures) {
        if (!api.setFeature(name, true)) {
          throw new Error(`feature enable failed: ${name}`)
        }
      }
      api.setFeature('rain', comparison.feature === 'rain' && featureEnabled)
      if (comparison.feature !== 'rain' && !api.setFeature(comparison.feature, featureEnabled)) {
        throw new Error(`feature toggle failed: ${comparison.feature}`)
      }
    },
    { coreFeatures: CORE_FEATURES, comparison, featureEnabled },
  )
  await waitForStableFrame(page, featureEnabled ? 900 : 700)
}

async function pixelDifference(page, firstBuffer, secondBuffer) {
  return page.evaluate(
    async ({ first, second }) => {
      function loadImage(source) {
        return new Promise((resolve, reject) => {
          const image = new Image()
          image.onload = () => resolve(image)
          image.onerror = reject
          image.src = `data:image/png;base64,${source}`
        })
      }

      const images = await Promise.all([loadImage(first), loadImage(second)])
      const canvas = document.createElement('canvas')
      canvas.width = images[0].naturalWidth
      canvas.height = images[0].naturalHeight
      const context = canvas.getContext('2d', { willReadFrequently: true })
      context.drawImage(images[0], 0, 0)
      const firstPixels = context.getImageData(0, 0, canvas.width, canvas.height).data
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.drawImage(images[1], 0, 0)
      const secondPixels = context.getImageData(0, 0, canvas.width, canvas.height).data
      let difference = 0
      for (let index = 0; index < firstPixels.length; index += 4) {
        difference += Math.abs(firstPixels[index] - secondPixels[index])
        difference += Math.abs(firstPixels[index + 1] - secondPixels[index + 1])
        difference += Math.abs(firstPixels[index + 2] - secondPixels[index + 2])
      }
      return difference / ((canvas.width * canvas.height * 3 * 255))
    },
    {
      first: firstBuffer.toString('base64'),
      second: secondBuffer.toString('base64'),
    },
  )
}

async function composeComparison(page, comparison, firstBuffer, secondBuffer) {
  const first = firstBuffer.toString('base64')
  const second = secondBuffer.toString('base64')
  await page.setContent(`
    <!doctype html>
    <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <style>
          * { box-sizing: border-box; }
          html, body {
            width: 100%;
            height: 100%;
            margin: 0;
            overflow: hidden;
            background: #07151b;
            color: #dce7e2;
            font-family: "Microsoft YaHei", "Segoe UI", sans-serif;
          }
          main {
            display: grid;
            grid-template-rows: 90px 1fr 34px;
            height: 100%;
            padding: 22px;
          }
          header {
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            border-bottom: 1px solid rgba(173, 199, 195, 0.24);
            padding-bottom: 14px;
          }
          h1 {
            margin: 0;
            color: #f3e7cf;
            font-family: Georgia, "Songti SC", serif;
            font-size: 23px;
            font-weight: 600;
            letter-spacing: 0.05em;
          }
          p {
            margin: 5px 0 0;
            color: #8ba09d;
            font-size: 11px;
            letter-spacing: 0.07em;
          }
          .tag {
            color: #ffb45c;
            font-size: 10px;
            letter-spacing: 0.16em;
          }
          .images {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            min-height: 0;
            padding-top: 12px;
          }
          figure {
            position: relative;
            min-width: 0;
            min-height: 0;
            margin: 0;
            overflow: hidden;
            border: 1px solid rgba(173, 199, 195, 0.2);
            background: #02070a;
          }
          img {
            display: block;
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          figcaption {
            position: absolute;
            left: 12px;
            top: 12px;
            padding: 5px 8px;
            border-left: 2px solid #ffb45c;
            background: rgba(4, 16, 21, 0.8);
            color: #e8efe9;
            font-size: 10px;
            letter-spacing: 0.13em;
          }
          footer {
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            color: #6e8582;
            font-size: 9px;
            letter-spacing: 0.12em;
          }
        </style>
      </head>
      <body>
        <main>
          <header>
            <div>
              <h1>${comparison.title}</h1>
              <p>${comparison.detail}</p>
            </div>
            <span class="tag">ON / OFF</span>
          </header>
          <section class="images">
            <figure>
              <img src="data:image/png;base64,${first}" alt="开启">
              <figcaption>开启</figcaption>
            </figure>
            <figure>
              <img src="data:image/png;base64,${second}" alt="关闭">
              <figcaption>关闭</figcaption>
            </figure>
          </section>
          <footer>
            <span>CHANGMING / MAIN SCENE</span>
            <span>1440 × 900 / WEBGL2 / HIGH</span>
          </footer>
        </main>
      </body>
    </html>
  `)
  await page.waitForFunction(() =>
    Array.from(document.images).every((image) => image.complete),
  )
}

async function captureComparisons(browserConfig, composePage) {
  const { browser, page, errors } = await preparePage(browserConfig)
  try {
    await page.evaluate(() => window.changming.setQuality('high'))
    await waitForStableFrame(page, 1200)
    const comparisons = []

    for (const comparison of COMPARISONS) {
      await applyComparisonPose(page, comparison, true)
      const onPath = path.join(DIST_SHOT_DIR, `${comparison.id}-on.png`)
      const offPath = path.join(DIST_SHOT_DIR, `${comparison.id}-off.png`)
      const onBuffer = await page.screenshot({ path: onPath })

      await applyComparisonPose(page, comparison, false)
      const offBuffer = await page.screenshot({ path: offPath })
      const difference = await pixelDifference(page, onBuffer, offBuffer)
      assert(
        difference > (comparison.minimumDifference ?? 0.001),
        `${comparison.title} 开关前后无明显差异 (${difference})`,
      )

      await composeComparison(composePage, comparison, onBuffer, offBuffer)
      const outputPath = path.join(OUTPUT_DIR, `${comparison.id}.png`)
      await composePage.screenshot({ path: outputPath })
      comparisons.push({
        id: comparison.id,
        feature: comparison.feature,
        averagePixelDifference: Number((difference * 100).toFixed(3)),
        output: path.relative(ROOT, outputPath).replace(/\\/g, '/'),
      })
    }

    assert(errors.length === 0, `console errors: ${errors.join(' | ')}`)
    return {
      browser: browserConfig.name,
      comparisons,
      consoleErrors: errors,
    }
  } finally {
    await browser.close()
  }
}

async function samplePerformance(browserConfig) {
  const { browser, page, errors } = await preparePage(browserConfig)
  try {
    await page.evaluate(() => {
      window.changming.teleport([0, 1.62, 35])
      window.__changming.cameraRig.setLook(0, -0.04)
      window.changming.setQuality('high')
    })
    await waitForStableFrame(page, 3500)

    async function sample(quality) {
      return page.evaluate(async (nextQuality) => {
        const api = window.changming
        api.setQuality(nextQuality)
        const wait = (milliseconds) =>
          new Promise((resolve) => setTimeout(resolve, milliseconds))

        await wait(3500)
        await new Promise((resolve) => requestAnimationFrame(resolve))

        const result = await new Promise((resolve) => {
          let frames = 0
          const startedAt = performance.now()
          function frame(now) {
            frames += 1
            if (now - startedAt >= 2500) {
              resolve({
                elapsedMs: now - startedAt,
                frames,
              })
              return
            }
            requestAnimationFrame(frame)
          }
          requestAnimationFrame(frame)
        })

        const diagnostics = api.getDiagnostics()
        return {
          quality: diagnostics.quality,
          fps: Number(((result.frames * 1000) / result.elapsedMs).toFixed(1)),
          sampleFrames: result.frames,
          drawCalls: diagnostics.drawCalls,
          triangles: diagnostics.triangles,
          features: diagnostics.features,
          pixelRatio: diagnostics.pixelRatio,
          size: diagnostics.size,
        }
      }, quality)
    }

    const high = await sample('high')
    const low = await sample('low')
    await page.evaluate(() => window.changming.setQuality('high'))
    await page.waitForTimeout(1000)

    const environment = await page.evaluate(() => {
      const gl = window.changming.getDiagnostics()
      const context = window.__changming.renderer.renderer.getContext()
      const debugInfo = context.getExtension('WEBGL_debug_renderer_info')
      return {
        webglVersion: gl.webglVersion,
        unmaskedRenderer: debugInfo
          ? context.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
          : 'unavailable',
        glError: gl.glError,
      }
    })
    assert(errors.length === 0, `console errors: ${errors.join(' | ')}`)
    assert(environment.glError === 0, `gl.getError() = ${environment.glError}`)
    return {
      browser: browserConfig.name,
      viewport: '1440x900',
      mode: 'headless',
      ...environment,
      high,
      low,
      consoleErrors: errors,
    }
  } finally {
    await browser.close()
  }
}

async function main() {
  runBuild()
  fs.mkdirSync(DIST_SHOT_DIR, { recursive: true })
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  const browsers = availableBrowsers()
  assert(browsers.length > 0, 'Chrome or Edge was not found')

  const composeBrowser = await chromium.launch({
    executablePath: browsers[0].executablePath,
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--allow-file-access-from-files'],
  })
  const composePage = await composeBrowser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  })

  let capture
  try {
    capture = await captureComparisons(browsers[0], composePage)
  } finally {
    await composeBrowser.close()
  }

  const performance = []
  for (const browser of browsers) {
    performance.push(await samplePerformance(browser))
  }

  const results = {
    generatedAt: new Date().toISOString(),
    seed: 20261205,
    viewport: '1440x900',
    note:
      'Headless numbers are regression measurements on the detected GPU and may differ from an interactive session.',
    capture,
    performance,
  }
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2), 'utf8')
  console.log(JSON.stringify(results, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
