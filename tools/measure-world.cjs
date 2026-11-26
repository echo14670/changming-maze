const { chromium } = require('playwright-core')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const PAGE_URL =
  'file:///' +
  path.join(ROOT, 'index.html').replace(/\\/g, '/') +
  '?seed=20261205&nointro=1'
const BROWSERS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
]

async function main() {
  const executablePath = BROWSERS.find((candidate) => fs.existsSync(candidate))
  if (!executablePath) throw new Error('Chrome / Edge not found')
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--allow-file-access-from-files'],
  })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  try {
    await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 30000 })
    await page.waitForFunction(() => document.body.dataset.ready === 'true', null, {
      timeout: 30000,
    })
    await page.waitForTimeout(1200)
    const result = await page.evaluate(() => {
      const { renderer, world } = window.__changming
      const meshes = []
      const byMaterial = new Map()
      let instancedMeshes = 0
      let instancedItems = 0
      let triangles = 0

      world.root.traverse((object) => {
        if (!object.isMesh) return
        const count = object.isInstancedMesh ? object.count : 1
        const material = Array.isArray(object.material)
          ? object.material
          : [object.material]
        const indexedTriangles = object.geometry?.index
          ? object.geometry.index.count / 3
          : (object.geometry?.attributes?.position?.count || 0) / 3
        triangles += indexedTriangles * count
        meshes.push({
          name: object.name || '(unnamed)',
          type: object.type,
          count,
          visible: object.visible,
          castShadow: object.castShadow,
          receiveShadow: object.receiveShadow,
          transparent: material.some((item) => item?.transparent),
          material:
            material
              .map((item) => item?.name || item?.color?.getHexString?.() || item?.type)
              .join(',') || 'none',
        })
        if (object.isInstancedMesh) {
          instancedMeshes += 1
          instancedItems += object.count
        }
        material.forEach((item) => {
          if (!item) return
          const key = item.uuid
          if (!byMaterial.has(key)) {
            byMaterial.set(key, {
              type: item.type,
              color: item.color?.getHexString?.() || null,
              transparent: item.transparent,
              meshes: 0,
              items: 0,
            })
          }
          const materialStat = byMaterial.get(key)
          materialStat.meshes += 1
          materialStat.items += count
        })
      })

      const diagnostics = window.changming.getDiagnostics()
      return {
        renderCalls: diagnostics.drawCalls,
        renderTriangles: diagnostics.triangles,
        fps: diagnostics.fps,
        quality: diagnostics.quality,
        worldStats: world.stats,
        meshNodes: meshes.length,
        instancedMeshes,
        instancedItems,
        sceneTriangles: Math.round(triangles),
        uniqueMaterials: byMaterial.size,
        materials: [...byMaterial.values()].sort((a, b) => b.items - a.items),
        meshes,
      }
    })
    console.log(JSON.stringify(result, null, 2))
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
