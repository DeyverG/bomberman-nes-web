/**
 * Loop Engine Lifecycle States
 */
export type LoopState = 'STOPPED' | 'RUNNING' | 'PAUSED';

/**
 * Fixed timestep update callback signature.
 * @param fixedDeltaMs Always exactly 1000 / 60 ms (~16.666667ms)
 */
export type UpdateCallback = (fixedDeltaMs: number) => void;

/**
 * Frame render callback signature.
 * @param interpolationAlpha Value in [0.0, 1.0) representing fractional remainder time for sub-frame smoothing
 */
export type RenderCallback = (interpolationAlpha: number) => void;

/**
 * Configuration options for the Fixed Timestep Loop Engine.
 */
export interface LoopConfig {
  /**
   * Target simulation frequency in Hz.
   * @default 60
   */
  readonly targetFps?: number;

  /**
   * Maximum accumulated delta in ms to clamp lag spikes and prevent spiral-of-death.
   * @default 100
   */
  readonly maxAccumulatorMs?: number;

  /**
   * Injectable timestamp provider returning milliseconds (e.g. performance.now).
   * Essential for deterministic unit testing.
   * @default () => performance.now()
   */
  readonly timeProvider?: () => number;
}

/**
 * Public interface for the pure TypeScript Game Loop Engine.
 */
export interface IGameLoop {
  /**
   * Current lifecycle state of the loop.
   */
  readonly state: LoopState;

  /**
   * Starts the fixed timestep loop. Valid only from 'STOPPED'.
   */
  start(): void;

  /**
   * Pauses the loop. Cancels frame dispatch while preserving accumulator.
   */
  pause(): void;

  /**
   * Resumes from 'PAUSED'. Resets time reference to prevent catch-up lag spikes.
   */
  resume(): void;

  /**
   * Stops the loop and resets accumulator to 0.
   */
  stop(): void;

  /**
   * Synchronous manual tick invocation for headless testing or deterministic replay.
   * @param currentTimeMs Timestamp in milliseconds
   */
  tick(currentTimeMs: number): void;
}
