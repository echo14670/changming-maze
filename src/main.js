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
      if (name === 'water' && world.ocean?.mesh) {
        world.ocean.mesh.visible = !enabled
      }
    },
  })

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

  window.changming.audio = audioManager
  window.changming.pipeline = pipeline

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
  let stepAccumulator = 0 // 【脚步声计时器】

  renderer.start((dt) => {
    elapsed += dt
    cameraRig.update(dt)
    playerLantern.update(dt)
    fireSeeds.update(dt, elapsed)
    interaction.update(dt)
    world.update(elapsed, dt)
    pipeline.update(dt)

    // 【脚步声逻辑】
    const isMoving = 
      input.isDown('KeyW') || 
      input.isDown('KeyA') || 
      input.isDown('KeyS') || 
      input.isDown('KeyD')
    
    if (isMoving) {
      stepAccumulator += dt
      if (stepAccumulator > 0.45) { 
        audioManager.playStep()
        stepAccumulator = 0
      }
    } else {
      stepAccumulator = 0
    }

    const position = cameraRig.getPosition()
    const regionName = world.getRegionAt(position.x, position.z).name
    if (regionName !== activeRegion) {
      activeRegion = regionName
      hud.setRegion(regionName)
    }
  })

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