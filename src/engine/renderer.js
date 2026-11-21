import * as THREE from 'three'

export const QUALITY_PRESETS = Object.freeze({
  high: { pixelRatioCap: 2, label: '高' },
  medium: { pixelRatioCap: 1.5, label: '中' },
  low: { pixelRatioCap: 1, label: '低' },
})

/**
 * 引擎渲染器外壳。
 * 负责：WebGLRenderer、Scene、Camera、resize、DPR、主循环、性能统计、特性开关注册。
 * 具体光照/阴影/水面/后期由 render/ 模块通过 registerFeature 接入。
 */
export function createRenderer(canvas, options = {}) {
  if (!canvas) throw new Error('createRenderer: canvas is required')

  const quality = QUALITY_PRESETS[options.quality] ? options.quality : 'high'
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  })

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, QUALITY_PRESETS[quality].pixelRatioCap))
  renderer.setSize(window.innerWidth, window.innerHeight, false)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.setClearColor(0x07131a, 1)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / Math.max(1, window.innerHeight),
    0.1,
    1000,
  )
  camera.position.set(0, 1.6, 8)
  camera.rotation.order = 'YXZ'

  const featureHandlers = new Map()
  const featureState = {
    shadow: true,
    lantern: true,
    volumetric: false,
    water: false,
    rain: false,
    bloom: false,
    pbr: true,
    ssao: false,
  }

  let currentQuality = quality
  let running = false
  let rafId = 0
  let lastTime = 0
  let fps = 0
  let frames = 0
  let fpsWindowStart = performance.now()
  let firstFrame = true
  let renderCallback = null
  const qualityHandlers = new Set()

  function registerFeature(name, handler) {
    if (typeof handler !== 'function') {
      throw new TypeError('registerFeature: handler must be a function')
    }
    featureHandlers.set(name, handler)
    if (name in featureState) handler(featureState[name])
  }

  function setFeature(name, enabled) {
    const handler = featureHandlers.get(name)
    if (!handler) return false
    featureState[name] = Boolean(enabled)
    handler(Boolean(enabled))
    return true
  }

  // 引擎自带的最小特性：阴影总开关。其他特性由 render/ 注册。
  registerFeature('shadow', (enabled) => {
    renderer.shadowMap.enabled = Boolean(enabled)
  })

  function getFeatures() {
    return { ...featureState }
  }

  function resize() {
    const width = window.innerWidth
    const height = Math.max(1, window.innerHeight)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, QUALITY_PRESETS[currentQuality].pixelRatioCap),
    )
    renderer.setSize(width, height, false)
  }

  function setQuality(nextQuality) {
    if (!QUALITY_PRESETS[nextQuality]) return false
    currentQuality = nextQuality
    resize()
    qualityHandlers.forEach((handler) => {
      try {
        handler(currentQuality)
      } catch (error) {
        console.error('[changming] quality handler failed', error)
      }
    })
    return true
  }

  /**
   * 画质变更钩子：渲染管线用它同步阴影贴图 / 水面细分 / Bloom 参数，
   * 引擎自身仍然只负责 pixelRatio 与尺寸。
   * @param {(quality: string) => void} handler
   * @returns {() => void} 取消订阅
   */
  function onQualityChange(handler) {
    if (typeof handler !== 'function') {
      throw new TypeError('onQualityChange: handler must be a function')
    }
    qualityHandlers.add(handler)
    return () => qualityHandlers.delete(handler)
  }

  /**
   * 用后处理/渲染管线接管每帧的 render 调用。传入 null 恢复直接 renderer.render。
   * 接管后关闭 three 的自动 info 重置，由引擎每帧统一 reset，统计包含后处理各 pass。
   * @param {((dt: number) => void) | null} callback
   */
  function setRenderCallback(callback) {
    if (callback !== null && typeof callback !== 'function') {
      throw new TypeError('setRenderCallback: callback must be a function or null')
    }
    renderCallback = callback
    renderer.info.autoReset = callback === null
  }

  function getStats() {
    return {
      fps: Math.round(fps * 10) / 10,
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      quality: currentQuality,
      pixelRatio: renderer.getPixelRatio(),
      renderMode: renderCallback ? 'pipeline' : 'direct',
      size: {
        width: renderer.domElement.width,
        height: renderer.domElement.height,
      },
    }
  }

  function getDiagnostics() {
    const gl = renderer.getContext()
    return {
      ...getStats(),
      webglVersion: gl ? gl.getParameter(gl.VERSION) : 'unavailable',
      glError: gl ? gl.getError() : -1,
      features: getFeatures(),
      cappedDevicePixelRatio: Math.min(window.devicePixelRatio || 1, QUALITY_PRESETS[currentQuality].pixelRatioCap),
    }
  }

  let updateCallback = () => {}

  function tick(now) {
    if (!running) return
    const dt = lastTime === 0 ? 0 : Math.min((now - lastTime) / 1000, 0.05)
    lastTime = now

    updateCallback(dt)
    if (renderCallback) {
      renderer.info.reset()
      renderCallback(dt)
    } else {
      renderer.render(scene, camera)
    }

    frames += 1
    if (now - fpsWindowStart >= 500) {
      fps = (frames * 1000) / (now - fpsWindowStart)
      frames = 0
      fpsWindowStart = now
    }

    if (firstFrame) {
      firstFrame = false
      document.body.dataset.ready = 'true'
    }

    rafId = window.requestAnimationFrame(tick)
  }

  function start(update) {
    if (running) return
    if (typeof update === 'function') updateCallback = update
    running = true
    lastTime = 0
    fpsWindowStart = performance.now()
    rafId = window.requestAnimationFrame(tick)
  }

  function stop() {
    running = false
    window.cancelAnimationFrame(rafId)
  }

  function dispose() {
    stop()
    featureHandlers.clear()
    qualityHandlers.clear()
    renderCallback = null
    renderer.dispose()
  }

  return {
    scene,
    camera,
    renderer,
    start,
    stop,
    resize,
    setQuality,
    setFeature,
    registerFeature,
    setRenderCallback,
    onQualityChange,
    getFeatures,
    getStats,
    getDiagnostics,
    dispose,
  }
}
