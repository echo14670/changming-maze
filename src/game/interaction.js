import * as THREE from 'three'

const TMP_DIRECTION = new THREE.Vector3()
const TMP_TO_TARGET = new THREE.Vector3()
const TMP_CAMERA_POSITION = new THREE.Vector3()

function hasLineOfSight(world, from, to) {
  if (!world?.collision?.isBlocked) return true
  const dx = to.x - from.x
  const dz = to.z - from.z
  const horizontalDistance = Math.hypot(dx, dz)
  for (let step = 1; step < 14; step += 1) {
    const t = step / 14
    const distanceFromPlayer = horizontalDistance * t
    const distanceToTarget = horizontalDistance * (1 - t)
    if (distanceFromPlayer < 0.35 || distanceToTarget < 0.72) continue
    if (world.collision.isBlocked(from.x + dx * t, from.z + dz * t, 0.08)) {
      return false
    }
  }
  return true
}

/**
 * 距离 + 视线双判定。近距离允许明显偏离准星，避免必须在像素级对准小球。
 */
export function createInteraction(options) {
  const { camera, cameraRig, input, world, fireSeeds, state, events, hud } = options
  if (!camera || !cameraRig || !input || !world || !fireSeeds || !state) {
    throw new Error('createInteraction: missing required dependencies')
  }

  let focused = null
  let nearestDistance = Infinity
  let gateWasOpened = false

  const offKeyDown = input.onKeyDown((event) => {
    if (event.code !== 'KeyE' || event.repeat) return
    if (state.phase !== 'playing') return
    tryInteract()
  })

  function getAim() {
    return camera.getWorldDirection(TMP_DIRECTION).normalize()
  }

  function scoreSeed(seed) {
    const position = seed.getPosition()
    TMP_CAMERA_POSITION.copy(camera.position)
    TMP_TO_TARGET.copy(position).sub(TMP_CAMERA_POSITION)
    const distance = TMP_TO_TARGET.length()
    const aim = TMP_TO_TARGET.normalize().dot(getAim())

    // 2m 内只要靠近就能聚焦；2–4.5m 需要把目标放进较宽的视线锥体。
    const inEasyRange = distance <= 2.05
    const inLookRange = distance <= 4.5 && aim >= 0.18
    if (!inEasyRange && !inLookRange) return null
    if (!hasLineOfSight(world, TMP_CAMERA_POSITION, position)) return null
    return {
      type: 'seed',
      id: seed.id,
      seed,
      distance,
      aim,
      score: distance - Math.max(0, aim) * 0.42,
    }
  }

  function scoreGate() {
    if (gateWasOpened) return null
    const gatePosition = new THREE.Vector3(
      world.lighthouseDoor.position.x,
      world.lighthouseDoor.position.y,
      world.lighthouseDoor.position.z,
    )
    TMP_CAMERA_POSITION.copy(camera.position)
    TMP_TO_TARGET.copy(gatePosition).sub(TMP_CAMERA_POSITION)
    const distance = TMP_TO_TARGET.length()
    if (distance > 2.65) return null
    return {
      type: 'gate',
      id: 'lighthouse-door',
      distance,
      aim: TMP_TO_TARGET.normalize().dot(getAim()),
      score: distance - 0.3,
    }
  }

  function updateFocus() {
    const candidates = []
    for (const seed of fireSeeds.getActive()) {
      const candidate = scoreSeed(seed)
      if (candidate) candidates.push(candidate)
    }
    const gate = scoreGate()
    if (gate) candidates.push(gate)

    candidates.sort((a, b) => a.score - b.score)
    const next = candidates[0] || null
    nearestDistance = Infinity
    for (const seed of fireSeeds.getActive()) {
      const position = seed.getPosition()
      nearestDistance = Math.min(
        nearestDistance,
        camera.position.distanceTo(position),
      )
    }

    if (focused?.id !== next?.id) {
      fireSeeds.setFocused(next?.type === 'seed' ? next.id : null)
    }
    focused = next

    if (focused?.type === 'seed') {
      const seed = focused.seed
      hud?.setInteraction({
        key: 'E',
        title: `拾取${seed.regionLabel}火种`,
        detail: `距离 ${focused.distance.toFixed(1)} m · ${state.collected}/3`,
        tone: 'ember',
      })
    } else if (focused?.type === 'gate') {
      const remaining = Math.max(0, 3 - state.collected)
      hud?.setInteraction({
        key: 'E',
        title: remaining > 0 ? '灯塔大门尚未回应' : '将火种送入主灯',
        detail:
          remaining > 0
            ? `还差 ${remaining} 枚火种`
            : '长明之门已经准备好',
        tone: remaining > 0 ? 'muted' : 'ember',
      })
    } else if (nearestDistance <= 6.5) {
      hud?.setInteraction(null)
      hud?.setGuide('附近有火种 · 靠近后按 E 拾取')
    } else if (state.collected >= 3 && !gateWasOpened) {
      hud?.setInteraction(null)
      hud?.setGuide('火种已集齐 · 返回中央灯塔大门')
    } else {
      hud?.setInteraction(null)
      hud?.setGuide('沿发光地标探索四区 · 找到 3 枚火种')
    }
  }

  function collectFocusedSeed(seed) {
    if (seed.collected) return false
    if (state.seedIds.includes(seed.id)) return false
    fireSeeds.collect(seed.id)
    state.seedIds.push(seed.id)
    state.collected = Math.min(3, state.seedIds.length)
    if (state.collected >= 3) state.gateUnlocked = true

    events?.emit('seed:collect', {
      id: seed.id,
      region: seed.region,
      collected: state.collected,
      total: 3,
    })
    if (state.gateUnlocked) events?.emit('gate:unlock', {})

    hud?.setCount(state.collected, 3)
    hud?.showToast(
      `拾得${seed.regionLabel}火种 · ${state.collected}/3`,
      state.collected >= 3 ? '返回中央灯塔大门' : '继续寻找剩下的火种',
    )
    focused = null
    return true
  }

  function openGate() {
    if (gateWasOpened) return true
    if (state.collected < 3) {
      hud?.showToast(
        `还差 ${3 - state.collected} 枚火种`,
        '大门没有回应，先找齐三处火光',
      )
      return false
    }
    gateWasOpened = true
    state.gateUnlocked = true
    world.setDoorOpen(1)
    world.setBeaconIntensity(1)
    events?.emit('gate:unlock', { opened: true })
    hud?.showToast('火种已经送入主灯', '长明之光正在穿透雾海')
    focused = null
    return true
  }

  function tryInteract() {
    if (focused?.type === 'seed') return collectFocusedSeed(focused.seed)
    if (focused?.type === 'gate') return openGate()
    if (nearestDistance <= 6.5) {
      hud?.showToast('再靠近一点', '走近火种后按 E 拾取')
    }
    return false
  }

  function update() {
    if (state.phase !== 'playing') {
      focused = null
      fireSeeds.setFocused(null)
      hud?.setInteraction(null)
      return
    }
    updateFocus()
  }

  function teleportToSeed(index = 0) {
    const seed = fireSeeds.seeds[index]
    if (!seed || seed.collected) return false
    const target = seed.getPosition()
    const candidates = [
      { x: target.x + 2.1, z: target.z },
      { x: target.x - 2.1, z: target.z },
      { x: target.x, z: target.z + 2.1 },
      { x: target.x, z: target.z - 2.1 },
    ]
    const approach = candidates.find((candidate) =>
      world.isWalkable(candidate.x, candidate.z, 0.35),
    )
    if (!approach) return false
    cameraRig.setPosition([approach.x, 1.62, approach.z])
    const dx = target.x - approach.x
    const dz = target.z - approach.z
    const horizontal = Math.max(0.001, Math.hypot(dx, dz))
    cameraRig.setLook(
      Math.atan2(-dx, -dz),
      Math.atan2(target.y - 1.62, horizontal),
    )
    return true
  }

  function getFocus() {
    return focused
      ? {
          type: focused.type,
          id: focused.id,
          distance: focused.distance,
        }
      : null
  }

  return {
    update,
    tryInteract,
    collectSeed(id) {
      const seed = fireSeeds.seeds.find((item) => item.id === id)
      return seed ? collectFocusedSeed(seed) : false
    },
    teleportToSeed,
    openGate,
    getFocus,
    getNearestDistance: () => nearestDistance,
    dispose() {
      offKeyDown()
      fireSeeds.setFocused(null)
    },
  }
}
