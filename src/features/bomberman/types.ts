import type { CardinalDirection } from '../../core/input/types';
import type { IStageGridEngine, TileCoord } from '../stage-grid/types';

/**
 * Bomberman Entity Constants
 */
export const PLAYER_SIZE = 16;
export const BASE_SPEED = 0.75; // 0.75 px/tick at 60Hz (45 px/s)
export const SPEED_UP_SPEED = 1.0; // 1.0 px/tick at 60Hz (60 px/s)
export const SLIDE_THRESHOLD = 6; // 6px maximum overlap for corner slide assistance
export const SPAWN_DURATION_MS = 500;
export const DEATH_DURATION_MS = 1000;
export const DEFAULT_INITIAL_LIVES = 3;

/**
 * Player Lifecycle States
 */
export type PlayerState = 'SPAWNING' | 'ALIVE' | 'DYING' | 'DEAD';

/**
 * Facing Direction for Sprite Rendering
 */
export type FacingDirection = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

/**
 * Player In-Game Stats and Upgrades
 */
export interface PlayerStats {
  lives: number;
  score: number;
  maxBombs: number;
  activeBombs: number;
  flameRange: number;
  speed: number;
  hasSpeedUp: boolean;
  hasDetonator: boolean;
  wallpass: boolean;
  flamepass: boolean;
  bombpass: boolean;
  invincibleTimerMs: number;
}

/**
 * Result of corner sliding evaluation
 */
export interface CornerSlideEvaluation {
  readonly canMovePrimary: boolean;
  readonly slideOffset: number; // Signed pixel adjustment (-speed, +speed, or 0)
  readonly isBlocked: boolean;
}

/**
 * Read-only snapshot of player state for renderers and HUD
 */
export interface PlayerSnapshot {
  readonly x: number;
  readonly y: number;
  readonly tileX: number;
  readonly tileY: number;
  readonly state: PlayerState;
  readonly facing: FacingDirection;
  readonly stats: Readonly<PlayerStats>;
  readonly isInvulnerable: boolean;
  readonly deathTimerMs: number;
  readonly isMoving: boolean;
  readonly walkFrame: number;
}

/**
 * Obstacle query provider for active bombs and dynamic obstacles
 */
export interface TileObstacleQuery {
  isTileBlockedByBomb?(tx: number, ty: number, player: IBombermanEntity): boolean;
}

/**
 * Direction inputs for player movement supporting primary with secondary fallback
 */
export interface PlayerMovementInput {
  readonly primary: CardinalDirection | null;
  readonly secondary?: CardinalDirection | null;
}

/**
 * Public interface for Bomberman Player Entity
 */
export interface IBombermanEntity {
  x: number;
  y: number;
  readonly state: PlayerState;
  readonly facing: FacingDirection;
  readonly stats: PlayerStats;
  readonly centerTile: TileCoord;
  readonly isInvulnerable: boolean;
  readonly isMoving: boolean;
  readonly walkFrame: number;
  walkAnimTimerMs: number;

  /**
   * Updates player movement, applies corner-sliding against the stage grid and solid bombs, and ticks timers.
   */
  update(
    deltaMs: number,
    direction: CardinalDirection | null | PlayerMovementInput,
    grid: IStageGridEngine,
    secondaryDirection?: CardinalDirection | null,
    obstacleQuery?: TileObstacleQuery
  ): void;

  /**
   * Hits the player with lethal damage. Returns true if transition to DYING was triggered.
   */
  kill(): boolean;

  /**
   * Resets player position and status to spawn point at tile (1, 1).
   */
  resetToSpawn(): void;

  /**
   * Returns a detached immutable snapshot of current player state.
   */
  getSnapshot(): PlayerSnapshot;
}
