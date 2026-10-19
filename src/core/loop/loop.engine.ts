import type { IGameLoop, LoopConfig, LoopState, RenderCallback, UpdateCallback } from './types';

export const DEFAULT_TARGET_FPS = 60;
export const DEFAULT_FIXED_DELTA_MS = 1000 / DEFAULT_TARGET_FPS; // 16.666666666666668 ms
export const DEFAULT_MAX_ACCUMULATOR_MS = 100; // Limits max sub-ticks to ~6 per frame

export class GameLoopEngine implements IGameLoop {
  private _state: LoopState = 'STOPPED';
  private readonly targetFps: number;
  private readonly fixedDeltaMs: number;
  private readonly maxAccumulatorMs: number;
  private readonly timeProvider: () => number;
  private readonly onUpdate: UpdateCallback;
  private readonly onRender?: RenderCallback;

  private accumulatorMs = 0;
  private lastTimeMs = 0;
  private rafId: number | null = null;

  constructor(
    onUpdate: UpdateCallback,
    onRender?: RenderCallback,
    config?: LoopConfig
  ) {
    this.onUpdate = onUpdate;
    this.onRender = onRender;
    this.targetFps = config?.targetFps ?? DEFAULT_TARGET_FPS;
    this.fixedDeltaMs = 1000 / this.targetFps;
    this.maxAccumulatorMs = config?.maxAccumulatorMs ?? DEFAULT_MAX_ACCUMULATOR_MS;
    this.timeProvider = config?.timeProvider ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
  }

  public get state(): LoopState {
    return this._state;
  }

  public start(): void {
    if (this._state === 'RUNNING') return;

    this._state = 'RUNNING';
    this.accumulatorMs = 0;
    this.lastTimeMs = this.timeProvider();
    this.scheduleFrame();
  }

  public pause(): void {
    if (this._state !== 'RUNNING') return;

    this._state = 'PAUSED';
    if (this.rafId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  public resume(): void {
    if (this._state !== 'PAUSED') return;

    this._state = 'RUNNING';
    // Reset reference timestamp so paused duration is discarded
    this.lastTimeMs = this.timeProvider();
    this.scheduleFrame();
  }

  public stop(): void {
    if (this._state === 'STOPPED') return;

    this._state = 'STOPPED';
    if (this.rafId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.accumulatorMs = 0;
    this.lastTimeMs = 0;
  }

  /**
   * Manual discrete tick execution for headless unit testing or explicit frame stepping.
   */
  public tick(currentTimeMs: number): void {
    if (this._state !== 'RUNNING') return;

    let deltaMs = currentTimeMs - this.lastTimeMs;
    this.lastTimeMs = currentTimeMs;

    // Reject negative or invalid backward deltas
    if (deltaMs < 0) {
      deltaMs = 0;
    }

    // Spiral of Death clamp
    if (deltaMs > this.maxAccumulatorMs) {
      deltaMs = this.maxAccumulatorMs;
    }

    this.accumulatorMs += deltaMs;

    const EPSILON = 0.001; // 1 microsecond tolerance against IEEE-754 floating-point jitter

    // Drain fixed steps
    while (this.accumulatorMs >= this.fixedDeltaMs - EPSILON) {
      this.onUpdate(this.fixedDeltaMs);
      this.accumulatorMs -= this.fixedDeltaMs;
      if (Math.abs(this.accumulatorMs) < EPSILON) {
        this.accumulatorMs = 0;
      }
    }

    // Render with interpolation alpha
    if (this.onRender) {
      const alpha = this.accumulatorMs / this.fixedDeltaMs;
      this.onRender(alpha);
    }
  }

  private scheduleFrame(): void {
    if (this._state !== 'RUNNING') return;
    if (typeof requestAnimationFrame === 'undefined') return;

    this.rafId = requestAnimationFrame((now) => {
      if (this._state !== 'RUNNING') return;
      this.tick(now);
      this.scheduleFrame();
    });
  }
}

/**
 * Factory helper for creating a game loop engine instance.
 */
export function createGameLoop(
  onUpdate: UpdateCallback,
  onRender?: RenderCallback,
  config?: LoopConfig
): IGameLoop {
  return new GameLoopEngine(onUpdate, onRender, config);
}
