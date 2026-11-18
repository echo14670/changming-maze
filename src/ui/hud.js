export function createHud(options) {
  const { state, events } = options
  if (!state) throw new Error('createHud: state is required')

  const root = document.querySelector('#hud')
  const count = document.querySelector('#ember-count')
  const dots = [...document.querySelectorAll('[data-ember-dot]')]
  const prompt = document.querySelector('#interaction-prompt')
  const promptKey = document.querySelector('#interaction-key')
  const promptTitle = document.querySelector('#interaction-title')
  const promptDetail = document.querySelector('#interaction-detail')
  const guide = document.querySelector('#interaction-guide')
  const toast = document.querySelector('#toast')
  const toastTitle = document.querySelector('#toast-title')
  const toastDetail = document.querySelector('#toast-detail')
  const region = document.querySelector('#region-name')
  const crosshair = document.querySelector('#crosshair')
  let toastTimer = 0
  let currentGuide = ''

  function setCount(value, total = 3) {
    const safe = Math.max(0, Math.min(total, Number(value) || 0))
    if (count) count.textContent = String(safe)
    dots.forEach((dot, index) => {
      dot.classList.toggle('is-filled', index < safe)
    })
    root?.classList.toggle('has-all-seeds', safe >= total)
  }

  function setInteraction(next) {
    if (!next) {
      prompt?.classList.remove('is-visible')
      crosshair?.classList.remove('is-focused')
      return
    }
    if (promptKey) promptKey.textContent = next.key || 'E'
    if (promptTitle) promptTitle.textContent = next.title || ''
    if (promptDetail) promptDetail.textContent = next.detail || ''
    prompt?.classList.add('is-visible')
    prompt?.classList.toggle('is-warm', next.tone === 'ember')
    crosshair?.classList.add('is-focused')
  }

  function setGuide(text) {
    if (text === currentGuide) return
    currentGuide = text || ''
    if (guide) guide.textContent = currentGuide
    guide?.classList.toggle('is-visible', Boolean(currentGuide))
  }

  function showToast(title, detail = '') {
    if (toastTitle) toastTitle.textContent = title
    if (toastDetail) toastDetail.textContent = detail
    toast?.classList.add('is-visible')
    clearTimeout(toastTimer)
    toastTimer = window.setTimeout(() => {
      toast?.classList.remove('is-visible')
    }, 2600)
  }

  function setRegion(name) {
    if (region && name) region.textContent = name
  }

  const offCollect = events?.on('seed:collect', (payload) => {
    setCount(payload.collected, payload.total)
  })
  const offGate = events?.on('gate:unlock', () => {
    setGuide('')
    setInteraction(null)
  })

  setCount(state.collected, 3)
  setGuide('找到三枚火种，靠近后按 E 拾取')

  return {
    setCount,
    setInteraction,
    setGuide,
    showToast,
    setRegion,
    dispose() {
      offCollect?.()
      offGate?.()
      clearTimeout(toastTimer)
    },
  }
}
