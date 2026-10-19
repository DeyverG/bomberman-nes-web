import type { IBombermanEntity } from '../bomberman/types';
import type { IStageGridEngine } from '../stage-grid/types';

/**
 * Core Ordinance Constants for NES Bomberman (1985)
 */
export const FUSE_DURATION_MS = 3000; // 3.0 seconds fuse (~180 frames at 60Hz)
export const EXPLOSION_DURATION_MS = 480; // 480ms explosion duration synchronized with brick decay
export const FLAME_PHASE_DURATION_MS = 120; // 4 visual flame oscillation phases (480 / 4)

/**
 * Bomb Lifecycle State
 */
export type BombState = 'PLANTED' | 'DETONATING' | 'CLEARED';

/**
 * Flame Segment Typology for Directional Rendering
 */
export type FlameSegmentType =
  | 'CENTER'
  | 'HORIZONTAL_BODY'
  | 'VERTICAL_BODY'
  | 'TOP_END'
  | 'BOTTOM_END'
  | 'LEFT_END'
  | 'RIGHT_END';

/**
 * Discrete segment of an active explosion cross
 */
export interface FlameSegment {
  readonly tx: number;
  readonly ty: number;
  readonly type: FlameSegmentType;
}

/**
 * Active cross explosion spanning multiple tiles
 */
export interface Explosion {
  readonly id: number;
  readonly originTx: number;
  readonly originTy: number;
  readonly range: number;
  readonly segments: readonly FlameSegment[];
  elapsedMs: number;
  readonly totalDurationMs: number;
  readonly phase: number; // 0, 1, 2, 3
  readonly isFinished: boolean;
}

/**
 * Active planted bomb entity
 */
export interface Bomb {
  readonly id: number;
  readonly tx: number;
  readonly ty: number;
  readonly flameRange: number;
  elapsedMs: number;
  readonly fuseDurationMs: number;
  ownerPassThrough: boolean;
  state: BombState;
}

/**
 * Public interface for Ordinance & Explosion Engine
 */
export interface IOrdinanceEngine {
  /**
   * Currently active planted bombs on the stage.
   */
  readonly activeBombs: readonly Bomb[];

  /**
   * Currently active explosions spreading flames across the stage.
   */
  readonly activeExplosions: readonly Explosion[];

  /**
   * Attempts to plant a bomb at discrete tile (tx, ty).
   * Validates capacity, occupancy, and walkability.
   * Returns created Bomb or null if placement conditions failed.
   */
  placeBomb(
    tx: number,
    ty: number,
    player: IBombermanEntity,
    grid: IStageGridEngine
  ): Bomb | null;

  /**
   * Triggers manual detonation of the oldest active bomb (requires detonator upgrade).
   */
  detonateOldestBomb(grid: IStageGridEngine, player?: IBombermanEntity): void;

  /**
   * Advances fuse timers, updates walk-off grace status, advances explosion frames,
   * triggers chain reactions, and evaluates flame lethality against player.
   */
  update(
    deltaMs: number,
    player: IBombermanEntity,
    grid: IStageGridEngine
  ): void;

  /**
   * Checks if an active bomb is located at discrete tile (tx, ty).
   */
  isBombAt(tx: number, ty: number): boolean;

  /**
   * Checks if active flame is currently covering discrete tile (tx, ty).
   */
  isFlameAt(tx: number, ty: number): boolean;

  /**
   * Checks if a bomb at (tx, ty) blocks movement for the given player.
   * Considers ownerPassThrough and player.stats.bombpass.
   */
  isTileBlockedByBomb(
    tx: number,
    ty: number,
    player: IBombermanEntity
  ): boolean;

  /**
   * Resets all bombs and explosions to empty state.
   */
  clear(): void;
}
