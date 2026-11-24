import { createEventBus } from './engine/events.js'
import { createGameState } from './engine/state.js'
import { createRenderer } from './engine/renderer.js'
import { createInput } from './engine/input.js'
import { createCameraRig } from './engine/camera-rig.js'
import { createDiagnostics } from './engine/diagnostics.js'
import { createWorld, createWorldAtmosphere } from './world/index.js'
import { createRenderPipeline } from './render/pipeline.js'
import { RENDER_FEATURE_NAMES } from './render/config.js'
import { createFireSeeds } from './game/fire-seeds.js'
import { createInteraction } from './game/interaction.js'
import { createHud } from './ui/hud.js'
import { AudioManager } from './audio/AudioManager.js'
const audioManager = new AudioManager()

// 在任何地方监听第一次点击
document.addEventListener('pointerdown', () => {
  audioManager.init()
}, { once: true })

const canvas = document.querySelector('#scene')
const placeholder = document.querySelector('.placeholder')

function fail(message, detail) {
  console.error('[changming]', message, detail || '')
  if (placeholder) {
    placeholder.innerHTML = `<h1>长明</h1><p>${message}<br>${detail || '请使用支持 WebGL2 的 Chrome / Edge'}</p>`
  }
  document.body.dataset.ready = 'error'
}

function readQualityParam(params) {
  const value = params.get('quality')
  return value === 'high' || value === 'medium' || value === 'low' ? value : 'high'
}

/**
 * URL 覆盖特性默认值，例如 ?water=1&bloom=0。
 * 供答辩现场切换和 Playwright 回归使用，不改 UI。
 */
function readFeatureOverrides(params) {
  const overrides = {}
  RENDER_FEATURE_NAMES.forEach((name) => {
    const raw = params.get(name)
    if (raw === null) return
    overrides[name] = !['0', 'false', 'off', 'no'].includes(raw.toLowerCase())
  })
  return overrides
}

try {
  if (!canvas) throw new Error('找不到 #scene canvas')

  const params = new URLSearchParams(window.location.search)
  const seedParam = Number(params.get('seed'))
  const seed = Number.isFinite(seedParam) && seedParam > 0 ? seedParam : 20261205

  const events = createEventBus()
  const state = createGameState({ seed, quality: readQualityParam(params) })

  events.on('seed:collect', () => audioManager.playPickup())
  events.on('gate:unlock', () => audioManager.playDoor())

  const renderer = createRenderer(canvas, { quality: state.quality })
  const input = createInput(canvas)
  const atmosphere = createWorldAtmosphere(renderer.scene, renderer.renderer, {
    seed,
  })
  // atmosphere-legacy 只保留夜空/星/月/雾，光照全部交给 render 管线，
  // 避免旧半球光/平行光/区域点光与新管线重复叠加（双份光源、双份阴影）。
  atmosphere.group.children
    .filter((child) => child.isLight)
    .forEach((light) => {
      atmosphere.group.remove(light)
      light.dispose?.()
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

  // 黄勇杰的渲染管线接管主场景：三光源、阴影、体积光、Gerstner 水面、
  // Bloom/ACES、PBR/Blinn 特性开关。旧玩家灯笼由管线 lantern 替换。
  const pipeline = createRenderPipeline({
    scene: renderer.scene,
    camera: renderer.camera,
    renderer: renderer.renderer,
    engine: renderer,
    quality: state.quality,
    features: readFeatureOverrides(params),
    water: {
      size: { x: 320, z: 320 },
      position: { x: 0, y: -1.12, z: 0 },
      deepColor: 0x082f39,
      shallowColor: 0x327b80,
      horizonColor: 0x547a81,
    },
    onFeatureChange(name, enabled) {
      // water 打开时隐藏 B 的整片海面 shader，避免两层海面叠加。
      if (name === 'water' && world.ocean?.mesh) {
        world.ocean.mesh.visible = !enabled
      }
    },
  })

  // 兼容旧诊断/测试接口：playerLantern 现在指向管线里的同一盏 SpotLight。
  const playerLantern = {
    getLight: () => pipeline.lighting.lantern,
    setEnabled: (enabled) => pipeline.setFeature('lantern', enabled),
    isEnabled: () => pipeline.getFeatures().lantern,
    update() {},
  }

  const hud = createHud({ state, events })
  const fireSeeds = createFireSeeds({
    scene: renderer.scene,
    world,
  })
  // 火种在管线之后创建，补一次材质登记，保证 pbr / Blinn 切换覆盖到它们。
  pipeline.lightingModel.refresh()
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
    pipeline,
  })

  // createDiagnostics 会覆盖 window.changming，音频必须在它之后挂载
  window.changming.audio = audioManager
  window.changming.pipeline = pipeline

  // 后处理接管每帧渲染；画质切档时同步管线参数与后处理尺寸。
  renderer.setRenderCallback((dt) => pipeline.render(dt))
  renderer.onQualityChange((quality) => {
    pipeline.setQuality(quality)
    pipeline.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio)
  })

  window.addEventListener('resize', () => {
    renderer.resize()
    pipeline.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio)
  })

  let elapsed = 0
  let activeRegion = ''
  renderer.start((dt) => {
    elapsed += dt
    cameraRig.update(dt)
    playerLantern.update(dt)
    fireSeeds.update(dt, elapsed)
    interaction.update(dt)
    world.update(elapsed, dt)
    pipeline.update(dt)

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
    playerLantern,
    world,
    atmosphere,
    pipeline,
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
