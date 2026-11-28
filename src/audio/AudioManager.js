export class AudioManager {
  constructor() {
    this.ctx = null;
    this.unlocked = false;
    this.isMuted = false;
    this.masterVolume = 0.5;
    this.ambientNode = null;
    this.ambientGain = null;
  }

  init() {
    if (this.unlocked) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.unlocked = true;
    console.log('🔊 纯代码合成音频已解锁');
    this.startAmbient();
  }

    setMute(muted) {
    this.isMuted = muted;
    if (this.ambientGain && this.ctx) {
      // 如果静音就降到 0，否则恢复到当前滑块的音量（基础海浪音量我设为0.04）
      const targetVol = muted ? 0 : 0.04 * this.masterVolume;
      this.ambientGain.gain.setTargetAtTime(targetVol, this.ctx.currentTime, 0.1);
    }
  }

  setVolume(vol) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.isMuted) return;
    // 拖拽滑块时，实时改变海浪声音量
    if (this.ambientGain && this.ctx) {
      this.ambientGain.gain.setTargetAtTime(0.04 * this.masterVolume, this.ctx.currentTime, 0.1);
    }
  }
  // 1. 逼真的海浪与风声（纯代码动态合成）
  startAmbient() {
    if (!this.unlocked || this.ambientNode) return;
    const ctx = this.ctx;
    const bufferSize = ctx.sampleRate * 4; // 4秒缓冲
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    // 带通滤波器，只留海浪的隆隆声，滤掉风扇一样的高频刺耳声
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;

    // 用低频振荡器制造"涨潮退潮"的起伏感
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.1; // 10秒一个周期
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.02; // 起伏幅度

    this.ambientGain = ctx.createGain();
    this.ambientGain.gain.value = 0.04; // 基础音量

    lfo.connect(lfoGain);
    lfoGain.connect(this.ambientGain.gain);

    noise.connect(filter);
    filter.connect(this.ambientGain);
    this.ambientGain.connect(ctx.destination);

    noise.start();
    lfo.start();
    this.ambientNode = noise;
  }

  // 2. 清脆扎实的脚步声
  playStep() {
    if (!this.unlocked || this.isMuted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    // 扎实的低频
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.08);
    
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.1);

    // 清脆的高频"啪"
    const bufferSize = ctx.sampleRate * 0.05;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    
    const snap = ctx.createBufferSource();
    snap.buffer = buffer;
    const snapFilter = ctx.createBiquadFilter();
    snapFilter.type = 'highpass';
    snapFilter.frequency.value = 1500;
    
    const snapGain = ctx.createGain();
    snapGain.gain.setValueAtTime(0.4, t);
    snapGain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
    
    snap.connect(snapFilter).connect(snapGain).connect(ctx.destination);
    snap.start(t);
  }

  playPickup() {
    if (!this.unlocked || this.isMuted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1760, this.ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.4);
  }

  playDoor() {
    if (!this.unlocked || this.isMuted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, this.ctx.currentTime);
    gain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.8);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.8);
  }
}