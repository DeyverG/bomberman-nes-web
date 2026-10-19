import type { IBombermanEntity } from '../bomberman/types';
import { SPEED_UP_SPEED } from '../bomberman/types';
import type { IStageGridEngine } from '../stage-grid/types';
import { TileType } from '../stage-grid/types';
import {
  IPowerupEngine,
  MAX_BOMBS_CAP,
  MAX_FLAME_RANGE_CAP,
  MYSTERY_DURATION_MS,
  POWERUP_SCORE_VALUE,
  PowerupType,
  StageClearResult,
} from './types';

/**
 * Guaranteed canonical power-ups for stages 1 to 10 in NES Bomberman (1985).
 */
export const STAGE_POWERUP_TABLE: Record<number, PowerupType> = {
  1: 'FIRE_UP',
  2: 'BOMB_UP',
  3: 'DETONATOR',
  4: 'SPEED_UP',
  5: 'BOMB_UP',
  6: 'BOMB_UP',
  7: 'FIRE_UP',
  8: 'DETONATOR',
  9: 'BOMB_UP',
  10: 'WALLPASS',
};

/**
 * Modulo sequence for stages > 10.
 */
export const EXTENDED_POWERUP_CYCLE: readonly PowerupType[] = [
  'BOMB_UP',
  'FIRE_UP',
  'DETONATOR',
  'SPEED_UP',
  'BOMBPASS',
  'FLAMEPASS',
  'WALLPASS',
  'MYSTERY',
];

export class PowerupEngine implements IPowerupEngine {
  private _stage: number;
  private _mysteryTimerMs = 0;

  constructor(initialStage = 1) {
    this._stage = Math.max(1, Math.floor(initialStage));
  }

  public get currentStage(): number {
    return this._stage;
  }

  public get mysteryTimerMs(): number {
    return this._mysteryTimerMs;
  }

  public get isMysteryActive(): boolean {
    return this._mysteryTimerMs > 0;
  }

  public advanceStage(): number {
    this._stage += 1;
    return this._stage;
  }

  public getPowerupForStage(stage: number): PowerupType {
    const s = Math.max(1, Math.floor(stage));
    if (s in STAGE_POWERUP_TABLE) {
      return STAGE_POWERUP_TABLE[s];
    }
    const cycleIndex = (s - 11) % EXTENDED_POWERUP_CYCLE.length;
    return EXTENDED_POWERUP_CYCLE[cycleIndex >= 0 ? cycleIndex : 0];
  }

  public applyPowerup(type: PowerupType, player: IBombermanEntity): void {
    switch (type) {
      case 'BOMB_UP':
        player.stats.maxBombs = Math.min(MAX_BOMBS_CAP, player.stats.maxBombs + 1);
        break;
      case 'FIRE_UP':
        player.stats.flameRange = Math.min(MAX_FLAME_RANGE_CAP, player.stats.flameRange + 1);
        break;
      case 'SPEED_UP':
        player.stats.hasSpeedUp = true;
        player.stats.speed = SPEED_UP_SPEED;
        break;
      case 'WALLPASS':
        player.stats.wallpass = true;
        break;
      case 'DETONATOR':
        player.stats.hasDetonator = true;
        break;
      case 'BOMBPASS':
        player.stats.bombpass = true;
        break;
      case 'FLAMEPASS':
        player.stats.flamepass = true;
        break;
      case 'MYSTERY':
        this._mysteryTimerMs = MYSTERY_DURATION_MS;
        player.stats.invincibleTimerMs = MYSTERY_DURATION_MS;
        break;
    }
  }

  public handlePlayerDeath(player: IBombermanEntity): void {
    // Retain permanent upgrades: maxBombs, flameRange, speed, hasSpeedUp
    // Strip temporary equipment
    player.stats.hasDetonator = false;
    player.stats.wallpass = false;
    player.stats.bombpass = false;
    player.stats.flamepass = false;
    player.stats.invincibleTimerMs = 0;
    this._mysteryTimerMs = 0;
  }

  public checkPowerupPickup(player: IBombermanEntity, grid: IStageGridEngine): PowerupType | null {
    const center = player.centerTile;
    if (!grid.isInBounds(center.x, center.y)) return null;

    const tile = grid.getTile(center.x, center.y);
    if (tile !== TileType.POWERUP_REVEALED) {
      return null;
    }

    // Determine power-up type for current stage
    const powerupType = this.getPowerupForStage(this._stage);

    // 1. Consume tile to EMPTY
    grid.setTile(center.x, center.y, TileType.EMPTY);

    // 2. Award 1000 score
    player.stats.score += POWERUP_SCORE_VALUE;

    // 3. Mutate stats
    this.applyPowerup(powerupType, player);

    return powerupType;
  }

  public checkDoorEntry(
    player: IBombermanEntity,
    grid: IStageGridEngine,
    enemiesRemaining: number
  ): StageClearResult {
    // Find revealed door location in grid
    const doorIndex = grid.doorIndex;
    const doorCoord = grid.indexToCoord(doorIndex);

    const tile = grid.getTile(doorCoord.x, doorCoord.y);
    if (tile !== TileType.DOOR_REVEALED) {
      return null;
    }

    // Check spatial alignment threshold: <= 3px in both axes
    const doorPixelX = doorCoord.x * 16;
    const doorPixelY = doorCoord.y * 16;
    const deltaX = Math.abs(player.x - doorPixelX);
    const deltaY = Math.abs(player.y - doorPixelY);

    if (deltaX <= 3 && deltaY <= 3) {
      if (enemiesRemaining === 0) {
        return {
          type: 'STAGE_CLEARED',
          nextStage: this._stage + 1,
        };
      }
      // If enemies remaining > 0, door is inert and walkable (no penalty wave)
      return null;
    }

    return null;
  }

  public update(deltaMs: number, player: IBombermanEntity): void {
    if (this._mysteryTimerMs > 0) {
      this._mysteryTimerMs = Math.max(0, this._mysteryTimerMs - deltaMs);
    }
    // Synchronize with player stats if modified externally
    if (player.stats.invincibleTimerMs !== this._mysteryTimerMs) {
      if (player.stats.invincibleTimerMs <= 0) {
        this._mysteryTimerMs = 0;
      }
    }
  }
}

export function createPowerupEngine(initialStage = 1): IPowerupEngine {
  return new PowerupEngine(initialStage);
}
