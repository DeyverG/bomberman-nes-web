import {
  AudioEngineConfig,
  BgmTrack,
  DEFAULT_MASTER_VOLUME,
  IAudioEngine,
  STEP_COOLDOWN_MS,
} from './types';

/**
 * Standard NES 2A03 Tuning Frequencies in Hz
 */
export const NOTE_FREQS: Readonly<Record<string, number>> = {
  // Octave 2
  C2: 65.41, D2: 73.42, E2: 82.41, F2: 87.31, Fs2: 92.5, G2: 98.0, A2: 110.0, B2: 123.47,
  // Octave 3
  C3: 130.81, Cs3: 138.59, D3: 146.83, Ds3: 155.56, E3: 164.81, F3: 174.61, Fs3: 185.0, G3: 196.0, Gs3: 207.65, A3: 220.0, As3: 233.08, B3: 246.94,
  // Octave 4
  C4: 261.63, Cs4: 277.18, D4: 293.66, Ds4: 311.13, E4: 329.63, F4: 349.23, Fs4: 369.99, G4: 392.0, Gs4: 415.3, A4: 440.0, As4: 466.16, B4: 493.88,
  // Octave 5
  C5: 523.25, Cs5: 554.37, D5: 587.33, Ds5: 622.25, E5: 659.25, F5: 698.46, Fs5: 739.99, G5: 783.99, Gs5: 830.61, A5: 880.0, As5: 932.33, B5: 987.77,
  // Octave 6
  C6: 1046.5, D6: 1174.66, E6: 1318.51,
  REST: 0,
};

export interface ChiptuneNote {
  readonly f: number; // Frequency in Hz (0 = REST)
  readonly d: number; // Duration in seconds
  readonly vol?: number;
}

export class AudioEngine implements IAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private _isMuted = false;
  private masterVolume = DEFAULT_MASTER_VOLUME;
  private bgmVolume = 0.22;
  private lastStepTimeMs = 0;
  private stepToggle = false;
  private contextFactory?: () => AudioContext | null;

  // BGM Sequencer state
  private _currentBgm: BgmTrack | null = null;
  private _isBgmPaused = false;
  private bgmTimer: ReturnType<typeof setTimeout> | null = null;
  private activeBgmOscillators: OscillatorNode[] = [];

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

  public get currentBgm(): BgmTrack | null {
    return this._currentBgm;
  }

  public get isBgmPlaying(): boolean {
    return this._currentBgm !== null && !this._isBgmPaused;
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

        this.bgmGain = this.ctx.createGain();
        this.bgmGain.gain.setValueAtTime(this.bgmVolume, this.ctx.currentTime);
        this.bgmGain.connect(this.masterGain);
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

      osc.type = 'square';
      this.stepToggle = !this.stepToggle;
      const [startFreq, endFreq] = this.stepToggle ? [980, 620] : [780, 480];
      osc.frequency.setValueAtTime(startFreq, t);
      osc.frequency.exponentialRampToValueAtTime(endFreq, t + 0.028);

      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.028);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.028);
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

  private scheduleChannel(
    notes: ChiptuneNote[],
    type: OscillatorType,
    startTime: number,
    baseGain: number
  ): number {
    const ctx = this.getAudioContext();
    if (!ctx || !this.bgmGain) return 0;

    let t = startTime;
    for (const note of notes) {
      if (note.f > 0) {
        try {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = type;
          osc.frequency.setValueAtTime(note.f, t);

          const vol = (note.vol ?? 1.0) * baseGain;
          const notePlayDuration = Math.max(0.01, note.d * 0.88);
          gain.gain.setValueAtTime(vol, t);
          gain.gain.setValueAtTime(vol, t + notePlayDuration * 0.75);
          gain.gain.exponentialRampToValueAtTime(0.001, t + notePlayDuration);

          osc.connect(gain);
          gain.connect(this.bgmGain);

          osc.start(t);
          osc.stop(t + notePlayDuration);

          this.activeBgmOscillators.push(osc);
        } catch {
          // Graceful fallback for mock contexts
        }
      }
      t += note.d;
    }
    return t - startTime;
  }

  private playBgmTrack(
    track: BgmTrack,
    lead: ChiptuneNote[],
    harm: ChiptuneNote[],
    bass: ChiptuneNote[],
    loop: boolean
  ): void {
    this.stopBgm();
    this._currentBgm = track;
    this._isBgmPaused = false;

    const ctx = this.getAudioContext();
    if (!ctx || !this.bgmGain) return;

    try {
      this.bgmGain.gain.setValueAtTime(this.bgmVolume, ctx.currentTime);
    } catch {}

    const schedule = () => {
      if (this._currentBgm !== track) return;

      const t0 = ctx.currentTime;
      const dLead = this.scheduleChannel(lead, 'square', t0, 0.2);
      const dHarm = this.scheduleChannel(harm, 'square', t0, 0.15);
      const dBass = this.scheduleChannel(bass, 'triangle', t0, 0.32);

      const totalDuration = Math.max(dLead, dHarm, dBass, 0.1);

      if (loop && this._currentBgm === track) {
        this.bgmTimer = setTimeout(() => {
          if (this._currentBgm === track && !this._isBgmPaused) {
            schedule();
          }
        }, Math.max(100, Math.floor((totalDuration - 0.05) * 1000)));
      }
    };

    schedule();
  }

  public playStageIntro(): void {
    const d = 0.14; // 8 ascending notes = 1.12s
    const hold = 0.95; // Final hold = ~2.07s total (matches 2200ms intro screen)
    const lead: ChiptuneNote[] = [
      { f: NOTE_FREQS.E4, d },
      { f: NOTE_FREQS.Fs4, d },
      { f: NOTE_FREQS.Gs4, d },
      { f: NOTE_FREQS.A4, d },
      { f: NOTE_FREQS.B4, d },
      { f: NOTE_FREQS.Cs5, d },
      { f: NOTE_FREQS.D5, d },
      { f: NOTE_FREQS.E5, d },
      { f: NOTE_FREQS.E5, d: hold, vol: 1.2 },
    ];
    const harm: ChiptuneNote[] = [
      { f: 0, d: d * 8 },
      { f: NOTE_FREQS.Gs4, d: hold, vol: 0.9 },
    ];
    const bass: ChiptuneNote[] = [
      { f: 0, d: d * 8 },
      { f: NOTE_FREQS.E3, d: hold, vol: 1.1 },
    ];

    this.playBgmTrack('STAGE_INTRO', lead, harm, bass, false);
  }

  public playStageTheme(): void {
    // 148 BPM Iconic Jun Chikuma Stage Theme
    const beat = 60 / 148; // 0.4054s
    const e = beat / 2;    // 0.2027s (8th note)
    const s = beat / 4;    // 0.1014s (16th note)
    const q = beat;        // 0.4054s (quarter note)
    const h = beat * 2;    // 0.8108s (half note)
    const dotE = e * 1.5;  // 0.3040s (dotted 8th)

    const lead: ChiptuneNote[] = [
      // Bar 1 (C)
      { f: NOTE_FREQS.G4, d: e },
      { f: NOTE_FREQS.E4, d: e },
      { f: NOTE_FREQS.C4, d: e },
      { f: NOTE_FREQS.E4, d: e },
      { f: NOTE_FREQS.G4, d: e },
      { f: NOTE_FREQS.C5, d: e },
      { f: NOTE_FREQS.B4, d: e },
      { f: NOTE_FREQS.A4, d: e },
      // Bar 2 (G -> C)
      { f: NOTE_FREQS.G4, d: dotE },
      { f: NOTE_FREQS.A4, d: s },
      { f: NOTE_FREQS.G4, d: e },
      { f: NOTE_FREQS.F4, d: e },
      { f: NOTE_FREQS.E4, d: q },
      { f: NOTE_FREQS.D4, d: q },
      // Bar 3 (C)
      { f: NOTE_FREQS.G4, d: e },
      { f: NOTE_FREQS.E4, d: e },
      { f: NOTE_FREQS.C4, d: e },
      { f: NOTE_FREQS.E4, d: e },
      { f: NOTE_FREQS.G4, d: e },
      { f: NOTE_FREQS.C5, d: e },
      { f: NOTE_FREQS.B4, d: e },
      { f: NOTE_FREQS.C5, d: e },
      // Bar 4 (G -> C)
      { f: NOTE_FREQS.D5, d: dotE },
      { f: NOTE_FREQS.E5, d: s },
      { f: NOTE_FREQS.D5, d: q },
      { f: NOTE_FREQS.C5, d: h },
      // Bar 5 (Am)
      { f: NOTE_FREQS.A4, d: e },
      { f: NOTE_FREQS.C5, d: e },
      { f: NOTE_FREQS.E5, d: e },
      { f: NOTE_FREQS.D5, d: e },
      { f: NOTE_FREQS.C5, d: e },
      { f: NOTE_FREQS.B4, d: e },
      { f: NOTE_FREQS.A4, d: e },
      { f: NOTE_FREQS.G4, d: e },
      // Bar 6 (F)
      { f: NOTE_FREQS.F4, d: e },
      { f: NOTE_FREQS.A4, d: e },
      { f: NOTE_FREQS.C5, d: e },
      { f: NOTE_FREQS.B4, d: e },
      { f: NOTE_FREQS.A4, d: e },
      { f: NOTE_FREQS.G4, d: e },
      { f: NOTE_FREQS.F4, d: e },
      { f: NOTE_FREQS.E4, d: e },
      // Bar 7 (Dm -> G)
      { f: NOTE_FREQS.D4, d: e },
      { f: NOTE_FREQS.F4, d: e },
      { f: NOTE_FREQS.A4, d: e },
      { f: NOTE_FREQS.G4, d: e },
      { f: NOTE_FREQS.F4, d: e },
      { f: NOTE_FREQS.E4, d: e },
      { f: NOTE_FREQS.D4, d: e },
      { f: NOTE_FREQS.C4, d: e },
      // Bar 8 (G -> C)
      { f: NOTE_FREQS.G4, d: q },
      { f: NOTE_FREQS.G3, d: q },
      { f: NOTE_FREQS.C4, d: h },
    ];

    const harm: ChiptuneNote[] = [
      // Bar 1
      { f: NOTE_FREQS.E4, d: e },
      { f: NOTE_FREQS.C4, d: e },
      { f: NOTE_FREQS.G3, d: e },
      { f: NOTE_FREQS.C4, d: e },
      { f: NOTE_FREQS.E4, d: e },
      { f: NOTE_FREQS.E4, d: e },
      { f: NOTE_FREQS.D4, d: e },
      { f: NOTE_FREQS.C4, d: e },
      // Bar 2
      { f: NOTE_FREQS.B3, d: dotE },
      { f: NOTE_FREQS.C4, d: s },
      { f: NOTE_FREQS.B3, d: e },
      { f: NOTE_FREQS.A3, d: e },
      { f: NOTE_FREQS.G3, d: q },
      { f: NOTE_FREQS.F3, d: q },
      // Bar 3
      { f: NOTE_FREQS.E4, d: e },
      { f: NOTE_FREQS.C4, d: e },
      { f: NOTE_FREQS.G3, d: e },
      { f: NOTE_FREQS.C4, d: e },
      { f: NOTE_FREQS.E4, d: e },
      { f: NOTE_FREQS.E4, d: e },
      { f: NOTE_FREQS.D4, d: e },
      { f: NOTE_FREQS.E4, d: e },
      // Bar 4
      { f: NOTE_FREQS.F4, d: dotE },
      { f: NOTE_FREQS.G4, d: s },
      { f: NOTE_FREQS.F4, d: q },
      { f: NOTE_FREQS.E4, d: h },
      // Bar 5
      { f: NOTE_FREQS.F4, d: e },
      { f: NOTE_FREQS.A4, d: e },
      { f: NOTE_FREQS.C5, d: e },
      { f: NOTE_FREQS.B4, d: e },
      { f: NOTE_FREQS.A4, d: e },
      { f: NOTE_FREQS.G4, d: e },
      { f: NOTE_FREQS.F4, d: e },
      { f: NOTE_FREQS.E4, d: e },
      // Bar 6
      { f: NOTE_FREQS.D4, d: e },
      { f: NOTE_FREQS.F4, d: e },
      { f: NOTE_FREQS.A4, d: e },
      { f: NOTE_FREQS.G4, d: e },
      { f: NOTE_FREQS.F4, d: e },
      { f: NOTE_FREQS.E4, d: e },
      { f: NOTE_FREQS.D4, d: e },
      { f: NOTE_FREQS.C4, d: e },
      // Bar 7
      { f: NOTE_FREQS.B3, d: e },
      { f: NOTE_FREQS.D4, d: e },
      { f: NOTE_FREQS.F4, d: e },
      { f: NOTE_FREQS.E4, d: e },
      { f: NOTE_FREQS.D4, d: e },
      { f: NOTE_FREQS.C4, d: e },
      { f: NOTE_FREQS.B3, d: e },
      { f: NOTE_FREQS.A3, d: e },
      // Bar 8
      { f: NOTE_FREQS.E4, d: q },
      { f: NOTE_FREQS.D4, d: q },
      { f: NOTE_FREQS.C4, d: h },
    ];

    const bass: ChiptuneNote[] = [
      // Bar 1 (C)
      { f: NOTE_FREQS.C3, d: e }, { f: NOTE_FREQS.C3, d: e },
      { f: NOTE_FREQS.G3, d: e }, { f: NOTE_FREQS.G3, d: e },
      { f: NOTE_FREQS.C3, d: e }, { f: NOTE_FREQS.C3, d: e },
      { f: NOTE_FREQS.G3, d: e }, { f: NOTE_FREQS.G3, d: e },
      // Bar 2 (G -> C)
      { f: NOTE_FREQS.B2, d: e }, { f: NOTE_FREQS.B2, d: e },
      { f: NOTE_FREQS.G3, d: e }, { f: NOTE_FREQS.G3, d: e },
      { f: NOTE_FREQS.C3, d: e }, { f: NOTE_FREQS.C3, d: e },
      { f: NOTE_FREQS.G2, d: e }, { f: NOTE_FREQS.G2, d: e },
      // Bar 3 (C)
      { f: NOTE_FREQS.C3, d: e }, { f: NOTE_FREQS.C3, d: e },
      { f: NOTE_FREQS.G3, d: e }, { f: NOTE_FREQS.G3, d: e },
      { f: NOTE_FREQS.C3, d: e }, { f: NOTE_FREQS.C3, d: e },
      { f: NOTE_FREQS.G3, d: e }, { f: NOTE_FREQS.G3, d: e },
      // Bar 4 (G -> C)
      { f: NOTE_FREQS.G2, d: e }, { f: NOTE_FREQS.G2, d: e },
      { f: NOTE_FREQS.G3, d: e }, { f: NOTE_FREQS.G3, d: e },
      { f: NOTE_FREQS.C3, d: e }, { f: NOTE_FREQS.C3, d: e },
      { f: NOTE_FREQS.C3, d: q },
      // Bar 5 (Am)
      { f: NOTE_FREQS.A2, d: e }, { f: NOTE_FREQS.A2, d: e },
      { f: NOTE_FREQS.E3, d: e }, { f: NOTE_FREQS.E3, d: e },
      { f: NOTE_FREQS.A2, d: e }, { f: NOTE_FREQS.A2, d: e },
      { f: NOTE_FREQS.E3, d: e }, { f: NOTE_FREQS.E3, d: e },
      // Bar 6 (F)
      { f: NOTE_FREQS.F2, d: e }, { f: NOTE_FREQS.F2, d: e },
      { f: NOTE_FREQS.C3, d: e }, { f: NOTE_FREQS.C3, d: e },
      { f: NOTE_FREQS.F2, d: e }, { f: NOTE_FREQS.F2, d: e },
      { f: NOTE_FREQS.C3, d: e }, { f: NOTE_FREQS.C3, d: e },
      // Bar 7 (Dm -> G)
      { f: NOTE_FREQS.D3, d: e }, { f: NOTE_FREQS.D3, d: e },
      { f: NOTE_FREQS.A3, d: e }, { f: NOTE_FREQS.A3, d: e },
      { f: NOTE_FREQS.G2, d: e }, { f: NOTE_FREQS.G2, d: e },
      { f: NOTE_FREQS.D3, d: e }, { f: NOTE_FREQS.D3, d: e },
      // Bar 8 (C)
      { f: NOTE_FREQS.C3, d: e }, { f: NOTE_FREQS.C3, d: e },
      { f: NOTE_FREQS.G2, d: e }, { f: NOTE_FREQS.G2, d: e },
      { f: NOTE_FREQS.C3, d: h },
    ];

    this.playBgmTrack('STAGE_THEME', lead, harm, bass, true);
  }

  public playTitleBgm(): void {
    const qT = 60 / 140; // 140 BPM fanfare
    const eT = qT / 2;
    const hT = qT * 2;

    const lead: ChiptuneNote[] = [
      { f: NOTE_FREQS.C5, d: eT },
      { f: NOTE_FREQS.G4, d: eT },
      { f: NOTE_FREQS.E4, d: eT },
      { f: NOTE_FREQS.G4, d: eT },
      { f: NOTE_FREQS.C5, d: qT },
      { f: NOTE_FREQS.G4, d: qT },
      { f: NOTE_FREQS.D5, d: eT },
      { f: NOTE_FREQS.G4, d: eT },
      { f: NOTE_FREQS.F4, d: eT },
      { f: NOTE_FREQS.G4, d: eT },
      { f: NOTE_FREQS.D5, d: qT },
      { f: NOTE_FREQS.G4, d: qT },
      { f: NOTE_FREQS.E5, d: eT },
      { f: NOTE_FREQS.D5, d: eT },
      { f: NOTE_FREQS.C5, d: eT },
      { f: NOTE_FREQS.D5, d: eT },
      { f: NOTE_FREQS.E5, d: qT },
      { f: NOTE_FREQS.G5, d: qT },
      { f: NOTE_FREQS.C5, d: hT },
      { f: 0, d: qT },
    ];

    const harm: ChiptuneNote[] = [
      { f: NOTE_FREQS.E4, d: eT },
      { f: NOTE_FREQS.C4, d: eT },
      { f: NOTE_FREQS.G3, d: eT },
      { f: NOTE_FREQS.C4, d: eT },
      { f: NOTE_FREQS.E4, d: qT },
      { f: NOTE_FREQS.E4, d: qT },
      { f: NOTE_FREQS.F4, d: eT },
      { f: NOTE_FREQS.D4, d: eT },
      { f: NOTE_FREQS.B3, d: eT },
      { f: NOTE_FREQS.D4, d: eT },
      { f: NOTE_FREQS.F4, d: qT },
      { f: NOTE_FREQS.F4, d: qT },
      { f: NOTE_FREQS.G4, d: eT },
      { f: NOTE_FREQS.F4, d: eT },
      { f: NOTE_FREQS.E4, d: eT },
      { f: NOTE_FREQS.F4, d: eT },
      { f: NOTE_FREQS.G4, d: qT },
      { f: NOTE_FREQS.B4, d: qT },
      { f: NOTE_FREQS.E4, d: hT },
      { f: 0, d: qT },
    ];

    const bass: ChiptuneNote[] = [
      { f: NOTE_FREQS.C3, d: eT }, { f: NOTE_FREQS.E3, d: eT },
      { f: NOTE_FREQS.G3, d: eT }, { f: NOTE_FREQS.E3, d: eT },
      { f: NOTE_FREQS.C3, d: qT }, { f: NOTE_FREQS.G3, d: qT },
      { f: NOTE_FREQS.G2, d: eT }, { f: NOTE_FREQS.B2, d: eT },
      { f: NOTE_FREQS.D3, d: eT }, { f: NOTE_FREQS.B2, d: eT },
      { f: NOTE_FREQS.G2, d: qT }, { f: NOTE_FREQS.D3, d: qT },
      { f: NOTE_FREQS.C3, d: eT }, { f: NOTE_FREQS.E3, d: eT },
      { f: NOTE_FREQS.G3, d: eT }, { f: NOTE_FREQS.E3, d: eT },
      { f: NOTE_FREQS.C3, d: qT }, { f: NOTE_FREQS.G2, d: qT },
      { f: NOTE_FREQS.C3, d: hT },
      { f: 0, d: qT },
    ];

    this.playBgmTrack('TITLE', lead, harm, bass, true);
  }

  public playGameOver(): void {
    const lead: ChiptuneNote[] = [
      { f: NOTE_FREQS.C5, d: 0.22 },
      { f: NOTE_FREQS.B4, d: 0.22 },
      { f: NOTE_FREQS.As4, d: 0.22 },
      { f: NOTE_FREQS.A4, d: 0.22 },
      { f: NOTE_FREQS.Gs4, d: 0.32 },
      { f: NOTE_FREQS.G4, d: 0.8 },
    ];
    const harm: ChiptuneNote[] = [
      { f: NOTE_FREQS.E4, d: 0.22 },
      { f: NOTE_FREQS.Ds4, d: 0.22 },
      { f: NOTE_FREQS.D4, d: 0.22 },
      { f: NOTE_FREQS.Cs4, d: 0.22 },
      { f: NOTE_FREQS.C4, d: 0.32 },
      { f: NOTE_FREQS.B3, d: 0.8 },
    ];
    const bass: ChiptuneNote[] = [
      { f: NOTE_FREQS.C3, d: 0.44 },
      { f: NOTE_FREQS.Fs2, d: 0.44 },
      { f: NOTE_FREQS.F2, d: 0.32 },
      { f: NOTE_FREQS.C2, d: 0.8 },
    ];

    this.playBgmTrack('GAME_OVER', lead, harm, bass, false);
  }

  public playStageClear(): void {
    const d = 0.11;
    const lead: ChiptuneNote[] = [
      { f: NOTE_FREQS.C5, d },
      { f: NOTE_FREQS.D5, d },
      { f: NOTE_FREQS.E5, d },
      { f: NOTE_FREQS.F5, d },
      { f: NOTE_FREQS.G5, d: 0.16 },
      { f: NOTE_FREQS.A5, d: 0.16 },
      { f: NOTE_FREQS.B5, d: 0.16 },
      { f: NOTE_FREQS.C6, d: 0.6 },
    ];
    const harm: ChiptuneNote[] = [
      { f: 0, d: d * 4 },
      { f: NOTE_FREQS.E5, d: 0.16 },
      { f: NOTE_FREQS.F5, d: 0.16 },
      { f: NOTE_FREQS.G5, d: 0.16 },
      { f: NOTE_FREQS.E5, d: 0.6 },
    ];
    const bass: ChiptuneNote[] = [
      { f: NOTE_FREQS.C3, d: d * 2 },
      { f: NOTE_FREQS.G3, d: d * 2 },
      { f: NOTE_FREQS.C4, d: 0.48 },
      { f: NOTE_FREQS.C3, d: 0.6 },
    ];

    this.playBgmTrack('STAGE_CLEAR', lead, harm, bass, false);
  }

  public stopBgm(): void {
    if (this.bgmTimer) {
      clearTimeout(this.bgmTimer);
      this.bgmTimer = null;
    }
    for (const osc of this.activeBgmOscillators) {
      try {
        osc.stop();
        osc.disconnect();
      } catch {}
    }
    this.activeBgmOscillators = [];
    this._currentBgm = null;
    this._isBgmPaused = false;
  }

  public pauseBgm(): void {
    if (!this._currentBgm || this._isBgmPaused) return;
    this._isBgmPaused = true;
    const ctx = this.getAudioContext();
    if (ctx && this.bgmGain) {
      try {
        this.bgmGain.gain.setValueAtTime(0, ctx.currentTime);
      } catch {}
    }
  }

  public resumeBgm(): void {
    if (!this._currentBgm || !this._isBgmPaused) return;
    this._isBgmPaused = false;
    const ctx = this.getAudioContext();
    if (ctx && this.bgmGain) {
      try {
        this.bgmGain.gain.setValueAtTime(this.bgmVolume, ctx.currentTime);
      } catch {}
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
    this.stopBgm();
    if (this.ctx && this.masterGain) {
      try {
        this.masterGain.disconnect();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(
          this._isMuted ? 0 : this.masterVolume,
          this.ctx.currentTime
        );
        this.masterGain.connect(this.ctx.destination);

        this.bgmGain = this.ctx.createGain();
        this.bgmGain.gain.setValueAtTime(this.bgmVolume, this.ctx.currentTime);
        this.bgmGain.connect(this.masterGain);
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
      this.bgmGain = null;
    }
  }
}

export function createAudioEngine(config?: AudioEngineConfig): IAudioEngine {
  return new AudioEngine(config);
}
