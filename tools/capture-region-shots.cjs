const { chromium } = require('playwright-core')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const OUT_DIR = path.join(ROOT, 'docs', 'world', 'screenshots')
const PAGE_URL =
  'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/') + '?seed=20261205'

const BROWSER = process.env.BROWSER_PATH ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

const REGIONS = [
  { key: 'courtyard', file: '01-outer-court.png' },
  { key: 'water', file: '02-water-court.png' },
  { key: 'ember', file: '03-ember-hall.png' },
  { key: 'atrium', file: '04-atrium.png' },
]

async function main() {
  if (!fs.existsSync(BROWSER)) throw new Error('browser not found: ' + BROWSER)
  if (!fs.existsSync(path.join(ROOT, 'dist', 'bundle.js'))) {
    throw new Error('缺少 dist/bundle.js，请先运行 npm run build')
  }
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const browser = await chromium.launch({
    executablePath: BROWSER,
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--allow-file-access-from-files'],
  })

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    const errors = []
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text())
    })
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))

    await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 30000 })
    await page.waitForFunction(() => document.body.dataset.ready === 'true', null, {
      timeout: 30000,
    })
    // 标题 -> playing：遮罩 pointer-events:none，点击穿透到 canvas。
    await page.mouse.click(720, 450)
    await page.waitForFunction(
      () => document.body.dataset.phase === 'playing',
      null,
      { timeout: 10000 },
    )
    // 等开始 toast 消失，得到干净 HUD。
    await page.waitForTimeout(3200)

    for (const region of REGIONS) {
      const shot = await page.evaluate((regionKey) => {
        const world = window.__changming.world
        const DIRECTIONS = 24
        const MAX_DEPTH = 18

        function clearDepth(x, z, dirX, dirZ) {
          let depth = 0
          for (let step = 0.6; step <= MAX_DEPTH; step += 0.6) {
            if (!world.isWalkable(x + dirX * step, z + dirZ * step, 0.22)) break
            depth = step
          }
          return depth
        }

        let best = null
        for (let row = 0; row < 15; row += 1) {
          for (let col = 0; col < 15; col += 1) {
            const center = world.cellToWorld(row, col)
            if (world.getRegionAt(center.x, center.z).id !== regionKey) continue
            if (!world.isWalkable(center.x, center.z, 0.45)) continue
            // 中庭镜头别贴到灯塔大门上，避免 E 提示挡住画面。
            if (regionKey === 'atrium' && Math.hypot(center.x, center.z - 6.2) < 5.5) continue

            for (let index = 0; index < DIRECTIONS; index += 1) {
              const angle = (index / DIRECTIONS) * Math.PI * 2
              const dirX = Math.sin(angle)
              const dirZ = Math.cos(angle)
              const depth = clearDepth(center.x, center.z, dirX, dirZ)
              if (!best || depth > best.depth) {
                best = {
                  x: center.x,
                  z: center.z,
                  dirX,
                  dirZ,
                  depth,
                  row,
                  col,
                }
              }
            }
          }
        }

        if (!best) return null
        // forward = (-sin yaw, -cos yaw)，所以 yaw = atan2(-dirX, -dirZ)
        best.yaw = Math.atan2(-best.dirX, -best.dirZ)
        return best
      }, region.key)

      if (!shot) throw new Error('没有找到可行走格：' + region.key)
      if (shot.depth < 4) console.warn(`⚠️ ${region.key} 视野偏窄：${shot.depth.toFixed(1)}m`)

      await page.evaluate((goal) => {
        window.changming.teleport([goal.x, 1.62, goal.z])
        window.__changming.cameraRig.setLook(goal.yaw, -0.05)
      }, shot)

      await page.waitForTimeout(1400)
      const label = await page.evaluate(
        () => document.querySelector('#region-name')?.textContent || '',
      )
      await page.screenshot({ path: path.join(OUT_DIR, region.file) })
      console.log(
        `${region.file}  region=${label}  cell=(${shot.row},${shot.col})  view=${shot.depth.toFixed(1)}m`,
      )
    }

    if (errors.length) throw new Error('控制台错误：' + errors.join(' | '))
    console.log('done ->', OUT_DIR)
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})