import * as THREE from 'three'
import {
  RENDER_FEATURE_NAMES,
  RENDER_QUALITY_FEATURES,
  RENDER_QUALITY_PRESETS,
  resolveRenderQuality,
} from './config.js'
import { createLightingModelController } from './lighting-model.js'
import { createLightingRig } from './lighting.js'
import { createPostProcessing } from './post-processing.js'
import { createVolumetricFog } from './volumetric.js'
import { createWaterSurface } from './water-surface.js'

/**
 * Renderer feature pipeline for Huang Yongjie's module.
 *
 * Pass an engine renderer wrapper as `engine` to register every supported
 * feature with the project's existing `renderer.setFeature()` API.
 */
export function createRenderPipeline(options) {
  const { scene, camera, renderer, engine } = options || {}
  if (!scene) throw new Error('createRenderPipeline: scene is required')
  if (!camera) throw new Error('createRenderPipeline: camera is required')
  if (!renderer) throw new Error('createRenderPipeline: renderer is required')

  let quality = resolveRenderQuality(options.quality)
  const features = {
    ...RENDER_QUALITY_FEATURES[quality],
  }
  const initialFeatures = {
    ...features,
    ...(options.features || {}),
  }
  const onFeatureChange =
    typeof options.onFeatureChange === 'function' ? options.onFeatureChange : null

  const lighting = createLightingRig({
    scene,
    camera,
    quality,
  })
  const lightingModel = createLightingModelController(scene)
  const volumetric = createVolumetricFog({
    scene,
    camera,
    lanternLight: lighting.lantern,
    quality,
  })
  const water = createWaterSurface({
    scene,
    quality,
    ...(options.water || {}),
  })
  const post = createPostProcessing({
    renderer,
    scene,
    camera,
    quality,
  })

  const handlers = {
    shadow(enabled) {
      renderer.shadowMap.enabled = enabled
      renderer.shadowMap.needsUpdate = true
      lighting.setShadows(enabled)
    },
    lantern(enabled) {
      lighting.setLanternEnabled(enabled)
    },
    volumetric(enabled) {
      volumetric.setEnabled(enabled)
    },
    water(enabled) {
      water.setEnabled(enabled)
    },
    bloom(enabled) {
      post.setBloom(enabled)
    },
    pbr(enabled) {
      lightingModel.setPbr(enabled)
    },
  }

  function setFeature(name, enabled) {
    if (!RENDER_FEATURE_NAMES.includes(name)) return false
    const value = Boolean(enabled)
    features[name] = value
    handlers[name](value)
    onFeatureChange?.(name, value)
    return true
  }

  function registerFeatures(targetEngine) {
    if (!targetEngine?.registerFeature) return 0
    let registered = 0
    RENDER_FEATURE_NAMES.forEach((name) => {
      targetEngine.registerFeature(name, (enabled) => setFeature(name, enabled))
      registered += 1
    })
    return registered
  }

  function setQuality(nextQuality) {
    if (!RENDER_QUALITY_PRESETS[nextQuality]) return false
    quality = nextQuality
    lighting.setQuality(quality)
    volumetric.setQuality(quality)
    water.setQuality(quality)
    post.setQuality(quality)
    // 画质档同时决定特性组合；engine 已注册的 handler 负责同步双方状态。
    const presetFeatures = RENDER_QUALITY_FEATURES[quality]
    RENDER_FEATURE_NAMES.forEach((name) => {
      if (!(name in presetFeatures)) return
      const enabled = Boolean(presetFeatures[name])
      if (engine?.setFeature) engine.setFeature(name, enabled)
      else setFeature(name, enabled)
    })
    return true
  }

  function resize(width, height, pixelRatio) {
    post.resize(width, height, pixelRatio)
  }

  function update(dt) {
    lighting.update(dt)
    volumetric.update(dt)
    water.update(dt)
  }

  function render(dt) {
    post.render(dt)
  }

  function dispose() {
    volumetric.dispose()
    water.dispose()
    post.dispose()
    lightingModel.dispose()
    lighting.dispose()
  }

  registerFeatures(engine)
  Object.keys(features).forEach((name) => {
    const enabled = Boolean(initialFeatures[name])
    if (engine?.setFeature) engine.setFeature(name, enabled)
    else setFeature(name, enabled)
  })

  return {
    scene,
    camera,
    renderer,
    lighting,
    lightingModel,
    volumetric,
    water,
    post,
    update,
    render,
    resize,
    setFeature,
    registerFeatures,
    setQuality,
    getFeatures: () => ({ ...features }),
    getQuality: () => quality,
    getQualityFeatures: () => ({ ...RENDER_QUALITY_FEATURES[quality] }),
    getDiagnostics() {
      const gl = renderer.getContext()
      return {
        quality,
        features: { ...features },
        qualityFeatures: { ...RENDER_QUALITY_FEATURES[quality] },
        lightingModelMaterials: lightingModel.getMaterialCount(),
        renderTarget: {
          width: post.composer.readBuffer.width,
          height: post.composer.readBuffer.height,
        },
        webglVersion: gl ? gl.getParameter(gl.VERSION) : 'unavailable',
      }
    },
    dispose,
  }
}
