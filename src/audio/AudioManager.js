export class AudioManager {
  constructor() {
    this.ctx = null;
    this.unlocked = false;
    this.isMuted = false;
    this.masterVolume = 0.5;
  }

  // 必须在用户首次点击/交互时调用
  init() {
    if (this.unlocked) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContext();
    
    // 如果浏览器挂起了，尝试恢复
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this.unlocked = true;
    console.log('🔊 WebAudio 引擎已解锁');
  }

  setMute(muted) {
    this.isMuted = muted;
  }

  setVolume(vol) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
  }

  // 通用发声器：合成简单的音效
  playTone(frequency, type = 'sine', duration = 0.2, isSpatial = false) {
    if (!this.unlocked || this.isMuted || !this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);

    // 包络：起音和衰减
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(this.masterVolume, this.ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  // 预设音效
  playPickup() {
    // 拾取火种：频率滑升
    if (!this.unlocked || this.isMuted || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1760, this.ctx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.4);
  }

  playDoor() {
    // 开门：低频轰鸣 (Sawtooth)
    this.playTone(110, 'sawtooth', 0.8);
  }

  playStep() {
    // 脚步：短促的噪声
    this.playTone(200 + Math.random() * 50, 'triangle', 0.05);
  }
}