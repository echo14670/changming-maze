const { chromium } = require('playwright-core')
const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const ROOT = path.resolve(__dirname, '..')
const PAGE_URL =
  'file:///' + path.join(ROOT, 'render-lab.html').replace(/\\/g, '/')
const DIST_SHOT_DIR = path.join(ROOT, 'dist', 'render-lab-shots')
const OUTPUT_DIR = path.join(ROOT, 'docs', 'render', 'screenshots')
const RESULTS_FILE = path.join(OUTPUT_DIR, 'render-results.json')
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

const COMPARISONS = [
  {
    id: '01-shadow-comparison',
    title: '阴影',
    detail: '2048 阴影贴图 / PCF Soft / 灯笼动态投影',
    feature: 'shadow',
    view: 'courtyard',
  },
  {
    id: '02-volumetric-fog-comparison',
    title: '雾与体积光',
    detail: '指数雾 / 地面雾层 / 灯笼体积光锥',
    feature: 'volumetric',
    view: 'courtyard',
  },
  {
    id: '03-water-comparison',
    title: '水面',
    detail: '四层 Gerstner 波 / 法线扰动 / 月光反射',
    feature: 'water',
    view: 'water',
  },
  {
    id: '04-post-processing-comparison',
    title: '后期',
    detail: 'Bloom / ACES / 暗角',
    feature: 'bloom',
    view: 'ember',
  },
]

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function findBrowser() {
  return BROWSERS.find((browser) => fs.existsSync(browser.executablePath))
}

function runBuild() {
  const result = spawnSync(
    process.execPath,
    [path.join(ROOT, 'tools', 'build-render-lab.mjs')],
    {
      cwd: ROOT,
      stdio: 'inherit',
    },
  )
  assert(result.status === 0, 'render lab build failed')
}

async function waitForStableFrame(page, milliseconds = 650) {
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      }),
  )
  await page.waitForTimeout(milliseconds)
}

async function setAllFeatures(page, enabled) {
  await page.evaluate((value) => {
    const features = window.renderLab.getFeatures()
    Object.keys(features).forEach((name) => {
      const changed = window.renderLab.setFeature(name, value)
      if (!changed) throw new Error(`feature toggle failed: ${name}`)
    })
  }, enabled)
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
      const images = await Promise.all([
        loadImage(first),
        loadImage(second),
      ])
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
      const pixelCount = canvas.width * canvas.height
      for (let index = 0; index < firstPixels.length; index += 4) {
        difference += Math.abs(firstPixels[index] - secondPixels[index])
        difference += Math.abs(firstPixels[index + 1] - secondPixels[index + 1])
        difference += Math.abs(firstPixels[index + 2] - secondPixels[index + 2])
      }
      return difference / (pixelCount * 3 * 255)
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
            margin: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            background: #07151b;
            color: #dce7e2;
            font-family: "Microsoft YaHei", "Segoe UI", sans-serif;
          }
          main {
            display: grid;
            grid-template-rows: 92px 1fr 34px;
            height: 100%;
            padding: 22px;
          }
          header {
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            border-bottom: 1px solid rgba(173, 199, 195, 0.24);
            padding-bottom: 15px;
          }
          h1 {
            margin: 0;
            color: #f3e7cf;
            font-family: Georgia, "Songti SC", serif;
            font-size: 23px;
            font-weight: 600;
            letter-spacing: 0.06em;
          }
          p {
            margin: 5px 0 0;
            color: #8ba09d;
            font-size: 11px;
            letter-spacing: 0.08em;
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
            background: rgba(4, 16, 21, 0.78);
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
            <span>CHANGMING / RENDER LAB 01</span>
            <span>1440 × 900 / WEBGL2</span>
          </footer>
        </main>
      </body>
    </html>
  `)
  await page.waitForFunction(() =>
    Array.from(document.images).every((image) => image.complete),
  )
}

async function main() {
  runBuild()
  fs.mkdirSync(DIST_SHOT_DIR, { recursive: true })
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  const browserConfig = findBrowser()
  assert(browserConfig, 'Chrome or Edge was not found')

  const errors = []
  const browser = await chromium.launch({
    executablePath: browserConfig.executablePath,
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--allow-file-access-from-files'],
  })
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  })
  const composePage = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  })

  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))

  try {
    await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 30000 })
    await page.waitForFunction(
      () => window.renderLab?.screenshotReady?.() === true,
      null,
      { timeout: 30000 },
    )
    await setAllFeatures(page, true)
    await page.evaluate(() => document.body.classList.add('is-capturing'))
    await page.evaluate(() => window.renderLab.setQuality('high'))
    await waitForStableFrame(page, 900)

    const initialDiagnostics = await page.evaluate(() =>
      window.renderLab.getDiagnostics(),
    )
    assert(
      initialDiagnostics.webglVersion.includes('WebGL 2'),
      `WebGL2 unavailable: ${initialDiagnostics.webglVersion}`,
    )
    assert(initialDiagnostics.glError === 0, `gl.getError() = ${initialDiagnostics.glError}`)
    assert(initialDiagnostics.drawCalls > 0, 'drawCalls is 0')
    assert(initialDiagnostics.triangles > 0, 'triangles is 0')
    assert(initialDiagnostics.fps > 0, 'fps is 0')
    assert(initialDiagnostics.allFeaturesToggleable, 'a render feature cannot be toggled')

    const comparisons = []
    for (const comparison of COMPARISONS) {
      await setAllFeatures(page, true)
      await page.evaluate(
        ({ view }) => window.renderLab.setView(view, true),
        comparison,
      )
      await waitForStableFrame(page)

      const onPath = path.join(DIST_SHOT_DIR, `${comparison.id}-on.png`)
      const offPath = path.join(DIST_SHOT_DIR, `${comparison.id}-off.png`)
      const onBuffer = await page.screenshot({ path: onPath })

      const toggled = await page.evaluate(
        (feature) => window.renderLab.setFeature(feature, false),
        comparison.feature,
      )
      assert(toggled, `feature toggle failed: ${comparison.feature}`)
      await waitForStableFrame(page)
      const offBuffer = await page.screenshot({ path: offPath })

      const difference = await pixelDifference(page, onBuffer, offBuffer)
      assert(
        difference > 0.003,
        `${comparison.title} comparison is visually indistinguishable (${difference})`,
      )

      await composeComparison(
        composePage,
        comparison,
        onBuffer,
        offBuffer,
      )
      const outputPath = path.join(OUTPUT_DIR, `${comparison.id}.png`)
      await composePage.screenshot({ path: outputPath })

      comparisons.push({
        id: comparison.id,
        feature: comparison.feature,
        view: comparison.view,
        averagePixelDifference: Number((difference * 100).toFixed(3)),
        output: path.relative(ROOT, outputPath).replace(/\\/g, '/'),
      })
    }

    await setAllFeatures(page, true)
    await page.evaluate(() => window.renderLab.setQuality('low'))
    await waitForStableFrame(page, 400)
    const lowQuality = await page.evaluate(() => window.renderLab.getDiagnostics())
    assert(lowQuality.quality === 'low', 'low quality preset did not apply')

    await setAllFeatures(page, true)
    await page.evaluate(() => window.renderLab.setQuality('high'))
    await waitForStableFrame(page, 400)
    const highQuality = await page.evaluate(() => window.renderLab.getDiagnostics())
    assert(highQuality.quality === 'high', 'high quality preset did not restore')

    assert(errors.length === 0, `console errors: ${errors.join(' | ')}`)

    const results = {
      browser: browserConfig.name,
      viewport: '1440x900',
      generatedAt: new Date().toISOString(),
      initialDiagnostics,
      lowQuality,
      highQuality,
      comparisons,
      consoleErrors: errors,
    }
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2), 'utf8')
    console.log(JSON.stringify(results, null, 2))
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
