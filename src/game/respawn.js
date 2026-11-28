/**
 * 检查点 / 落水重生（玩法层，张洋）。
 *
 * - 每 1.2s 采样一次可行走位置，写入最近安全点，并同步 state.checkpoint；
 * - `R` 随时回到最近安全点（手动重生）；
 * - 位置被墙体夹住 / 掉出场景超过 0.45s 时自动重生，避免卡死。
 *
 * 只读 world.isWalkable / cameraRig.getPosition，不碰碰撞内部实现。
 */

const SAFE_SAMPLE_INTERVAL = 1.2
const STUCK_TIMEOUT = 0.45
const PLAYER_RADIUS = 0.34

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

export function createRespawn(options) {
  const { state, input, world, cameraRig, hud, events } = options
  if (!state || !input || !world || !cameraRig) {
    throw new Error('createRespawn: missing required dependencies')
  }

  const initial = cameraRig.getPosition()
  let safe = { x: initial.x, z: initial.z }
  let sampleTimer = 0
  let stuckTimer = 0
  let respawnCount = 0

  function syncCheckpoint(x, z) {
    const helpers = globalThis.Changming?.MazeConfig?.helpers
    const size = globalThis.Changming?.MazeConfig?.size ?? 15
    const cell = helpers?.worldToCell?.(x, z)
    if (!cell) return
    const row = clamp(cell.row, 0, size - 1)
    const col = clamp(cell.col, 0, size - 1)
    state.checkpoint = { col, row }
  }

  function respawn(reason = 'manual') {
    respawnCount += 1
    cameraRig.setPosition([safe.x, 1.62, safe.z])
    syncCheckpoint(safe.x, safe.z)
    if (reason === 'manual') {
      hud?.showToast('已回到检查点', '按 R 可随时返回最近的安全位置')
    } else {
      hud?.showToast('已回到安全位置', '检测到落水或卡死，已自动重生')
    }
    events?.emit('player:respawn', { reason, count: respawnCount })
  }

  const offKeyDown = input.onKeyDown((event) => {
    if (event.code !== 'KeyR' || event.repeat) return
    if (state.phase !== 'playing') return
    respawn('manual')
  })

  function update(dt) {
    if (state.phase !== 'playing') {
      stuckTimer = 0
      return
    }
    const position = cameraRig.getPosition()
    const fellOut =
      position.y < -1.5 ||
      !Number.isFinite(position.x) ||
      !Number.isFinite(position.z)
    const walkable =
      !fellOut && world.isWalkable(position.x, position.z, PLAYER_RADIUS)

    if (walkable) {
      stuckTimer = 0
      sampleTimer += dt
      if (sampleTimer >= SAFE_SAMPLE_INTERVAL) {
        sampleTimer = 0
        safe = { x: position.x, z: position.z }
        syncCheckpoint(position.x, position.z)
      }
      return
    }

    stuckTimer += dt
    if (stuckTimer >= STUCK_TIMEOUT) {
      stuckTimer = 0
      respawn('auto')
    }
  }

  syncCheckpoint(initial.x, initial.z)

  return {
    update,
    respawn,
    getSafePosition: () => ({ ...safe }),
    getRespawnCount: () => respawnCount,
    dispose() {
      offKeyDown()
    },
  }
}
