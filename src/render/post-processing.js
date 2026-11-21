import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { RENDER_QUALITY_PRESETS, resolveRenderQuality } from './config.js'

const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    uOffset: { value: 0.92 },
    uDarkness: { value: 0.52 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uOffset;
    uniform float uDarkness;
    varying vec2 vUv;

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      vec2 centered = vUv - 0.5;
      float vignette = smoothstep(0.78, 0.2, length(centered) * uOffset);
      color.rgb *= mix(1.0 - uDarkness, 1.0, vignette);
      gl_FragColor = color;
    }
  `,
}

export function createPostProcessing(options) {
  const { renderer, scene, camera } = options || {}
  if (!renderer) throw new Error('createPostProcessing: renderer is required')
  if (!scene) throw new Error('createPostProcessing: scene is required')
  if (!camera) throw new Error('createPostProcessing: camera is required')

  let quality = resolveRenderQuality(options.quality)
  let bloomEnabled = true
  let width = Math.max(1, renderer.domElement.clientWidth || window.innerWidth)
  let height = Math.max(1, renderer.domElement.clientHeight || window.innerHeight)
  let pixelRatio = Math.min(
    window.devicePixelRatio || 1,
    RENDER_QUALITY_PRESETS[quality].pixelRatioCap,
  )

  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.18
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  const target = new THREE.WebGLRenderTarget(width * pixelRatio, height * pixelRatio, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    depthBuffer: true,
  })
  target.texture.colorSpace = THREE.LinearSRGBColorSpace

  const composer = new EffectComposer(renderer, target)
  composer.setPixelRatio(pixelRatio)
  composer.setSize(width, height)

  const renderPass = new RenderPass(scene, camera)
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(width, height),
    RENDER_QUALITY_PRESETS[quality].bloomStrength,
    RENDER_QUALITY_PRESETS[quality].bloomRadius,
    RENDER_QUALITY_PRESETS[quality].bloomThreshold,
  )
  const vignettePass = new ShaderPass(VignetteShader)
  const outputPass = new OutputPass()
  composer.addPass(renderPass)
  composer.addPass(bloomPass)
  composer.addPass(vignettePass)
  composer.addPass(outputPass)

  function setBloom(enabled) {
    bloomEnabled = Boolean(enabled)
    bloomPass.enabled = bloomEnabled
  }

  function applyQuality(nextQuality) {
    quality = resolveRenderQuality(nextQuality, quality)
    const preset = RENDER_QUALITY_PRESETS[quality]
    bloomPass.strength = preset.bloomStrength
    bloomPass.radius = preset.bloomRadius
    bloomPass.threshold = preset.bloomThreshold
    resize(width, height)
  }

  function resize(nextWidth, nextHeight, nextPixelRatio) {
    width = Math.max(1, Math.floor(nextWidth || width))
    height = Math.max(1, Math.floor(nextHeight || height))
    pixelRatio = Math.min(
      nextPixelRatio || window.devicePixelRatio || 1,
      RENDER_QUALITY_PRESETS[quality].pixelRatioCap,
    )
    composer.setPixelRatio(pixelRatio)
    composer.setSize(width, height)
  }

  function render(dt) {
    composer.render(dt || 0)
  }

  function dispose() {
    composer.dispose()
    renderPass.dispose?.()
    bloomPass.dispose?.()
    vignettePass.dispose?.()
    outputPass.dispose?.()
    target.dispose()
  }

  setBloom(true)
  resize(width, height, pixelRatio)

  return {
    composer,
    renderPass,
    bloomPass,
    vignettePass,
    outputPass,
    render,
    resize,
    setBloom,
    setQuality: applyQuality,
    getBloomEnabled: () => bloomEnabled,
    dispose,
  }
}
