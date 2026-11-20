import * as THREE from 'three'

/**
 * 第一人称随身灯笼：跟随相机的暖色聚光 + 动态阴影。
 * 位置略低于相机，照射方向与视线一致，给近处石墙地面一圈暖光。
 * 由 renderer.registerFeature('lantern', ...) 控制开关。
 */
export function createPlayerLantern(options) {
  const { scene, camera } = options
  if (!scene) throw new Error('createPlayerLantern: scene is required')
  if (!camera) throw new Error('createPlayerLantern: camera is required')

  const baseIntensity = 26
  const light = new THREE.SpotLight(0xffb45c, baseIntensity, 18, Math.PI / 4.2, 0.55, 1.7)
  light.name = 'PlayerLantern'
  light.castShadow = true
  light.shadow.mapSize.set(1024, 1024)
  light.shadow.camera.near = 0.1
  light.shadow.camera.far = 20
  light.shadow.bias = -0.0006
  light.shadow.normalBias = 0.035

  const target = new THREE.Object3D()
  target.name = 'PlayerLanternTarget'
  light.target = target
  scene.add(light)
  scene.add(target)

  const forward = new THREE.Vector3()
  const right = new THREE.Vector3()
  const position = new THREE.Vector3()
  let enabled = true
  let elapsed = 0

  function update(dt) {
    if (!enabled) return
    elapsed += dt
    camera.updateMatrixWorld()
    camera.getWorldDirection(forward)
    right.set(1, 0, 0).applyQuaternion(camera.quaternion)

    position.copy(camera.position)
    position.addScaledVector(forward, 0.25)
    position.addScaledVector(right, 0.28)
    position.y -= 0.18

    light.position.copy(position)
    target.position.copy(camera.position).addScaledVector(forward, 9)
    target.position.y -= 0.4
    target.updateMatrixWorld()

    // 轻微呼吸，避免完全静止；幅度很小，不影响可读性
    light.intensity = baseIntensity * (0.97 + Math.sin(elapsed * 8.7) * 0.025)
  }

  function setEnabled(value) {
    enabled = Boolean(value)
    light.visible = enabled
  }

  function getLight() {
    return light
  }

  function dispose() {
    scene.remove(light, target)
    light.dispose?.()
    target.removeFromParent()
  }

  update(0)

  return { update, setEnabled, getLight, dispose, get enabled() { return enabled } }
}
