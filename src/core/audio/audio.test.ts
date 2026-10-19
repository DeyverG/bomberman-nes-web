import { describe, expect, it, vi } from 'vitest';
import { AudioEngine, createAudioEngine } from './audio.engine';
import { DEFAULT_MASTER_VOLUME } from './types';

// Helper to construct a mock AudioContext for headless unit test verification
function createMockAudioContext(state: AudioContextState = 'suspended') {
  const destination = {} as AudioDestinationNode;

  const mockGainNode = {
    gain: {
      value: 1,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  const mockOscillatorNode = {
    type: 'sine',
    frequency: {
      value: 440,
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };

  const mockFilterNode = {
    type: 'lowpass',
    frequency: {
      value: 350,
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    Q: {
      value: 1,
      setValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
  };

  const mockBuffer = {
    getChannelData: vi.fn().mockReturnValue(new Float32Array(1000)),
  };

  const mockBufferSourceNode = {
    buffer: null as unknown,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };

  const mockCtx = {
    currentTime: 10.0,
    sampleRate: 44100,
    state,
    destination,
    createGain: vi.fn().mockReturnValue(mockGainNode),
    createOscillator: vi.fn().mockReturnValue(mockOscillatorNode),
    createBiquadFilter: vi.fn().mockReturnValue(mockFilterNode),
    createBuffer: vi.fn().mockReturnValue(mockBuffer),
    createBufferSource: vi.fn().mockReturnValue(mockBufferSourceNode),
    resume: vi.fn().mockImplementation(async () => {
      mockCtx.state = 'running';
    }),
    close: vi.fn().mockResolvedValue(undefined),
  };

  return {
    mockCtx: mockCtx as unknown as AudioContext,
    mockGainNode,
    mockOscillatorNode,
    mockFilterNode,
    mockBufferSourceNode,
  };
}

describe('8-Bit Synthesized Audio Subsystem (Unit Test Verification)', () => {
  describe('Headless & SSR Graceful Fallback (No-Op Safety)', () => {
    it('initializes safely when window.AudioContext is absent', () => {
      const audio = createAudioEngine();
      expect(audio.isMuted).toBe(false);
      expect(audio.isUnlocked).toBe(false);
    });

    it('unlock() returns false gracefully in headless environment', async () => {
      const audio = createAudioEngine();
      const unlocked = await audio.unlock();
      expect(unlocked).toBe(false);
    });

    it('all sound synthesis methods execute without throwing in headless environment', () => {
      const audio = createAudioEngine();

      expect(() => {
        audio.playStep();
        audio.playPlaceBomb();
        audio.playExplosion();
        audio.playPowerup();
        audio.playDoorRevealed();
        audio.playAllEnemiesCleared();
        audio.playPlayerDeath();
        audio.playStageIntro();
        audio.playStageClear();
        audio.playPause();
        audio.stopAll();
        audio.dispose();
      }).not.toThrow();
    });
  });

  describe('Mute State Management & Volume Control', () => {
    it('initializes with custom initialMuted configuration', () => {
      const audio = createAudioEngine({ initialMuted: true });
      expect(audio.isMuted).toBe(true);
    });

    it('toggleMute() flips muted state and returns new value', () => {
      const audio = createAudioEngine({ initialMuted: false });
      expect(audio.isMuted).toBe(false);

      expect(audio.toggleMute()).toBe(true);
      expect(audio.isMuted).toBe(true);

      expect(audio.toggleMute()).toBe(false);
      expect(audio.isMuted).toBe(false);
    });

    it('setMuted(boolean) explicitly sets mute flag and updates gain node', () => {
      const { mockCtx, mockGainNode } = createMockAudioContext();
      const audio = new AudioEngine({ contextFactory: () => mockCtx, initialMuted: false });

      audio.setMuted(true);
      expect(audio.isMuted).toBe(true);
      expect(mockGainNode.gain.setValueAtTime).toHaveBeenCalledWith(0, mockCtx.currentTime);

      audio.setMuted(false);
      expect(audio.isMuted).toBe(false);
      expect(mockGainNode.gain.setValueAtTime).toHaveBeenCalledWith(
        DEFAULT_MASTER_VOLUME,
        mockCtx.currentTime
      );
    });
  });

  describe('Synthesized Sound Effects Verification (Mock AudioContext)', () => {
    it('unlock() resumes suspended AudioContext and returns true', async () => {
      const { mockCtx } = createMockAudioContext('suspended');
      const audio = new AudioEngine({ contextFactory: () => mockCtx });

      expect(audio.isUnlocked).toBe(false);
      const success = await audio.unlock();

      expect(success).toBe(true);
      expect(mockCtx.resume).toHaveBeenCalled();
      expect(audio.isUnlocked).toBe(true);
    });

    it('playStep() enforces 140ms throttling cooldown and synthesizes authentic square wave micro-pulses', () => {
      const { mockCtx, mockOscillatorNode, mockGainNode } = createMockAudioContext();
      const audio = new AudioEngine({ contextFactory: () => mockCtx });

      // First step triggers oscillator with step A (980Hz -> 620Hz in 28ms)
      audio.playStep();
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(1);
      expect(mockOscillatorNode.type).toBe('square');
      expect(mockOscillatorNode.frequency.setValueAtTime).toHaveBeenCalledWith(980, mockCtx.currentTime);
      expect(mockOscillatorNode.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
        620,
        mockCtx.currentTime + 0.028
      );
      expect(mockGainNode.gain.setValueAtTime).toHaveBeenCalledWith(0.18, mockCtx.currentTime);
      expect(mockGainNode.gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(
        0.001,
        mockCtx.currentTime + 0.028
      );

      // Immediate second step within 140ms cooldown is throttled
      audio.playStep();
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(1);
    });

    it('playPlaceBomb() synthesizes square wave with upward sweep (200Hz to 580Hz)', () => {
      const { mockCtx, mockOscillatorNode } = createMockAudioContext();
      const audio = new AudioEngine({ contextFactory: () => mockCtx });

      audio.playPlaceBomb();

      expect(mockCtx.createOscillator).toHaveBeenCalled();
      expect(mockOscillatorNode.type).toBe('square');
      expect(mockOscillatorNode.frequency.setValueAtTime).toHaveBeenCalledWith(200, mockCtx.currentTime);
      expect(mockOscillatorNode.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
        580,
        mockCtx.currentTime + 0.09
      );
      expect(mockOscillatorNode.start).toHaveBeenCalledWith(mockCtx.currentTime);
      expect(mockOscillatorNode.stop).toHaveBeenCalledWith(mockCtx.currentTime + 0.09);
    });

    it('playExplosion() generates dual-layer explosion (crunch noise + sub-bass punch)', () => {
      const { mockCtx, mockFilterNode, mockBufferSourceNode, mockOscillatorNode, mockGainNode } =
        createMockAudioContext();
      const audio = new AudioEngine({ contextFactory: () => mockCtx });

      audio.playExplosion();

      // Capa 1: Ruido crunchy + Lowpass 3500Hz -> 140Hz con Q=3.5
      expect(mockCtx.createBuffer).toHaveBeenCalled();
      expect(mockCtx.createBufferSource).toHaveBeenCalled();
      expect(mockCtx.createBiquadFilter).toHaveBeenCalled();
      expect(mockFilterNode.type).toBe('lowpass');
      expect(mockFilterNode.Q.value).toBe(3.5);
      expect(mockFilterNode.frequency.setValueAtTime).toHaveBeenCalledWith(3500, mockCtx.currentTime);
      expect(mockFilterNode.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
        140,
        mockCtx.currentTime + 0.48
      );
      expect(mockBufferSourceNode.start).toHaveBeenCalledWith(mockCtx.currentTime);
      expect(mockBufferSourceNode.stop).toHaveBeenCalledWith(mockCtx.currentTime + 0.48);

      // Capa 2: Sub-Bass oscillator 160Hz -> 28Hz
      expect(mockCtx.createOscillator).toHaveBeenCalled();
      expect(mockOscillatorNode.type).toBe('triangle');
      expect(mockOscillatorNode.frequency.setValueAtTime).toHaveBeenCalledWith(160, mockCtx.currentTime);
      expect(mockOscillatorNode.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
        28,
        mockCtx.currentTime + 0.3
      );
      expect(mockOscillatorNode.start).toHaveBeenCalledWith(mockCtx.currentTime);
      expect(mockOscillatorNode.stop).toHaveBeenCalledWith(mockCtx.currentTime + 0.32);

      // Verifies gain envelope setup for both layers
      expect(mockGainNode.gain.setValueAtTime).toHaveBeenCalledWith(0.001, mockCtx.currentTime);
      expect(mockGainNode.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.9, mockCtx.currentTime + 0.005);
      expect(mockGainNode.gain.setValueAtTime).toHaveBeenCalledWith(0.85, mockCtx.currentTime);
    });

    it('playPowerup() synthesizes 4 ascending major arpeggio notes (C5, E5, G5, C6)', () => {
      const { mockCtx } = createMockAudioContext();
      const audio = new AudioEngine({ contextFactory: () => mockCtx });

      audio.playPowerup();

      // Creates 4 sequential oscillators
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(4);
    });

    it('playPause() synthesizes classic NES two-tone chirping chime (880Hz and 1760Hz)', () => {
      const { mockCtx } = createMockAudioContext();
      const audio = new AudioEngine({ contextFactory: () => mockCtx });

      audio.playPause();

      // Creates 2 sequential oscillators for the two tones
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(2);
    });

    it('playPlayerDeath() synthesizes downward chromatic slide (620Hz to 110Hz)', () => {
      const { mockCtx, mockOscillatorNode } = createMockAudioContext();
      const audio = new AudioEngine({ contextFactory: () => mockCtx });

      audio.playPlayerDeath();

      expect(mockOscillatorNode.type).toBe('square');
      expect(mockOscillatorNode.frequency.setValueAtTime).toHaveBeenCalledWith(620, mockCtx.currentTime);
      expect(mockOscillatorNode.frequency.linearRampToValueAtTime).toHaveBeenCalledWith(
        110,
        mockCtx.currentTime + 0.75
      );
    });
  });

  describe('Chiptune BGM Sequencer (3-Channel Polyphony & State Machine)', () => {
    it('initializes with currentBgm = null and isBgmPlaying = false', () => {
      const audio = createAudioEngine();
      expect(audio.currentBgm).toBeNull();
      expect(audio.isBgmPlaying).toBe(false);
    });

    it('playTitleBgm() activates TITLE track and schedules polyphonic channels', () => {
      const { mockCtx } = createMockAudioContext();
      const audio = new AudioEngine({ contextFactory: () => mockCtx });

      audio.playTitleBgm();
      expect(audio.currentBgm).toBe('TITLE');
      expect(audio.isBgmPlaying).toBe(true);
      expect(mockCtx.createOscillator).toHaveBeenCalled();
    });

    it('playStageIntro() activates STAGE_INTRO fanfare', () => {
      const { mockCtx } = createMockAudioContext();
      const audio = new AudioEngine({ contextFactory: () => mockCtx });

      audio.playStageIntro();
      expect(audio.currentBgm).toBe('STAGE_INTRO');
      expect(audio.isBgmPlaying).toBe(true);
    });

    it('playStageTheme() activates STAGE_THEME iconic Jun Chikuma 148 BPM theme', () => {
      const { mockCtx } = createMockAudioContext();
      const audio = new AudioEngine({ contextFactory: () => mockCtx });

      audio.playStageTheme();
      expect(audio.currentBgm).toBe('STAGE_THEME');
      expect(audio.isBgmPlaying).toBe(true);
      expect(mockCtx.createOscillator).toHaveBeenCalled();
    });

    it('playGameOver() activates GAME_OVER track', () => {
      const { mockCtx } = createMockAudioContext();
      const audio = new AudioEngine({ contextFactory: () => mockCtx });

      audio.playGameOver();
      expect(audio.currentBgm).toBe('GAME_OVER');
      expect(audio.isBgmPlaying).toBe(true);
    });

    it('pauseBgm() and resumeBgm() properly toggle playback state and gain without stopping track', () => {
      const { mockCtx, mockGainNode } = createMockAudioContext();
      const audio = new AudioEngine({ contextFactory: () => mockCtx });

      audio.playStageTheme();
      expect(audio.isBgmPlaying).toBe(true);
      expect(audio.currentBgm).toBe('STAGE_THEME');

      // Pause BGM: sets isBgmPlaying = false while keeping currentBgm intact
      audio.pauseBgm();
      expect(audio.isBgmPlaying).toBe(false);
      expect(audio.currentBgm).toBe('STAGE_THEME');
      expect(mockGainNode.gain.setValueAtTime).toHaveBeenCalledWith(0, mockCtx.currentTime);

      // Resume BGM: brings volume back up and restores isBgmPlaying = true
      audio.resumeBgm();
      expect(audio.isBgmPlaying).toBe(true);
      expect(audio.currentBgm).toBe('STAGE_THEME');
    });

    it('stopBgm() and stopAll() immediately cancel playback and reset currentBgm to null', () => {
      const { mockCtx } = createMockAudioContext();
      const audio = new AudioEngine({ contextFactory: () => mockCtx });

      audio.playStageTheme();
      expect(audio.currentBgm).toBe('STAGE_THEME');

      audio.stopBgm();
      expect(audio.currentBgm).toBeNull();
      expect(audio.isBgmPlaying).toBe(false);

      audio.playTitleBgm();
      expect(audio.currentBgm).toBe('TITLE');

      audio.stopAll();
      expect(audio.currentBgm).toBeNull();
      expect(audio.isBgmPlaying).toBe(false);
    });
  });
});
