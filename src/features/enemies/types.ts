import type { IBombermanEntity } from '../bomberman/types';
import type { Explosion, IOrdinanceEngine } from '../ordinance/types';
import type { IStageGridEngine } from '../stage-grid/types';

/**
 * The 7 Canonical Enemy Types in NES Bomberman (1985).
 */
export type EnemyType =
  | 'BALLOM'
  | 'ONEAL'
  | 'DAHL'
  | 'MINVO'
  | 'OVAPE'
  | 'KONDORIA'
  | 'PONTAN';

/**
 * Enemy Lifecycle States
 */
export type EnemyState = 'ALIVE' | 'DYING' | 'DEAD';

/**
 * Cardinal directions for enemy locomotion
 */
export type EnemyDirection = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

/**
 * Enemy Subsystem Constants
 */
export const ENEMY_SIZE = 16;
export const ENEMY_DEATH_DURATION_MS = 600;
export const SPAWN_EXCLUSION_MANHATTAN_DISTANCE = 5;

/**
 * Official NES Bomberman Base Scores per Enemy
 */
export const ENEMY_BASE_SCORES: Readonly<Record<EnemyType, number>> = {
  BALLOM: 100,
  ONEAL: 200,
  DAHL: 400,
  MINVO: 800,
  OVAPE: 1000,
  KONDORIA: 2000,
  PONTAN: 4000,
};

/**
 * Official Speeds (pixels per tick at 60Hz)
 */
export const ENEMY_BASE_SPEEDS: Readonly<Record<EnemyType, number>> = {
  BALLOM: 0.5,
  ONEAL: 0.75,
  DAHL: 0.75,
  MINVO: 1.0,
  OVAPE: 0.5,
  KONDORIA: 0.25,
  PONTAN: 1.5,
};

/**
 * Wallpass ability (can walk through destructible soft blocks)
 */
export const ENEMY_WALLPASS_CAPABILITIES: Readonly<Record<EnemyType, boolean>> = {
  BALLOM: false,
  ONEAL: false,
  DAHL: false,
  MINVO: false,
  OVAPE: true,
  KONDORIA: true,
  PONTAN: true,
};

/**
 * Result of destroying an enemy via bomb flame with simultaneous combo multiplier
 */
export interface ComboKillResult {
  readonly enemyId: number;
  readonly enemyType: EnemyType;
  readonly comboIndex: number; // 1-indexed (1st, 2nd, 3rd, 4th+)
  readonly multiplier: number; // 1, 2, 4, or 8
  readonly pointsAwarded: number;
}

/**
 * Concrete Enemy Instance
 */
export interface EnemyEntity {
  readonly id: number;
  readonly type: EnemyType;
  x: number;
  y: number;
  direction: EnemyDirection;
  state: EnemyState;
  speed: number;
  readonly hasWallpass: boolean;
  readonly baseScore: number;
  deathTimerMs: number;
  scoreAwarded?: number;
}

/**
 * Detached snapshot for rendering and headless testing
 */
export interface EnemySnapshot {
  readonly id: number;
  readonly type: EnemyType;
  readonly x: number;
  readonly y: number;
  readonly tileX: number;
  readonly tileY: number;
  readonly direction: EnemyDirection;
  readonly state: EnemyState;
  readonly speed: number;
  readonly hasWallpass: boolean;
  readonly deathTimerMs: number;
  readonly scoreAwarded?: number;
}

/**
 * Public Interface for Enemy Management Engine
 */
export interface IEnemiesEngine {
  /**
   * All currently active enemies (ALIVE and DYING).
   */
  readonly activeEnemies: readonly EnemyEntity[];

  /**
   * Number of living enemies remaining on the stage.
   */
  readonly aliveCount: number;

  /**
   * Spawns a single enemy on a qualified tile outside the safe spawn zone.
   * Returns null if tile is within exclusion zone or obstructed.
   */
  spawnEnemy(
    type: EnemyType,
    tx: number,
    ty: number,
    grid: IStageGridEngine
  ): EnemyEntity | null;

  /**
   * Spawns the authentic stage enemy distribution for the specified stage number.
   */
  spawnStageEnemies(
    stage: number,
    grid: IStageGridEngine,
    rng?: () => number
  ): readonly EnemyEntity[];

  /**
   * Advances enemy positions at 60 FPS, evaluates grid-aligned turns, ticks death timers,
   * checks flame segment collisions, and checks lethality against the player.
   */
  update(
    deltaMs: number,
    player: IBombermanEntity,
    grid: IStageGridEngine,
    ordinance: IOrdinanceEngine
  ): void;

  /**
   * Tests active explosion flames against alive enemies and calculates combo scores.
   */
  checkFlameCollisions(
    explosions: readonly Explosion[],
    player: IBombermanEntity
  ): readonly ComboKillResult[];

  /**
   * Tests lethality against player inner hitbox. Kills player if unshielded.
   * Returns true if player was killed in this evaluation.
   */
  checkPlayerLethality(player: IBombermanEntity): boolean;

  /**
   * Resets and clears all enemies.
   */
  clearAll(): void;
}
