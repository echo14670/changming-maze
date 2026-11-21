import * as THREE from 'three'
import { RENDER_QUALITY_PRESETS, resolveRenderQuality } from './config.js'

const WATER_VERTEX_SHADER = `
  uniform float uTime;
  uniform float uWaveScale;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  varying vec2 vWaterUv;

  void gerstner(vec2 origin, vec2 direction, float steepness, float wavelength,
                float speed, inout vec3 displacement, inout vec3 tangent,
                inout vec3 binormal) {
    float k = 6.2831853 / wavelength;
    float c = sqrt(9.81 / k);
    float phase = k * (dot(direction, origin) - c * speed * uTime);
    float amplitude = steepness / k;
    float s = sin(phase);
    float co = cos(phase);

    displacement.x += direction.x * amplitude * co;
    displacement.z += direction.y * amplitude * co;
    displacement.y += amplitude * s;

    tangent.x += -steepness * direction.x * direction.x * s;
    tangent.y += direction.x * steepness * co;
    tangent.z += -steepness * direction.x * direction.y * s;

    binormal.x += -steepness * direction.x * direction.y * s;
    binormal.y += direction.y * steepness * co;
    binormal.z += -steepness * direction.y * direction.y * s;
  }

  void main() {
    vec3 displaced = position;
    vec3 tangent = vec3(1.0, 0.0, 0.0);
    vec3 binormal = vec3(0.0, 0.0, 1.0);
    vec2 origin = position.xz;

    vec3 waveDisplacement = vec3(0.0);
    gerstner(origin, normalize(vec2(1.0, 0.3)), 0.48 * uWaveScale, 10.4, 0.94,
             waveDisplacement, tangent, binormal);
    gerstner(origin, normalize(vec2(-0.36, 1.0)), 0.33 * uWaveScale, 6.8, 1.1,
             waveDisplacement, tangent, binormal);
    gerstner(origin, normalize(vec2(0.74, -0.67)), 0.2 * uWaveScale, 4.1, 1.28,
             waveDisplacement, tangent, binormal);
    gerstner(origin, normalize(vec2(-0.18, -1.0)), 0.12 * uWaveScale, 2.7, 1.46,
             waveDisplacement, tangent, binormal);

    displaced += waveDisplacement;
    vec3 localNormal = normalize(cross(binormal, tangent));
    vec4 world = modelMatrix * vec4(displaced, 1.0);
    vWorldPosition = world.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * localNormal);
    vWaterUv = uv;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const WATER_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform vec3 uDeepColor;
  uniform vec3 uShallowColor;
  uniform vec3 uHorizonColor;
  uniform vec3 uMoonColor;
  uniform vec3 uMoonDirection;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  varying vec2 vWaterUv;

  float ripple(vec2 p) {
    return sin(p.x * 2.2 + uTime * 1.3) * 0.5 +
           sin(p.y * 3.1 - uTime * 1.1) * 0.28 +
           sin((p.x + p.y) * 4.7 + uTime * 1.9) * 0.16;
  }

  void main() {
    vec2 p = vWorldPosition.xz;
    float e = 0.12;
    float h = ripple(p);
    float hx = ripple(p + vec2(e, 0.0));
    float hz = ripple(p + vec2(0.0, e));
    vec3 detailNormal = normalize(vec3((h - hx) * 0.08, 1.0, (h - hz) * 0.08));
    vec3 normal = normalize(normalize(vWorldNormal) + detailNormal * 0.18);
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);

    float fresnel = 0.02 + 0.98 * pow(1.0 - max(dot(normal, viewDirection), 0.0), 5.0);
    vec3 reflected = reflect(-viewDirection, normal);
    float skyMix = clamp(reflected.y * 0.72 + 0.28, 0.0, 1.0);
    vec3 skyReflection = mix(uHorizonColor, vec3(0.025, 0.075, 0.12), skyMix);
    float moonAlignment = max(dot(normal, normalize(uMoonDirection)), 0.0);
    float broadGlint = pow(moonAlignment, 22.0);
    float sharpGlint = pow(max(dot(reflected, normalize(uMoonDirection)), 0.0), 180.0);
    float stripe = smoothstep(0.88, 1.0, sin(p.x * 0.56 - p.y * 0.23 + uTime * 0.8));

    vec3 deep = mix(uDeepColor, uShallowColor, 0.34 + h * 0.08);
    vec3 color = mix(deep, skyReflection, fresnel * 0.7);
    color += uMoonColor * broadGlint * (0.16 + stripe * 0.22);
    color += uMoonColor * sharpGlint * 2.2;
    color += uShallowColor * pow(max(normal.y, 0.0), 10.0) * 0.08;

    float distanceToCamera = distance(cameraPosition, vWorldPosition);
    float fogAmount = 1.0 - exp(-pow(distanceToCamera * uFogDensity, 1.55));
    color = mix(color, uFogColor, clamp(fogAmount, 0.0, 0.82));
    gl_FragColor = vec4(color, 0.96);
  }
`

/**
 * Gerstner water with analytic normals, procedural micro-normal perturbation
 * and a sky/moon approximation for the first-week reflection spike.
 */
export function createWaterSurface(options) {
  const { scene } = options || {}
  if (!scene) throw new Error('createWaterSurface: scene is required')

  let quality = resolveRenderQuality(options.quality)
  let enabled = true
  const size = options.size || { x: 13, z: 9 }
  const position = options.position || { x: 0, y: 0.12, z: 0 }
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uWaveScale: { value: options.waveScale == null ? 1 : options.waveScale },
      uDeepColor: { value: new THREE.Color(options.deepColor || 0x0a3540) },
      uShallowColor: { value: new THREE.Color(options.shallowColor || 0x3c8187) },
      uHorizonColor: { value: new THREE.Color(options.horizonColor || 0x446f79) },
      uMoonColor: { value: new THREE.Color(options.moonColor || 0xb8e1f0) },
      uMoonDirection: {
        value: new THREE.Vector3(-0.47, 0.66, -0.58).normalize(),
      },
      uFogColor: { value: new THREE.Color(options.fogColor || 0x0b2028) },
      uFogDensity: { value: RENDER_QUALITY_PRESETS[quality].fogDensity * 0.44 },
    },
    vertexShader: WATER_VERTEX_SHADER,
    fragmentShader: WATER_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: true,
    side: THREE.DoubleSide,
  })
  material.userData.fixedLightingModel = true

  let geometry = createGeometry(quality, size)
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = 'GerstnerWaterSurface'
  mesh.position.set(position.x, position.y, position.z)
  mesh.renderOrder = 2
  scene.add(mesh)

  let elapsed = 0

  function createGeometry(nextQuality, dimensions) {
    const segments = RENDER_QUALITY_PRESETS[nextQuality].waterSegments
    const next = new THREE.PlaneGeometry(dimensions.x, dimensions.z, segments, segments)
    next.rotateX(-Math.PI / 2)
    return next
  }

  function applyQuality(nextQuality) {
    quality = resolveRenderQuality(nextQuality, quality)
    const previous = geometry
    geometry = createGeometry(quality, size)
    mesh.geometry = geometry
    previous.dispose()
    material.uniforms.uFogDensity.value =
      RENDER_QUALITY_PRESETS[quality].fogDensity * 0.44
  }

  function setEnabled(value) {
    enabled = Boolean(value)
    mesh.visible = enabled
  }

  function update(dt) {
    if (!enabled) return
    elapsed += Math.min(dt || 0, 0.1)
    material.uniforms.uTime.value = elapsed
  }

  return {
    mesh,
    material,
    update,
    setEnabled,
    setQuality: applyQuality,
    dispose() {
      scene.remove(mesh)
      geometry.dispose()
      material.dispose()
    },
  }
}
