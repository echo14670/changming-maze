import * as THREE from 'three'
import { RENDER_QUALITY_PRESETS, resolveRenderQuality } from './config.js'

const CONE_VERTEX_SHADER = `
  varying vec3 vWorldPosition;
  varying vec2 vSurfaceUv;
  varying float vDepthAlongLight;

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPosition = world.xyz;
    vSurfaceUv = uv;
    vDepthAlongLight = uv.y;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const CONE_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform float uOpacity;
  uniform vec3 uColor;
  uniform vec3 uLanternPosition;
  varying vec3 vWorldPosition;
  varying vec2 vSurfaceUv;
  varying float vDepthAlongLight;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  void main() {
    float endFade = smoothstep(0.0, 0.08, vDepthAlongLight) *
                    (1.0 - smoothstep(0.72, 1.0, vDepthAlongLight));
    float radialFade = pow(max(sin(vDepthAlongLight * 3.14159), 0.0), 0.72);
    float grain = noise(vWorldPosition.xz * 0.19 + vec2(uTime * 0.07, -uTime * 0.04));
    grain = mix(0.58, 1.18, grain);
    float dust = pow(max(dot(normalize(uLanternPosition - vWorldPosition),
                             normalize(vec3(0.0, 1.0, 0.0))), 0.0), 2.0);
    vec3 color = uColor * (0.72 + dust * 0.34);
    float alpha = uOpacity * endFade * radialFade * grain;
    gl_FragColor = vec4(color, alpha);
  }
`

const MIST_VERTEX_SHADER = `
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPosition = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const MIST_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform vec3 uColor;
  varying vec2 vUv;
  varying vec3 vWorldPosition;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(41.3, 289.7))) * 45761.17);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.55;
    for (int i = 0; i < 4; i++) {
      value += noise(p) * amplitude;
      p = p * 2.03 + vec2(13.1, 7.7);
      amplitude *= 0.48;
    }
    return value;
  }

  void main() {
    vec2 flow = vec2(uTime * 0.012, -uTime * 0.007);
    float fog = fbm(vWorldPosition.xz * 0.085 + flow);
    float distanceFade = 1.0 - smoothstep(0.05, 0.5, distance(vUv, vec2(0.5)));
    float alpha = smoothstep(0.22, 0.88, fog) * distanceFade * 0.22;
    gl_FragColor = vec4(uColor, alpha);
  }
`

function createConeMesh(color, opacity) {
  const geometry = new THREE.ConeGeometry(6.2, 21, 36, 12, true)
  geometry.translate(0, -10.5, 0)
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: opacity },
      uColor: { value: new THREE.Color(color) },
      uLanternPosition: { value: new THREE.Vector3() },
    },
    vertexShader: CONE_VERTEX_SHADER,
    fragmentShader: CONE_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  })
  material.userData.fixedLightingModel = true
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = 'LanternVolumetricCone'
  mesh.frustumCulled = false
  mesh.renderOrder = 8
  return mesh
}

function createMistLayer(size, y, color) {
  const geometry = new THREE.PlaneGeometry(size, size, 1, 1)
  geometry.rotateX(-Math.PI / 2)
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
    },
    vertexShader: MIST_VERTEX_SHADER,
    fragmentShader: MIST_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
  })
  material.userData.fixedLightingModel = true
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = 'GroundMist'
  mesh.position.y = y
  mesh.renderOrder = 7
  return mesh
}

export function createVolumetricFog(options) {
  const { scene, camera, lanternLight } = options || {}
  if (!scene) throw new Error('createVolumetricFog: scene is required')
  if (!camera) throw new Error('createVolumetricFog: camera is required')

  let quality = resolveRenderQuality(options.quality)
  let enabled = true
  let elapsed = 0
  const previousFog = scene.fog
  const group = new THREE.Group()
  group.name = 'VolumetricFog'

  const cone = createConeMesh(0xffbf72, RENDER_QUALITY_PRESETS[quality].volumetricOpacity)
  const mistLayers = [
    createMistLayer(80, 0.12, 0x9eb9b6),
    createMistLayer(64, 0.3, 0x70989a),
    createMistLayer(52, 0.62, 0x5c8589),
  ]
  group.add(cone, ...mistLayers)
  scene.add(group)

  const defaultFog = new THREE.FogExp2(0x0b1d25, RENDER_QUALITY_PRESETS[quality].fogDensity)
  scene.fog = defaultFog

  const forward = new THREE.Vector3()
  const quaternion = new THREE.Quaternion()
  const directionDown = new THREE.Vector3(0, -1, 0)
  const target = new THREE.Vector3()

  function applyQuality(nextQuality) {
    quality = resolveRenderQuality(nextQuality, quality)
    const preset = RENDER_QUALITY_PRESETS[quality]
    const color = new THREE.Color(0xffbf72)
    cone.material.uniforms.uOpacity.value = preset.volumetricOpacity
    cone.material.uniforms.uColor.value.copy(color)
    defaultFog.density = preset.fogDensity
  }

  function setEnabled(value) {
    enabled = Boolean(value)
    group.visible = enabled
    scene.fog = enabled ? defaultFog : previousFog
  }

  function update(dt) {
    if (!enabled) return
    elapsed += Math.min(dt || 0, 0.1)
    camera.updateMatrixWorld()
    camera.getWorldDirection(forward)

    const lightPosition = lanternLight?.getWorldPosition
      ? lanternLight.getWorldPosition(target)
      : target.copy(camera.position)
    target.copy(lightPosition).addScaledVector(forward, 10.5)

    cone.position.copy(lightPosition)
    cone.quaternion.copy(
      quaternion.setFromUnitVectors(directionDown, forward),
    )

    cone.material.uniforms.uTime.value = elapsed
    cone.material.uniforms.uLanternPosition.value.copy(lightPosition)
    mistLayers.forEach((layer, index) => {
      layer.material.uniforms.uTime.value = elapsed + index * 5.7
      layer.position.x = Math.sin(elapsed * 0.035 + index) * 1.4
      layer.position.z = Math.cos(elapsed * 0.028 + index * 0.7) * 1.2
    })
  }

  group.visible = enabled

  return {
    group,
    cone,
    mistLayers,
    update,
    setEnabled,
    setQuality: applyQuality,
    dispose() {
      scene.fog = previousFog
      scene.remove(group)
      cone.geometry.dispose()
      cone.material.dispose()
      mistLayers.forEach((layer) => {
        layer.geometry.dispose()
        layer.material.dispose()
      })
    },
  }
}
