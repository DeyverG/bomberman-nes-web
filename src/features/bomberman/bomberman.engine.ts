import type { CardinalDirection } from '../../core/input/types';
import type { IStageGridEngine, TileCoord } from '../stage-grid/types';
import { TileType } from '../stage-grid/types';
import {
  BASE_SPEED,
  DEATH_DURATION_MS,
  DEFAULT_INITIAL_LIVES,
  FacingDirection,
  IBombermanEntity,
  PlayerMovementInput,
  PlayerSnapshot,
  PlayerState,
  PlayerStats,
  SLIDE_THRESHOLD,
  SPAWN_DURATION_MS,
  SPEED_UP_SPEED,
} from './types';

/**
 * Player-aware tile passability predicate respecting wallpass upgrade and active bombs.
 */
export function isTilePassableForPlayer(
  tx: number,
  ty: number,
  grid: IStageGridEngine,
  stats: PlayerStats,
  obstacleQuery?: { isTileBlockedByBomb?(tx: number, ty: number, player: IBombermanEntity): boolean },
  player?: IBombermanEntity
): boolean {
  if (!grid.isInBounds(tx, ty)) return false;
  const tile = grid.getTile(tx, ty);

  if (tile === TileType.HARD_WALL) return false;

  // Active solid bomb blocking
  if (obstacleQuery && player && obstacleQuery.isTileBlockedByBomb?.(tx, ty, player)) {
    return false;
  }

  if (
    tile === TileType.SOFT_BLOCK ||
    tile === TileType.SOFT_BLOCK_WITH_DOOR ||
    tile === TileType.SOFT_BLOCK_WITH_POWERUP ||
    tile === TileType.BURNING_BLOCK
  ) {
    return stats.wallpass;
  }

  return true; // EMPTY, DOOR_REVEALED, POWERUP_REVEALED
}

export class BombermanEntity implements IBombermanEntity {
  public x = 16.0;
  public y = 16.0;
  private _state: PlayerState = 'SPAWNING';
  private _facing: FacingDirection = 'DOWN';
  private _stateTimerMs = 0;
  public isMoving = false;
  public walkFrame = 0;
  public walkAnimTimerMs = 0;

  public readonly stats: PlayerStats = {
    lives: DEFAULT_INITIAL_LIVES,
    score: 0,
    maxBombs: 1,
    activeBombs: 0,
    flameRange: 1,
    speed: BASE_SPEED,
    hasSpeedUp: false,
    hasDetonator: false,
    wallpass: false,
    flamepass: false,
    bombpass: false,
    invincibleTimerMs: 0,
  };

  constructor(initialStats?: Partial<PlayerStats>) {
    if (initialStats) {
      Object.assign(this.stats, initialStats);
      if (initialStats.hasSpeedUp && !initialStats.speed) {
        this.stats.speed = SPEED_UP_SPEED;
      }
    }
  }

  public get state(): PlayerState {
    return this._state;
  }

  public get facing(): FacingDirection {
    return this._facing;
  }

  public get isInvulnerable(): boolean {
    return (
      this._state === 'SPAWNING' ||
      this._state === 'DYING' ||
      this._state === 'DEAD' ||
      this.stats.invincibleTimerMs > 0
    );
  }

  public get centerTile(): TileCoord {
    return {
      x: Math.floor((this.x + 8.0) / 16),
      y: Math.floor((this.y + 8.0) / 16),
    };
  }

  public kill(): boolean {
    if (this._state !== 'ALIVE' || this.isInvulnerable) return false;

    this._state = 'DYING';
    this._stateTimerMs = 0;
    return true;
  }

  public resetToSpawn(): void {
    this.x = 16.0;
    this.y = 16.0;
    this._state = 'SPAWNING';
    this._facing = 'DOWN';
    this._stateTimerMs = 0;
    this.isMoving = false;
    this.walkFrame = 0;
    this.walkAnimTimerMs = 0;
  }

  public getSnapshot(): PlayerSnapshot {
    return {
      x: this.x,
      y: this.y,
      tileX: this.centerTile.x,
      tileY: this.centerTile.y,
      state: this._state,
      facing: this._facing,
      stats: { ...this.stats },
      isInvulnerable: this.isInvulnerable,
      deathTimerMs: this._stateTimerMs,
      isMoving: this.isMoving,
      walkFrame: this.walkFrame,
    };
  }

  public update(
    deltaMs: number,
    direction: CardinalDirection | null | PlayerMovementInput,
    grid: IStageGridEngine,
    secondaryDirection?: CardinalDirection | null,
    obstacleQuery?: { isTileBlockedByBomb?(tx: number, ty: number, player: IBombermanEntity): boolean }
  ): void {
    this._stateTimerMs += deltaMs;

    if (this.stats.invincibleTimerMs > 0) {
      this.stats.invincibleTimerMs = Math.max(0, this.stats.invincibleTimerMs - deltaMs);
    }

    // Lifecycle state transitions
    if (this._state === 'SPAWNING') {
      if (this._stateTimerMs >= SPAWN_DURATION_MS) {
        this._state = 'ALIVE';
        this._stateTimerMs = 0;
      }
    } else if (this._state === 'DYING') {
      this.isMoving = false;
      this.walkFrame = 0;
      this.walkAnimTimerMs = 0;
      if (this._stateTimerMs >= DEATH_DURATION_MS) {
        this._state = 'DEAD';
        this.stats.lives = Math.max(0, this.stats.lives - 1);
      }
      return; // Freeze movement while dying
    } else if (this._state === 'DEAD') {
      this.isMoving = false;
      this.walkFrame = 0;
      this.walkAnimTimerMs = 0;
      return;
    }

    if (this._state !== 'ALIVE') {
      this.isMoving = false;
      this.walkFrame = 0;
      this.walkAnimTimerMs = 0;
      return;
    }

    const prevX = this.x;
    const prevY = this.y;

    // Resolve primary and secondary direction
    let primaryDir: CardinalDirection | null = null;
    let secondaryDir: CardinalDirection | null = null;

    if (direction && typeof direction === 'object' && 'primary' in direction) {
      primaryDir = direction.primary;
      secondaryDir = direction.secondary ?? null;
    } else {
      primaryDir = direction as CardinalDirection | null;
      secondaryDir = secondaryDirection ?? null;
    }

    const currentSpeed = this.stats.hasSpeedUp ? SPEED_UP_SPEED : this.stats.speed;

    if (primaryDir) {
      const moved = this.attemptMove(primaryDir, currentSpeed, grid, obstacleQuery);
      // If primary was blocked (0 displacement), evaluate secondary within same tick
      if (!moved && secondaryDir) {
        this.attemptMove(secondaryDir, currentSpeed, grid, obstacleQuery);
      }
    }

    // Exact movement calculation and idle leg freeze
    const deltaMoved = Math.abs(this.x - prevX) + Math.abs(this.y - prevY);
    this.isMoving = deltaMoved > 0.001 && this._state === 'ALIVE';
    if (this.isMoving) {
      this.walkAnimTimerMs += deltaMs;
      const seq = [0, 1, 0, 2];
      const step = Math.floor(this.walkAnimTimerMs / 90) % seq.length;
      this.walkFrame = seq[step];
    } else {
      this.walkFrame = 0;
      this.walkAnimTimerMs = 0;
    }
  }

  /**
   * Evaluates movement with Corner-Sliding turn assistance and Snap-to-Tile anti-tunneling.
   * Returns true if any displacement occurred.
   */
  private attemptMove(
    dir: CardinalDirection,
    speed: number,
    grid: IStageGridEngine,
    obstacleQuery?: { isTileBlockedByBomb?(tx: number, ty: number, player: IBombermanEntity): boolean }
  ): boolean {
    this._facing = dir;
    const initialX = this.x;
    const initialY = this.y;

    const isPassable = (tx: number, ty: number) =>
      isTilePassableForPlayer(tx, ty, grid, this.stats, obstacleQuery, this);

    if (dir === 'UP') {
      const nextY = this.y - speed;
      const ty_target = Math.floor(nextY / 16);
      const rx = ((this.x % 16) + 16) % 16;

      if (rx === 0) {
        const tx = Math.floor(this.x / 16);
        if (isPassable(tx, ty_target)) {
          this.y = nextY;
        } else {
          this.y = (ty_target + 1) * 16; // Snap top edge flush
        }
      } else {
        const tx1 = Math.floor(this.x / 16);
        const tx2 = tx1 + 1;
        const t1 = isPassable(tx1, ty_target);
        const t2 = isPassable(tx2, ty_target);

        if (t1 && t2) {
          this.y = nextY;
        } else if (t1 && !t2) {
          if (rx <= SLIDE_THRESHOLD) {
            this.x = Math.max(tx1 * 16, this.x - speed); // Slide Left
            this.y = nextY;
          } else {
            this.y = (ty_target + 1) * 16; // Head-on Snap
          }
        } else if (!t1 && t2) {
          if (rx >= 16 - SLIDE_THRESHOLD) {
            this.x = Math.min(tx2 * 16, this.x + speed); // Slide Right
            this.y = nextY;
          } else {
            this.y = (ty_target + 1) * 16; // Head-on Snap
          }
        } else {
          this.y = (ty_target + 1) * 16; // Solid Wall Snap
        }
      }
    } else if (dir === 'DOWN') {
      const nextY = this.y + speed;
      const bottomY = nextY + 16 - 0.0001;
      const ty_target = Math.floor(bottomY / 16);
      const rx = ((this.x % 16) + 16) % 16;

      if (rx === 0) {
        const tx = Math.floor(this.x / 16);
        if (isPassable(tx, ty_target)) {
          this.y = nextY;
        } else {
          this.y = (ty_target - 1) * 16; // Snap bottom edge flush
        }
      } else {
        const tx1 = Math.floor(this.x / 16);
        const tx2 = tx1 + 1;
        const t1 = isPassable(tx1, ty_target);
        const t2 = isPassable(tx2, ty_target);

        if (t1 && t2) {
          this.y = nextY;
        } else if (t1 && !t2) {
          if (rx <= SLIDE_THRESHOLD) {
            this.x = Math.max(tx1 * 16, this.x - speed); // Slide Left
            this.y = nextY;
          } else {
            this.y = (ty_target - 1) * 16; // Head-on Snap
          }
        } else if (!t1 && t2) {
          if (rx >= 16 - SLIDE_THRESHOLD) {
            this.x = Math.min(tx2 * 16, this.x + speed); // Slide Right
            this.y = nextY;
          } else {
            this.y = (ty_target - 1) * 16; // Head-on Snap
          }
        } else {
          this.y = (ty_target - 1) * 16; // Solid Wall Snap
        }
      }
    } else if (dir === 'LEFT') {
      const nextX = this.x - speed;
      const tx_target = Math.floor(nextX / 16);
      const ry = ((this.y % 16) + 16) % 16;

      if (ry === 0) {
        const ty = Math.floor(this.y / 16);
        if (isPassable(tx_target, ty)) {
          this.x = nextX;
        } else {
          this.x = (tx_target + 1) * 16; // Snap left edge flush
        }
      } else {
        const ty1 = Math.floor(this.y / 16);
        const ty2 = ty1 + 1;
        const t1 = isPassable(tx_target, ty1);
        const t2 = isPassable(tx_target, ty2);

        if (t1 && t2) {
          this.x = nextX;
        } else if (t1 && !t2) {
          if (ry <= SLIDE_THRESHOLD) {
            this.y = Math.max(ty1 * 16, this.y - speed); // Slide Up
            this.x = nextX;
          } else {
            this.x = (tx_target + 1) * 16; // Head-on Snap
          }
        } else if (!t1 && t2) {
          if (ry >= 16 - SLIDE_THRESHOLD) {
            this.y = Math.min(ty2 * 16, this.y + speed); // Slide Down
            this.x = nextX;
          } else {
            this.x = (tx_target + 1) * 16; // Head-on Snap
          }
        } else {
          this.x = (tx_target + 1) * 16; // Solid Wall Snap
        }
      }
    } else if (dir === 'RIGHT') {
      const nextX = this.x + speed;
      const rightX = nextX + 16 - 0.0001;
      const tx_target = Math.floor(rightX / 16);
      const ry = ((this.y % 16) + 16) % 16;

      if (ry === 0) {
        const ty = Math.floor(this.y / 16);
        if (isPassable(tx_target, ty)) {
          this.x = nextX;
        } else {
          this.x = (tx_target - 1) * 16; // Snap right edge flush
        }
      } else {
        const ty1 = Math.floor(this.y / 16);
        const ty2 = ty1 + 1;
        const t1 = isPassable(tx_target, ty1);
        const t2 = isPassable(tx_target, ty2);

        if (t1 && t2) {
          this.x = nextX;
        } else if (t1 && !t2) {
          if (ry <= SLIDE_THRESHOLD) {
            this.y = Math.max(ty1 * 16, this.y - speed); // Slide Up
            this.x = nextX;
          } else {
            this.x = (tx_target - 1) * 16; // Head-on Snap
          }
        } else if (!t1 && t2) {
          if (ry >= 16 - SLIDE_THRESHOLD) {
            this.y = Math.min(ty2 * 16, this.y + speed); // Slide Down
            this.x = nextX;
          } else {
            this.x = (tx_target - 1) * 16; // Head-on Snap
          }
        } else {
          this.x = (tx_target - 1) * 16; // Solid Wall Snap
        }
      }
    }

    const deltaDist = Math.abs(this.x - initialX) + Math.abs(this.y - initialY);
    return deltaDist > 0.0001;
  }
}

/**
 * Factory helper for creating Bomberman entity.
 */
export function createBomberman(initialStats?: Partial<PlayerStats>): IBombermanEntity {
  return new BombermanEntity(initialStats);
}
