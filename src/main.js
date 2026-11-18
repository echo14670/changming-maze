import { createEventBus } from './engine/events.js'
import { createGameState } from './engine/state.js'
import { createRenderer } from './engine/renderer.js'
import { createInput } from './engine/input.js'
import { createCameraRig } from './engine/camera-rig.js'
import { createDiagnostics } from './engine/diagnostics.js'
import { createWorld, createWorldAtmosphere } from './world/index.js'
import { createFireSeeds } from './game/fire-seeds.js'
import { createInteraction } from './game/interaction.js'
import { createHud } from './ui/hud.js'

const canvas = document.querySelector('#scene')
const placeholder = document.querySelector('.placeholder')

function fail(message, detail) {
  console.error('[changming]', message, detail || '')
  if (placeholder) {
    placeholder.innerHTML = `<h1>长明</h1><p>${message}<br>${detail || '请使用支持 WebGL2 的 Chrome / Edge'}</p>`
  }
  document.body.dataset.ready = 'error'
}

try {
  if (!canvas) throw new Error('找不到 #scene canvas')

  const params = new URLSearchParams(window.location.search)
  const seedParam = Number(params.get('seed'))
  const seed = Number.isFinite(seedParam) && seedParam > 0 ? seedParam : 20261205

  const events = createEventBus()
  const state = createGameState({ seed, quality: 'high' })

  const renderer = createRenderer(canvas, { quality: state.quality })
  const input = createInput(canvas)
  const atmosphere = createWorldAtmosphere(renderer.scene, renderer.renderer, {
    seed,
  })
  const world = createWorld({
    scene: renderer.scene,
    seed,
    renderer: renderer.renderer,
    quality: state.quality,
  })
  const cameraRig = createCameraRig({
    camera: renderer.camera,
    input,
    collisionWorld: world.collision,
    getGroundHeight: world.getGroundHeight,
    initialPosition: {
      x: world.entrance.position.x,
      y: 1.62,
      z: world.entrance.position.z,
    },
  })
  cameraRig.setLook(0, -0.035)

  const hud = createHud({ state, events })
  const fireSeeds = createFireSeeds({
    scene: renderer.scene,
    world,
  })
  const interaction = createInteraction({
    camera: renderer.camera,
    cameraRig,
    input,
    world,
    fireSeeds,
    state,
    events,
    hud,
  })

  // 临时：UI 的开始按钮还没接入；先把引擎骨架放到 playing，方便冒烟测试。
  state.phase = 'playing'
  state.checkpoint = {
    col: world.entrance.cell.col,
    row: world.entrance.cell.row,
  }

  const diagnostics = createDiagnostics({
    state,
    renderer,
    cameraRig,
    events,
    interaction,
    fireSeeds,
    world,
  })

  window.addEventListener('resize', () => renderer.resize())

  let elapsed = 0
  let activeRegion = ''
  renderer.start((dt) => {
    elapsed += dt
    cameraRig.update(dt)
    fireSeeds.update(dt, elapsed)
    interaction.update(dt)
    world.update(elapsed, dt)

    const position = cameraRig.getPosition()
    const regionName = world.getRegionAt(position.x, position.z).name
    if (regionName !== activeRegion) {
      activeRegion = regionName
      hud.setRegion(regionName)
    }
  })

  // 方便控制台排查；正式模块接入后可以删。
  window.__changming = {
    renderer,
    input,
    cameraRig,
    world,
    atmosphere,
    fireSeeds,
    interaction,
    hud,
    events,
    state,
    diagnostics,
  }
} catch (error) {
  fail('引擎启动失败', error instanceof Error ? error.message : String(error))
}
