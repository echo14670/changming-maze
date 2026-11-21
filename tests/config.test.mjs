import test from 'node:test'
import assert from 'node:assert/strict'

import {
  RENDER_FEATURE_NAMES,
  RENDER_QUALITY_FEATURES,
  RENDER_QUALITY_PRESETS,
  resolveQualityFeatures,
  resolveRenderQuality,
} from '../src/render/config.js'

test('render feature names are the six contract features', () => {
  assert.deepEqual([...RENDER_FEATURE_NAMES], [
    'shadow',
    'lantern',
    'volumetric',
    'water',
    'bloom',
    'pbr',
  ])
})

test('every quality preset has params and a complete feature combo', () => {
  for (const quality of ['high', 'medium', 'low']) {
    assert.ok(RENDER_QUALITY_PRESETS[quality], `missing preset ${quality}`)
    assert.ok(RENDER_QUALITY_FEATURES[quality], `missing features ${quality}`)
    for (const name of RENDER_FEATURE_NAMES) {
      assert.equal(
        typeof RENDER_QUALITY_FEATURES[quality][name],
        'boolean',
        `${quality}.${name} must be boolean`,
      )
    }
    assert.ok(
      RENDER_QUALITY_PRESETS[quality].pixelRatioCap >= 1,
      `${quality} pixelRatioCap must be >= 1`,
    )
  }
})

test('low quality really disables the expensive features', () => {
  const low = RENDER_QUALITY_FEATURES.low
  assert.equal(low.volumetric, false)
  assert.equal(low.bloom, false)
  assert.equal(low.pbr, false)
  // 灯笼和阴影保留，低画质仍然要能看清路。
  assert.equal(low.lantern, true)
  assert.equal(low.shadow, true)
})

test('quality tiers form a real ladder, not just pixelRatio changes', () => {
  assert.equal(RENDER_QUALITY_FEATURES.high.volumetric, true)
  assert.equal(RENDER_QUALITY_FEATURES.medium.volumetric, false)
  assert.equal(RENDER_QUALITY_FEATURES.medium.bloom, true)
  assert.equal(RENDER_QUALITY_FEATURES.low.bloom, false)
})

test('quality helpers fall back to high for unknown values', () => {
  assert.equal(resolveRenderQuality('ultra'), 'high')
  assert.equal(resolveQualityFeatures('ultra'), RENDER_QUALITY_FEATURES.high)
  assert.equal(resolveRenderQuality('low'), 'low')
})
