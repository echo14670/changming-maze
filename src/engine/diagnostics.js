/**
 * 诊断接口：window.changming
 * 供 Playwright、答辩排查和调试使用；不参与正常玩法。
 */
export function createDiagnostics(options) {
  const { state, renderer, cameraRig, events, interaction, fireSeeds, world } = options
  if (!state) throw new Error('createDiagnostics: state is required')
  if (!renderer) throw new Error('createDiagnostics: renderer is required')

  function snapshotState() {
    return {
      ...state,
      seedIds: [...state.seedIds],
      checkpoint: { ...state.checkpoint },
      focus: interaction?.getFocus?.() || null,
      seeds:
        fireSeeds?.seeds?.map((seed) => ({
          id: seed.id,
          region: seed.region,
          collected: seed.collected,
          grid: { ...seed.grid },
        })) || [],
      camera: cameraRig
        ? { position: cameraRig.getPosition(), look: cameraRig.getLook() }
        : null,
    }
  }

  function teleport(target) {
    if (!cameraRig) return false
    if (Array.isArray(target)) {
      cameraRig.setPosition(target)
      return true
    }
    if (target && typeof target === 'object' && ('x' in target || 'z' in target)) {
      cameraRig.setPosition(target)
      return true
    }
    if (target && typeof target === 'object' && 'col' in target && 'row' in target) {
      const position = world?.maze?.cells?.[target.row]?.[target.col]
      if (!position) {
        console.warn('[changming] teleport({col,row}) 超出迷宫范围')
        return false
      }
      const center = world?.cellToWorld?.(target.row, target.col)
      if (!center) return false
      cameraRig.setPosition([center.x, 1.62, center.z])
      return true
    }
    return false
  }

  function giveSeeds(count = 3) {
    const amount = Math.max(0, Math.min(3, Number(count) || 0))
    if (interaction && fireSeeds) {
      for (let index = 0; index < amount; index += 1) {
        const seed = fireSeeds.seeds[index]
        if (seed) interaction.collectSeed(seed.id)
      }
    } else {
      state.collected = amount
      state.seedIds = Array.from({ length: amount }, (_, index) => `seed-${index + 1}`)
      if (amount >= 3) state.gateUnlocked = true
    }
    return state.collected
  }

  function teleportToSeed(index = 0) {
    return interaction?.teleportToSeed?.(Number(index) || 0) || false
  }

  function openGate() {
    state.gateUnlocked = true
    events?.emit('gate:unlock', {})
    return true
  }

  function triggerEnding() {
    if (state.collected < 3) return false
    if (state.phase === 'ending') return true
    state.phase = 'ending'
    state.endingStarted = true
    events?.emit('ending:start', {})
    console.warn('[changming] EndingSequence 尚未接入；当前只切换状态，不播放镜头')
    return true
  }

  function setQuality(quality) {
    const ok = renderer.setQuality(quality)
    if (ok) {
      state.quality = quality
      events?.emit('quality:change', { quality })
    }
    return ok
  }

  function setFeature(name, enabled) {
    return renderer.setFeature(name, enabled)
  }

  function getDiagnostics() {
    return {
      ...renderer.getDiagnostics(),
      seed: state.seed,
      phase: state.phase,
      collected: state.collected,
      gateUnlocked: state.gateUnlocked,
      quality: state.quality,
      focus: interaction?.getFocus?.() || null,
      remainingSeeds: fireSeeds
        ? fireSeeds.getActive().length
        : Math.max(0, 3 - state.collected),
      screenshotReady: document.body.dataset.ready === 'true',
    }
  }

  const api = {
    version: '0.1.0',
    getState: snapshotState,
    getDiagnostics,
    teleport,
    teleportToSeed,
    giveSeeds,
    openGate,
    triggerEnding,
    setQuality,
    setFeature,
    screenshotReady: () => document.body.dataset.ready === 'true',
  }

  window.changming = api
  return api
}
