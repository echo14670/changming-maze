import * as THREE from 'three'
import { RENDER_QUALITY_PRESETS, resolveRenderQuality } from './config.js'

/**
 * Three-light rig used by the first-week renderer:
 * moonlight directional light, camera-following lantern spotlight and brazier point light.
 */
export function createLightingRig(options) {
  const { scene, camera } = options || {}
  if (!scene) throw new Error('createLightingRig: scene is required')
  if (!camera) throw new Error('createLightingRig: camera is required')

  let quality = resolveRenderQuality(options.quality)
  const group = new THREE.Group()
  group.name = 'ChangmingRenderLights'

  const ambient = new THREE.HemisphereLight(0x9ec8de, 0x152720, 1.15)
  ambient.name = 'NightAmbient'
  group.add(ambient)

  const moon = new THREE.DirectionalLight(0xb9d7ed, 3.25)
  moon.name = 'MoonDirectionalLight'
  moon.position.set(-19, 28, 13)
  moon.target.position.set(0, 0, -2)
  moon.castShadow = true
  moon.shadow.camera.left = -31
  moon.shadow.camera.right = 31
  moon.shadow.camera.top = 31
  moon.shadow.camera.bottom = -31
  moon.shadow.camera.near = 3
  moon.shadow.camera.far = 82
  moon.shadow.bias = -0.00018
  moon.shadow.normalBias = 0.028
  group.add(moon, moon.target)

  const lantern = new THREE.SpotLight(0xffb45c, 42, 28, Math.PI / 5.2, 0.6, 1.55)
  lantern.name = 'LanternSpotLight'
  lantern.castShadow = true
  lantern.shadow.camera.near = 0.8
  lantern.shadow.camera.far = 32
  lantern.shadow.bias = -0.0005
  lantern.shadow.normalBias = 0.025
  group.add(lantern, lantern.target)

  const brazier = new THREE.PointLight(0xff7b38, 34, 17, 1.8)
  brazier.name = 'BrazierPointLight'
  brazier.position.set(-5.7, 1.3, -2.6)
  group.add(brazier)

  const forward = new THREE.Vector3()
  const right = new THREE.Vector3()
  const offset = new THREE.Vector3()
  const localLanternOffset = new THREE.Vector3(0.24, -0.2, 0.1)
  let elapsed = 0
  let lanternEnabled = true
  let shadowsEnabled = true

  function applyQuality(nextQuality) {
    quality = resolveRenderQuality(nextQuality, quality)
    const preset = RENDER_QUALITY_PRESETS[quality]
    setShadowMapSize(moon, preset.shadowMapSize)
    setShadowMapSize(lantern, preset.shadowMapSize)
    moon.shadow.radius = preset.shadowRadius
    lantern.shadow.radius = preset.shadowRadius
  }

  function setShadowMapSize(light, size) {
    if (light.shadow.mapSize.x === size && light.shadow.mapSize.y === size) return
    light.shadow.mapSize.set(size, size)
    light.shadow.map?.dispose()
    light.shadow.map = null
  }

  function setShadows(enabled) {
    shadowsEnabled = Boolean(enabled)
    moon.castShadow = shadowsEnabled
    lantern.castShadow = shadowsEnabled
  }

  function setLanternEnabled(enabled) {
    lanternEnabled = Boolean(enabled)
    lantern.visible = lanternEnabled
  }

  function update(dt) {
    elapsed += Math.min(dt || 0, 0.1)

    camera.updateMatrixWorld()
    camera.getWorldDirection(forward)
    right.set(1, 0, 0).applyQuaternion(camera.quaternion)
    offset.copy(camera.position)
    offset.add(right.multiplyScalar(0.24))
    offset.y -= 0.2
    lantern.position.copy(offset)
    lantern.target.position.copy(camera.position).addScaledVector(forward, 11)
    lantern.target.position.y -= 0.35
    lantern.target.updateMatrixWorld()

    const lanternFlicker = 0.975 + Math.sin(elapsed * 8.3) * 0.025
    lantern.intensity = lanternEnabled ? 42 * lanternFlicker : 0
    brazier.intensity =
      (shadowsEnabled ? 34 : 31) * (0.88 + Math.sin(elapsed * 12.7) * 0.08)
  }

  scene.add(group)
  applyQuality(quality)
  setShadows(true)
  update(0)

  return {
    group,
    moon,
    lantern,
    brazier,
    ambient,
    update,
    setShadows,
    setLanternEnabled,
    setQuality: applyQuality,
    dispose() {
      scene.remove(group)
      moon.dispose?.()
      lantern.dispose?.()
      brazier.dispose?.()
    },
  }
}
