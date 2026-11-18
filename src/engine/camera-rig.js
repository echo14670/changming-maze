import * as THREE from 'three'

/**
 * 引擎调试相机：第一人称自由移动 + 鼠标环视。
 * 仅用于 11.18–11.19 的引擎验收；正式玩家控制器由 game/player 接管。
 */
export function createCameraRig(options) {
  const {
    camera,
    input,
    collisionWorld: initialCollisionWorld,
    getGroundHeight,
    initialPosition,
  } = options
  if (!camera) throw new Error('createCameraRig: camera is required')
  if (!input) throw new Error('createCameraRig: input is required')

  const position = new THREE.Vector3(0, 1.62, 8)
  const euler = new THREE.Euler(0, 0, 0, 'YXZ')
  const move = new THREE.Vector3()
  const forward = new THREE.Vector3()
  const right = new THREE.Vector3()

  let yaw = 0
  let pitch = 0
  let enabled = true
  let walkSpeed = 2.2
  let runSpeed = 4.0
  let playerRadius = 0.35
  let collisionWorld = initialCollisionWorld || null

  if (initialPosition) {
    position.set(
      Number(initialPosition.x) || 0,
      Number(initialPosition.y) || 1.62,
      Number(initialPosition.z) || 0,
    )
  }

  camera.rotation.order = 'YXZ'
  camera.position.copy(position)
  camera.rotation.set(pitch, yaw, 0)

  function update(dt) {
    if (!enabled) return

    const mouse = input.consumeMouseDelta()
    yaw -= mouse.x * 0.0022
    pitch -= mouse.y * 0.0022
    pitch = Math.max(-1.15, Math.min(1.15, pitch))

    forward.set(-Math.sin(yaw), 0, -Math.cos(yaw))
    right.set(Math.cos(yaw), 0, -Math.sin(yaw))
    move.set(0, 0, 0)

    if (input.isDown('KeyW') || input.isDown('ArrowUp')) move.add(forward)
    if (input.isDown('KeyS') || input.isDown('ArrowDown')) move.sub(forward)
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) move.add(right)
    if (input.isDown('KeyA') || input.isDown('ArrowLeft')) move.sub(right)

    if (move.lengthSq() > 0) {
      move.normalize()
      const speed = input.isDown('ShiftLeft') || input.isDown('ShiftRight') ? runSpeed : walkSpeed
      const dx = move.x * speed * dt
      const dz = move.z * speed * dt
      if (collisionWorld?.resolveMovement) {
        const result = collisionWorld.resolveMovement(
          position.x,
          position.z,
          dx,
          dz,
          playerRadius,
        )
        position.x = result.x
        position.z = result.z
      } else {
        position.addScaledVector(move, speed * dt)
        position.x = Math.max(-36, Math.min(36, position.x))
        position.z = Math.max(-36, Math.min(36, position.z))
      }
    }

    position.y =
      (typeof getGroundHeight === 'function' ? getGroundHeight(position.x, position.z) : 0) +
      1.62
    camera.position.copy(position)
    euler.set(pitch, yaw, 0)
    camera.quaternion.setFromEuler(euler)
  }

  function setPosition(value) {
    if (Array.isArray(value)) {
      position.set(Number(value[0]) || 0, Number(value[1]) || 1.6, Number(value[2]) || 0)
    } else if (value && typeof value === 'object') {
      position.set(Number(value.x) || 0, Number(value.y) || 1.6, Number(value.z) || 0)
    }
    position.y =
      (typeof getGroundHeight === 'function' ? getGroundHeight(position.x, position.z) : 0) +
      1.62
    camera.position.copy(position)
  }

  function getPosition() {
    return { x: position.x, y: position.y, z: position.z }
  }

  function setLook(nextYaw, nextPitch) {
    if (Number.isFinite(nextYaw)) yaw = nextYaw
    if (Number.isFinite(nextPitch)) pitch = Math.max(-1.15, Math.min(1.15, nextPitch))
    euler.set(pitch, yaw, 0)
    camera.quaternion.setFromEuler(euler)
  }

  function getLook() {
    return { yaw, pitch }
  }

  function setEnabled(value) {
    enabled = Boolean(value)
  }

  function setCollisionWorld(nextWorld) {
    collisionWorld = nextWorld || null
  }

  return {
    update,
    setPosition,
    getPosition,
    setLook,
    getLook,
    setEnabled,
    setCollisionWorld,
    get enabled() {
      return enabled
    },
  }
}
