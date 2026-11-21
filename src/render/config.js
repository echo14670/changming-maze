export const RENDER_FEATURE_NAMES = Object.freeze([
  'shadow',
  'lantern',
  'volumetric',
  'water',
  'bloom',
  'pbr',
])

export const RENDER_QUALITY_PRESETS = Object.freeze({
  high: Object.freeze({
    label: '高',
    pixelRatioCap: 2,
    shadowMapSize: 2048,
    shadowRadius: 2.2,
    waterSegments: 160,
    bloomStrength: 0.46,
    bloomRadius: 0.62,
    bloomThreshold: 0.82,
    volumetricOpacity: 0.2,
    fogDensity: 0.011,
  }),
  medium: Object.freeze({
    label: '中',
    pixelRatioCap: 1.5,
    shadowMapSize: 1536,
    shadowRadius: 1.6,
    waterSegments: 112,
    bloomStrength: 0.34,
    bloomRadius: 0.52,
    bloomThreshold: 0.9,
    volumetricOpacity: 0.14,
    fogDensity: 0.009,
  }),
  low: Object.freeze({
    label: '低',
    pixelRatioCap: 1,
    shadowMapSize: 1024,
    shadowRadius: 1,
    waterSegments: 72,
    bloomStrength: 0.22,
    bloomRadius: 0.42,
    bloomThreshold: 1.05,
    volumetricOpacity: 0.085,
    fogDensity: 0.007,
  }),
})

/**
 * 每个画质档对应的特性组合。切档时由管线统一应用，避免“只改 pixelRatio、
 * 阴影/体积光/Bloom 仍按高画质跑”的假降级。
 * water 默认关闭：主场景外海仍由 B 的 ocean 兜底，需要对比时单独开。
 */
export const RENDER_QUALITY_FEATURES = Object.freeze({
  high: Object.freeze({
    shadow: true,
    lantern: true,
    volumetric: true,
    water: false,
    bloom: true,
    pbr: true,
  }),
  medium: Object.freeze({
    shadow: true,
    lantern: true,
    volumetric: false,
    water: false,
    bloom: true,
    pbr: true,
  }),
  low: Object.freeze({
    shadow: true,
    lantern: true,
    volumetric: false,
    water: false,
    bloom: false,
    pbr: false,
  }),
})

export function resolveRenderQuality(value, fallback = 'high') {
  return RENDER_QUALITY_PRESETS[value] ? value : fallback
}

export function resolveQualityFeatures(value, fallback = 'high') {
  return RENDER_QUALITY_FEATURES[value] || RENDER_QUALITY_FEATURES[fallback]
}
