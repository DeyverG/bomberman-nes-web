import {
  AudioEngineConfig,
  DEFAULT_MASTER_VOLUME,
  IAudioEngine,
  STEP_COOLDOWN_MS,
} from './types';

export class AudioEngine implements IAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private _isMuted = false;
  private masterVolume = DEFAULT_MASTER_VOLUME;
  private lastStepTimeMs = 0;
  private stepToggle = false;
  private contextFactory?: () => AudioContext | null;

  constructor(config?: AudioEngineConfig) {
    this._isMuted = config?.initialMuted ?? false;
    this.masterVolume = config?.masterVolume ?? DEFAULT_MASTER_VOLUME;
    this.contextFactory = config?.contextFactory;

    // Check localStorage persistence if available in browser
    if (typeof localStorage !== 'undefined') {
      const savedMute = localStorage.getItem('nes_bomberman_muted');
      if (savedMute !== null) {
        this._isMuted = savedMute === 'true';
      }
    }
  }

  public get isMuted(): boolean {
    return this._isMuted;
  }

  public get isUnlocked(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  private getAudioContext(): AudioContext | null {
    if (this.ctx) return this.ctx;

    if (this.contextFactory) {
      this.ctx = this.contextFactory();
    } else if (typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }

    if (this.ctx) {
      try {
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(
          this._isMuted ? 0 : this.masterVolume,
          this.ctx.currentTime
        );
        this.masterGain.connect(this.ctx.destination);
      } catch {
        // Fallback for mocked/synthetic contexts in unit tests
      }
    }

    return this.ctx;
  }

  public async unlock(): Promise<boolean> {
    const ctx = this.getAudioContext();
    if (!ctx) return false;

    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        return false;
      }
    }

    return ctx.state === 'running';
  }

  public toggleMute(): boolean {
    this.setMuted(!this._isMuted);
    return this._isMuted;
  }

  public setMuted(muted: boolean): void {
    this._isMuted = muted;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('nes_bomberman_muted', String(muted));
    }

    const ctx = this.getAudioContext();
    if (ctx && this.masterGain) {
      try {
        this.masterGain.gain.setValueAtTime(
          muted ? 0 : this.masterVolume,
          ctx.currentTime
        );
      } catch {
        // Safe fallback
      }
    }
  }

  public playStep(): void {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - this.lastStepTimeMs < STEP_COOLDOWN_MS) {
      return;
    }
    this.lastStepTimeMs = now;

    const ctx = this.getAudioContext();
    if (!ctx || !this.masterGain) return;

    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      const freq = this.stepToggle ? 110 : 130;
      this.stepToggle = !this.stepToggle;
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.03);
    } catch {
      // Graceful headless fallback
    }
  }

  public playPlaceBomb(): void {
    const ctx = this.getAudioContext();
    if (!ctx || !this.masterGain) return;

    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(200, t);
      osc.frequency.exponentialRampToValueAtTime(580, t + 0.09);

      gain.gain.setValueAtTime(0.2, t);
      gain.gain.linearRampToValueAtTime(0.001, t + 0.09);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.09);
    } catch {
      // Graceful fallback
    }
  }

  public playExplosion(): void {
    const ctx = this.getAudioContext();
    if (!ctx || !this.masterGain) return;

    try {
      const t = ctx.currentTime;
      const duration = 0.48; // 480ms explosion duration
      const sampleRate = ctx.sampleRate || 44100;
      const bufferSize = Math.floor(sampleRate * duration);
      const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
      const data = buffer.getChannelData(0);

      // 1. Capa 1: Ruido 8-Bit LFSR Crunch (bloques de 6 a 8 muestras con -1 o +1)
      let sampleVal = Math.random() < 0.5 ? -1 : 1;
      let stepCount = 0;
      let nextStep = 6 + Math.floor(Math.random() * 3); // 6, 7 o 8 muestras
      for (let i = 0; i < bufferSize; i++) {
        if (stepCount >= nextStep) {
          sampleVal = Math.random() < 0.5 ? -1 : 1;
          stepCount = 0;
          nextStep = 6 + Math.floor(Math.random() * 3);
        }
        data[i] = sampleVal;
        stepCount++;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      // Filter: Lowpass 3500Hz cayendo a 140Hz en 480ms con resonancia Q = 3.5
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      if (filter.Q) {
        filter.Q.value = 3.5;
      }
      filter.frequency.setValueAtTime(3500, t);
      filter.frequency.exponentialRampToValueAtTime(140, t + duration);

      // GainNode Capa 1: 0.9 al inicio (attack en 0.005s) cayendo a 0.01 en 480ms
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.001, t);
      noiseGain.gain.linearRampToValueAtTime(0.9, t + 0.005);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, t + duration);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.masterGain);

      noise.start(t);
      noise.stop(t + duration);

      // 2. Capa 2: Sub-Bass Impact Boom (Golpe inicial)
      // OscillatorNode triangle/sawtooth 160Hz cayendo a 28Hz en 300ms
      const subOsc = ctx.createOscillator();
      subOsc.type = 'triangle';
      subOsc.frequency.setValueAtTime(160, t);
      subOsc.frequency.exponentialRampToValueAtTime(28, t + 0.3);

      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(0.85, t);
      subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);

      subOsc.connect(subGain);
      subGain.connect(this.masterGain);

      subOsc.start(t);
      subOsc.stop(t + 0.32);
    } catch {
      // Graceful fallback
    }
  }

  public playPowerup(): void {
    const ctx = this.getAudioContext();
    if (!ctx || !this.masterGain) return;

    try {
      // Ascending 4-note arpeggio (C5, E5, G5, C6)
      const notes = [523.25, 659.25, 783.99, 1046.5];
      const noteDuration = 0.065;
      let t = ctx.currentTime;

      notes.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + noteDuration);

        osc.connect(gain);
        gain.connect(this.masterGain!);

        osc.start(t);
        osc.stop(t + noteDuration);

        t += noteDuration;
      });
    } catch {
      // Graceful fallback
    }
  }

  public playDoorRevealed(): void {
    const ctx = this.getAudioContext();
    if (!ctx || !this.masterGain) return;

    try {
      // Confirmation chime (G5, B5, E6)
      const notes = [783.99, 987.77, 1318.51];
      const noteDuration = 0.08;
      let t = ctx.currentTime;

      notes.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + noteDuration);

        osc.connect(gain);
        gain.connect(this.masterGain!);

        osc.start(t);
        osc.stop(t + noteDuration);

        t += noteDuration;
      });
    } catch {
      // Graceful fallback
    }
  }

  public playAllEnemiesCleared(): void {
    this.playDoorRevealed();
  }

  public playPlayerDeath(): void {
    const ctx = this.getAudioContext();
    if (!ctx || !this.masterGain) return;

    try {
      const t = ctx.currentTime;
      const duration = 0.75;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(620, t);
      osc.frequency.linearRampToValueAtTime(110, t + duration);

      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + duration);
    } catch {
      // Graceful fallback
    }
  }

  public playStageIntro(): void {
    const ctx = this.getAudioContext();
    if (!ctx || !this.masterGain) return;

    try {
      // 8-bit opening motif
      const melody = [
        { f: 523.25, d: 0.12 }, // C5
        { f: 659.25, d: 0.12 }, // E5
        { f: 783.99, d: 0.12 }, // G5
        { f: 1046.5, d: 0.24 }, // C6
        { f: 783.99, d: 0.12 }, // G5
        { f: 1046.5, d: 0.36 }, // C6
      ];

      let t = ctx.currentTime;
      melody.forEach(({ f, d }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(f, t);

        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + d);

        osc.connect(gain);
        gain.connect(this.masterGain!);

        osc.start(t);
        osc.stop(t + d);

        t += d;
      });
    } catch {
      // Graceful fallback
    }
  }

  public playStageClear(): void {
    const ctx = this.getAudioContext();
    if (!ctx || !this.masterGain) return;

    try {
      // 8-bit victory melody
      const melody = [
        { f: 523.25, d: 0.1 }, // C5
        { f: 587.33, d: 0.1 }, // D5
        { f: 659.25, d: 0.1 }, // E5
        { f: 698.46, d: 0.1 }, // F5
        { f: 783.99, d: 0.15 }, // G5
        { f: 880.0, d: 0.15 },  // A5
        { f: 987.77, d: 0.15 }, // B5
        { f: 1046.5, d: 0.4 },  // C6
      ];

      let t = ctx.currentTime;
      melody.forEach(({ f, d }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(f, t);

        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + d);

        osc.connect(gain);
        gain.connect(this.masterGain!);

        osc.start(t);
        osc.stop(t + d);

        t += d;
      });
    } catch {
      // Graceful fallback
    }
  }

  public playPause(): void {
    const ctx = this.getAudioContext();
    if (!ctx || !this.masterGain) return;

    try {
      // Classic NES two-tone pause chirping sound
      const t = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();

      osc1.type = 'square';
      osc1.frequency.setValueAtTime(880, t);
      gain1.gain.setValueAtTime(0.2, t);
      gain1.gain.linearRampToValueAtTime(0.001, t + 0.04);
      osc1.connect(gain1);
      gain1.connect(this.masterGain);
      osc1.start(t);
      osc1.stop(t + 0.04);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(1760, t + 0.04);
      gain2.gain.setValueAtTime(0.2, t + 0.04);
      gain2.gain.linearRampToValueAtTime(0.001, t + 0.12);
      osc2.connect(gain2);
      gain2.connect(this.masterGain);
      osc2.start(t + 0.04);
      osc2.stop(t + 0.12);
    } catch {
      // Graceful fallback
    }
  }

  public stopAll(): void {
    // Standard disposal of active nodes
    if (this.ctx && this.masterGain) {
      try {
        this.masterGain.disconnect();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(
          this._isMuted ? 0 : this.masterVolume,
          this.ctx.currentTime
        );
        this.masterGain.connect(this.ctx.destination);
      } catch {
        // Fallback
      }
    }
  }

  public dispose(): void {
    this.stopAll();
    if (this.ctx) {
      try {
        this.ctx.close();
      } catch {
        // Fallback
      }
      this.ctx = null;
      this.masterGain = null;
    }
  }
}

export function createAudioEngine(config?: AudioEngineConfig): IAudioEngine {
  return new AudioEngine(config);
}
