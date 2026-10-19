import type { IBombermanEntity } from '../bomberman/types';
import type { IStageGridEngine } from '../stage-grid/types';

/**
 * Core Power-Up Constants for NES Bomberman (1985)
 */
export const POWERUP_SCORE_VALUE = 1000;
export const MYSTERY_DURATION_MS = 30000; // 30.0 seconds invincibility
export const MAX_BOMBS_CAP = 10;
export const MAX_FLAME_RANGE_CAP = 5;

/**
 * Official 8 Power-Up Types in NES Bomberman
 */
export type PowerupType =
  | 'BOMB_UP'
  | 'FIRE_UP'
  | 'SPEED_UP'
  | 'WALLPASS'
  | 'DETONATOR'
  | 'BOMBPASS'
  | 'FLAMEPASS'
  | 'MYSTERY';

/**
 * Result of evaluating entry into a revealed exit door
 */
export type StageClearResult =
  | { readonly type: 'STAGE_CLEARED'; readonly nextStage: number }
  | null;

/**
 * Event emitted upon successful power-up pickup
 */
export interface PowerupCollectedEvent {
  readonly type: PowerupType;
  readonly scoreAwarded: number;
  readonly tile: { readonly x: number; readonly y: number };
}

/**
 * Public interface for Power-Up & Exit Door Engine
 */
export interface IPowerupEngine {
  /**
   * Current active stage number (1-indexed).
   */
  readonly currentStage: number;

  /**
   * Remaining milliseconds of Mystery invincibility.
   */
  readonly mysteryTimerMs: number;

  /**
   * True if Mystery invincibility is currently shielding the player.
   */
  readonly isMysteryActive: boolean;

  /**
   * Advances stage number by 1 and returns the new stage.
   */
  advanceStage(): number;

  /**
   * Returns the canonical guaranteed powerup type for a given stage number.
   */
  getPowerupForStage(stage: number): PowerupType;

  /**
   * Applies power-up effect directly to player stats, respecting caps.
   */
  applyPowerup(type: PowerupType, player: IBombermanEntity): void;

  /**
   * Enforces NES Bomberman death persistence rules:
   * Retains BOMB_UP, FIRE_UP, and SPEED_UP; strips all other upgrades.
   */
  handlePlayerDeath(player: IBombermanEntity): void;

  /**
   * Evaluates if Bomberman is standing on a POWERUP_REVEALED tile.
   * If so, awards 1000 points, applies effect, clears tile, and returns the type.
   */
  checkPowerupPickup(
    player: IBombermanEntity,
    grid: IStageGridEngine
  ): PowerupType | null;

  /**
   * Evaluates if Bomberman has entered the revealed door.
   * Clears the stage if enemiesRemaining === 0, or triggers penalty wave otherwise.
   */
  checkDoorEntry(
    player: IBombermanEntity,
    grid: IStageGridEngine,
    enemiesRemaining: number
  ): StageClearResult;

  /**
   * Advances mystery timer.
   */
  update(deltaMs: number, player: IBombermanEntity): void;
}
