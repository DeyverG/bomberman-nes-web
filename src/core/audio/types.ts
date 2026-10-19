/**
 * Audio Constants
 */
export const STEP_COOLDOWN_MS = 140;
export const EXPLOSION_SOUND_DURATION_MS = 480;
export const DEFAULT_MASTER_VOLUME = 0.3;

/**
 * Categorical sound effect types synthesized by the engine
 */
export type AudioEffectType =
  | 'STEP'
  | 'PLACE_BOMB'
  | 'EXPLOSION'
  | 'POWERUP'
  | 'DOOR_REVEALED'
  | 'ENEMIES_CLEARED'
  | 'PLAYER_DEATH'
  | 'STAGE_INTRO'
  | 'STAGE_CLEAR'
  | 'PAUSE';

/**
 * Configuration options for initializing the audio engine
 */
export interface AudioEngineConfig {
  readonly initialMuted?: boolean;
  readonly masterVolume?: number;
  readonly contextFactory?: () => AudioContext | null;
}

/**
 * Public interface for 8-Bit Synthesized Audio Subsystem
 */
export interface IAudioEngine {
  /**
   * True if sound output is currently muted.
   */
  readonly isMuted: boolean;

  /**
   * True if AudioContext has been unlocked by user gesture and is in 'running' state.
   */
  readonly isUnlocked: boolean;

  /**
   * Resumes or creates the underlying AudioContext upon user gesture.
   */
  unlock(): Promise<boolean>;

  /**
   * Toggles mute state and returns new muted value.
   */
  toggleMute(): boolean;

  /**
   * Explicitly sets mute state.
   */
  setMuted(muted: boolean): void;

  /**
   * Footstep acoustic pulse (30ms alternating tones with 140ms cooldown).
   */
  playStep(): void;

  /**
   * Bomb placement upward frequency sweep (200Hz -> 580Hz over 90ms).
   */
  playPlaceBomb(): void;

  /**
   * Filtered white noise explosion burst (900Hz -> 80Hz lowpass over 480ms).
   */
  playExplosion(): void;

  /**
   * 4-note ascending major arpeggio power-up pickup sound (C5, E5, G5, C6).
   */
  playPowerup(): void;

  /**
   * Confirmation chime when exit door is revealed.
   */
  playDoorRevealed(): void;

  /**
   * Chime when final enemy in stage is defeated.
   */
  playAllEnemiesCleared(): void;

  /**
   * Chromatic downward death slide and vibrato on Bomberman dying.
   */
  playPlayerDeath(): void;

  /**
   * 8-bit opening fanfare when STAGE X curtain is displayed.
   */
  playStageIntro(): void;

  /**
   * 8-bit victory melody when stage exit door is crossed.
   */
  playStageClear(): void;

  /**
   * Classic two-tone NES pause chirping sound.
   */
  playPause(): void;

  /**
   * Stops any currently active recurring oscillators or fanfares.
   */
  stopAll(): void;

  /**
   * Cleans up audio context and active nodes.
   */
  dispose(): void;
}
