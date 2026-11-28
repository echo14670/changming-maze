/**
 * 标题 / 开始界面（UI 层，张洋）。
 *
 * - title → playing：点击开始按钮（或按 Enter / Space）进入游戏；
 * - 开始时解锁 WebAudio（首次用户手势）、启用输入与相机、淡出遮罩；
 * - 结局开始时（ending:start）同步淡出 HUD 阶段样式；
 * - 遮罩覆盖全屏，点击任意处等同点击开始，兼容 Playwright 冒烟的首次点击。
 */

export function createTitleScreen(options) {
  const { state, events, audio, input, cameraRig, hud } = options
  if (!state) throw new Error('createTitleScreen: state is required')

  const overlay = document.createElement('div')
  overlay.id = 'title-screen'
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-label', '长明：雾海迷宫 开始界面')
  overlay.innerHTML = `
    <div class="title-panel">
      <p class="title-eyebrow">计算机图形学综合实验四 · WebGL2 / three.js</p>
      <h1 class="title-brand">长明</h1>
      <p class="title-subtitle">雾海迷宫 · THE LONG LIGHT</p>
      <p class="title-story">
        风暴夜，灯塔熄灭，三枚火种散落在环塔石阵。<br>
        提灯入阵，找回火种，点亮长明。
      </p>
      <button id="title-start" type="button">提灯入阵</button>
      <ul class="title-controls">
        <li><kbd>W A S D</kbd> 移动</li>
        <li><kbd>鼠标</kbd> 环视</li>
        <li><kbd>Shift</kbd> 快走</li>
        <li><kbd>E</kbd> 拾取 / 开门</li>
        <li><kbd>R</kbd> 回检查点</li>
      </ul>
      <p class="title-hint">点击画面后进入 Pointer Lock 环视；失败时按住拖动</p>
    </div>`
  document.body.appendChild(overlay)

  document.body.dataset.phase = 'title'
  hud?.hide?.()
  cameraRig?.setEnabled?.(false)
  input?.setEnabled?.(false)

  let started = false

  function start() {
    if (started) return
    started = true
    // AudioManager.init / 接口约定的 unlock 二选一，兼容两种实现
    const unlock = audio?.unlock ?? audio?.init
    if (typeof unlock === 'function') unlock.call(audio)
    state.phase = 'playing'
    document.body.dataset.phase = 'playing'
    input?.setEnabled?.(true)
    cameraRig?.setEnabled?.(true)
    overlay.classList.add('is-hidden')
    hud?.show?.()
    hud?.showToast('风暴夜 · 灯塔熄灭', '找回三枚火种，点亮长明')
    events?.emit('game:start', {})
    removeStartKeyListener()
    document.removeEventListener('pointerdown', onFirstPointerDown)
  }

  const onStartKey = (event) => {
    if (started) return
    if (event.code === 'Enter' || event.code === 'Space') {
      event.preventDefault()
      start()
    }
  }
  function removeStartKeyListener() {
    window.removeEventListener('keydown', onStartKey)
  }
  window.addEventListener('keydown', onStartKey)

  // 遮罩 pointer-events:none，点击会穿透到 canvas；在文档级监听首次点击开始游戏。
  // 键盘激活按钮（Enter/Space）仍会触发 click，保留按钮监听兜底。
  const onFirstPointerDown = () => start()
  document.addEventListener('pointerdown', onFirstPointerDown)
  overlay.querySelector('#title-start')?.addEventListener('click', start)

  const offEnding = events?.on('ending:start', () => {
    document.body.dataset.phase = 'ending'
    hud?.hide?.()
  })

  return {
    start,
    isStarted: () => started,
    dispose() {
      removeStartKeyListener()
      document.removeEventListener('pointerdown', onFirstPointerDown)
      offEnding?.()
      overlay.remove()
    },
  }
}
