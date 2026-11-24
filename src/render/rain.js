import * as THREE from 'three'
import { RENDER_QUALITY_PRESETS, resolveRenderQuality } from './config.js'

const MAX_RAIN_DROPS = 1800

const RAIN_VERTEX_SHADER = `
  uniform float uTime;
  uniform float uPointScale;
  varying float vDropSeed;

  void main() {
    vec3 displaced = position;
    float dropSeed = fract(sin(dot(position.xz, vec2(12.9898, 78.233))) * 43758.5453);
    float speed = 16.0 + dropSeed * 13.0;
    displaced.y = mod(position.y - uTime * speed, 22.0) - 1.5;
    displaced.x += sin(uTime * 0.35 + position.y * 0.13) * 0.22;

    vec4 viewPosition = modelViewMatrix * vec4(displaced, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    float streakHeight = 9.0 + dropSeed * 10.0;
    gl_PointSize = clamp(
      uPointScale * streakHeight / max(-viewPosition.z, 0.1),
      1.0,
      14.0
    );
    vDropSeed = dropSeed;
  }
`

const RAIN_FRAGMENT_SHADER = `
  uniform float uOpacity;
  varying float vDropSeed;

  void main() {
    vec2 uv = gl_PointCoord;
    float horizontal = 1.0 - smoothstep(0.08, 0.34, abs(uv.x - 0.5));
    float vertical = smoothstep(0.0, 0.16, uv.y) *
                     (1.0 - smoothstep(0.72, 1.0, uv.y));
    float alpha = horizontal * vertical * uOpacity * (0.68 + vDropSeed * 0.32);
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(0.62, 0.78, 0.84, alpha);
  }
`

const RIPPLE_VERTEX_SHADER = `
  varying vec3 vWorldPosition;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPosition = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const RIPPLE_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform float uOpacity;
  varying vec3 vWorldPosition;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec2 p = vWorldPosition.xz * 0.52;
    vec2 cell = floor(p);
    vec2 local = fract(p) - 0.5;
    float seed = hash(cell);
    float phase = fract(uTime * (0.32 + seed * 0.16) + seed);
    float radius = phase * 0.46;
    float distanceToRing = abs(length(local) - radius);
    float ring = 1.0 - smoothstep(0.012, 0.042, distanceToRing);
    float edgeFade = 1.0 - smoothstep(0.18, 0.5, length(local));
    float alpha = ring * (1.0 - phase) * edgeFade * uOpacity;
    if (alpha < 0.008) discard;
    gl_FragColor = vec4(0.48, 0.72, 0.74, alpha);
  }
`

function createDropGeometry() {
  const positions = new Float32Array(MAX_RAIN_DROPS * 3)
  let randomState = 0x4d3c2b1a
  function random() {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0
    return randomState / 0xffffffff
  }

  for (let index = 0; index < MAX_RAIN_DROPS; index += 1) {
    const offset = index * 3
    positions[offset] = (random() - 0.5) * 34
    positions[offset + 1] = random() * 22
    positions[offset + 2] = (random() - 0.5) * 34
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 9, 0), 30)
  return geometry
}

function createRippleMesh() {
  const geometry = new THREE.PlaneGeometry(34, 34, 1, 1)
  geometry.rotateX(-Math.PI / 2)
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: RENDER_QUALITY_PRESETS.high.rainOpacity },
    },
    vertexShader: RIPPLE_VERTEX_SHADER,
    fragmentShader: RIPPLE_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  })
  material.userData.fixedLightingModel = true
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = 'RainGroundRipples'
  mesh.renderOrder = 6
  return mesh
}

/**
 * Camera-local rain and procedural ground ripples. The effect follows the
 * camera so a small particle budget covers the visible corridor at all times.
 */
export function createRainSurface(options) {
  const { scene, camera } = options || {}
  if (!scene) throw new Error('createRainSurface: scene is required')
  if (!camera) throw new Error('createRainSurface: camera is required')

  let quality = resolveRenderQuality(options.quality)
  let enabled = true
  let elapsed = 0

  const group = new THREE.Group()
  group.name = 'RainEffect'

  const dropGeometry = createDropGeometry()
  const dropMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: RENDER_QUALITY_PRESETS[quality].rainOpacity },
      uPointScale: { value: RENDER_QUALITY_PRESETS[quality].rainPointScale },
    },
    vertexShader: RAIN_VERTEX_SHADER,
    fragmentShader: RAIN_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
  })
  dropMaterial.userData.fixedLightingModel = true
  const drops = new THREE.Points(dropGeometry, dropMaterial)
  drops.name = 'RainStreaks'
  drops.frustumCulled = false
  drops.renderOrder = 9

  const ripples = createRippleMesh()
  group.add(drops, ripples)
  scene.add(group)

  function applyQuality(nextQuality) {
    quality = resolveRenderQuality(nextQuality, quality)
    const preset = RENDER_QUALITY_PRESETS[quality]
    dropGeometry.setDrawRange(0, preset.rainCount)
    dropMaterial.uniforms.uOpacity.value = preset.rainOpacity
    dropMaterial.uniforms.uPointScale.value = preset.rainPointScale
    ripples.material.uniforms.uOpacity.value = preset.rainOpacity * 0.32
  }

  function setEnabled(value) {
    enabled = Boolean(value)
    group.visible = enabled
  }

  function update(dt) {
    if (!enabled) return
    elapsed += Math.min(dt || 0, 0.1)
    drops.position.set(camera.position.x, camera.position.y - 7, camera.position.z)
    ripples.position.set(
      camera.position.x,
      camera.position.y - 1.6 + 0.025,
      camera.position.z,
    )
    dropMaterial.uniforms.uTime.value = elapsed
    ripples.material.uniforms.uTime.value = elapsed
  }

  applyQuality(quality)
  group.visible = enabled

  return {
    group,
    drops,
    ripples,
    update,
    setEnabled,
    setQuality: applyQuality,
    dispose() {
      scene.remove(group)
      dropGeometry.dispose()
      dropMaterial.dispose()
      ripples.geometry.dispose()
      ripples.material.dispose()
    },
  }
}
