import { describe, expect, it } from 'vitest';
import { createBomberman } from '../bomberman/bomberman.engine';
import { createStageGrid } from '../stage-grid/stage-grid.engine';
import { TileType } from '../stage-grid/types';
import { createPowerupEngine } from './powerups.engine';
import {
  MAX_BOMBS_CAP,
  MAX_FLAME_RANGE_CAP,
  MYSTERY_DURATION_MS,
  POWERUP_SCORE_VALUE,
} from './types';

describe('Power-Up System & Stage Exit Door (Specification Contract)', () => {
  describe('Official Power-Up Catalog & Stat Application', () => {
    it('BOMB_UP increments player.stats.maxBombs by 1 up to MAX_BOMBS_CAP (10)', () => {
      const engine = createPowerupEngine();
      const player = createBomberman();
      expect(player.stats.maxBombs).toBe(1);

      engine.applyPowerup('BOMB_UP', player);
      expect(player.stats.maxBombs).toBe(2);

      // Apply 15 more times to test statutory cap of 10
      for (let i = 0; i < 15; i++) {
        engine.applyPowerup('BOMB_UP', player);
      }
      expect(player.stats.maxBombs).toBe(MAX_BOMBS_CAP);
    });

    it('FIRE_UP increments player.stats.flameRange by 1 up to MAX_FLAME_RANGE_CAP (5)', () => {
      const engine = createPowerupEngine();
      const player = createBomberman();
      expect(player.stats.flameRange).toBe(1);

      engine.applyPowerup('FIRE_UP', player);
      expect(player.stats.flameRange).toBe(2);

      // Apply 10 more times to test statutory cap of 5
      for (let i = 0; i < 10; i++) {
        engine.applyPowerup('FIRE_UP', player);
      }
      expect(player.stats.flameRange).toBe(MAX_FLAME_RANGE_CAP);
    });

    it('SPEED_UP sets player.stats.speed to 1.0 and player.stats.hasSpeedUp to true', () => {
      const engine = createPowerupEngine();
      const player = createBomberman();
      expect(player.stats.hasSpeedUp).toBe(false);
      expect(player.stats.speed).toBe(0.75);

      engine.applyPowerup('SPEED_UP', player);
      expect(player.stats.hasSpeedUp).toBe(true);
      expect(player.stats.speed).toBe(1.0);
    });

    it('WALLPASS sets player.stats.wallpass to true, allowing soft block traversal', () => {
      const engine = createPowerupEngine();
      const player = createBomberman();
      expect(player.stats.wallpass).toBe(false);

      engine.applyPowerup('WALLPASS', player);
      expect(player.stats.wallpass).toBe(true);
    });

    it('DETONATOR sets player.stats.hasDetonator to true, enabling manual remote bomb detonation', () => {
      const engine = createPowerupEngine();
      const player = createBomberman();
      expect(player.stats.hasDetonator).toBe(false);

      engine.applyPowerup('DETONATOR', player);
      expect(player.stats.hasDetonator).toBe(true);
    });

    it('BOMBPASS sets player.stats.bombpass to true, allowing traversal through active bombs', () => {
      const engine = createPowerupEngine();
      const player = createBomberman();
      expect(player.stats.bombpass).toBe(false);

      engine.applyPowerup('BOMBPASS', player);
      expect(player.stats.bombpass).toBe(true);
    });

    it('FLAMEPASS sets player.stats.flamepass to true, granting complete bomb blast immunity', () => {
      const engine = createPowerupEngine();
      const player = createBomberman();
      expect(player.stats.flamepass).toBe(false);

      engine.applyPowerup('FLAMEPASS', player);
      expect(player.stats.flamepass).toBe(true);
    });

    it('MYSTERY activates total invulnerability for exactly MYSTERY_DURATION_MS (30000ms)', () => {
      const engine = createPowerupEngine();
      const player = createBomberman();
      expect(player.stats.invincibleTimerMs).toBe(0);
      expect(engine.isMysteryActive).toBe(false);

      engine.applyPowerup('MYSTERY', player);
      expect(player.stats.invincibleTimerMs).toBe(MYSTERY_DURATION_MS);
      expect(engine.mysteryTimerMs).toBe(MYSTERY_DURATION_MS);
      expect(engine.isMysteryActive).toBe(true);
      expect(player.isInvulnerable).toBe(true);
    });
  });

  describe('Stage Distribution Table (Deterministic Level Mapping)', () => {
    const engine = createPowerupEngine();

    it('guarantees Stage 1 provides FIRE_UP', () => {
      expect(engine.getPowerupForStage(1)).toBe('FIRE_UP');
    });

    it('guarantees Stage 2 provides BOMB_UP', () => {
      expect(engine.getPowerupForStage(2)).toBe('BOMB_UP');
    });

    it('guarantees Stage 3 provides DETONATOR', () => {
      expect(engine.getPowerupForStage(3)).toBe('DETONATOR');
    });

    it('guarantees Stage 4 provides SPEED_UP', () => {
      expect(engine.getPowerupForStage(4)).toBe('SPEED_UP');
    });

    it('guarantees Stage 5 provides BOMB_UP', () => {
      expect(engine.getPowerupForStage(5)).toBe('BOMB_UP');
    });

    it('guarantees Stage 6 provides BOMB_UP', () => {
      expect(engine.getPowerupForStage(6)).toBe('BOMB_UP');
    });

    it('guarantees Stage 7 provides FIRE_UP', () => {
      expect(engine.getPowerupForStage(7)).toBe('FIRE_UP');
    });

    it('guarantees Stage 8 provides DETONATOR', () => {
      expect(engine.getPowerupForStage(8)).toBe('DETONATOR');
    });

    it('guarantees Stage 9 provides BOMBPASS', () => {
      expect(engine.getPowerupForStage(9)).toBe('BOMBPASS');
    });

    it('guarantees Stage 10 provides WALLPASS', () => {
      expect(engine.getPowerupForStage(10)).toBe('WALLPASS');
    });

    it('provides authentic canonical power-ups for stages up to 50', () => {
      expect(engine.getPowerupForStage(14)).toBe('BOMB_UP');
      expect(engine.getPowerupForStage(16)).toBe('MYSTERY');
      expect(engine.getPowerupForStage(18)).toBe('BOMBPASS');
      expect(engine.getPowerupForStage(20)).toBe('WALLPASS');
      expect(engine.getPowerupForStage(26)).toBe('MYSTERY');
      expect(engine.getPowerupForStage(30)).toBe('FLAMEPASS');
      expect(engine.getPowerupForStage(36)).toBe('MYSTERY');
      expect(engine.getPowerupForStage(46)).toBe('MYSTERY');
      expect(engine.getPowerupForStage(50)).toBe('MYSTERY');
    });
  });

  describe('Collection Mechanics & Scoring', () => {
    it('awards exactly 1000 points to player.stats.score when collecting POWERUP_REVEALED', () => {
      const engine = createPowerupEngine(1); // Stage 1 -> FIRE_UP
      const grid = createStageGrid();
      const player = createBomberman();

      // Put powerup at player center tile (1, 1)
      grid.setTile(1, 1, TileType.POWERUP_REVEALED);
      player.x = 16.0;
      player.y = 16.0;

      const initialScore = player.stats.score;
      const initialRange = player.stats.flameRange;

      const collected = engine.checkPowerupPickup(player, grid);

      expect(collected).toBe('FIRE_UP');
      expect(player.stats.score).toBe(initialScore + POWERUP_SCORE_VALUE);
      expect(player.stats.flameRange).toBe(initialRange + 1);
    });

    it('clears the tile to TileType.EMPTY after power-up collection', () => {
      const engine = createPowerupEngine(2);
      const grid = createStageGrid();
      const player = createBomberman();

      grid.setTile(1, 1, TileType.POWERUP_REVEALED);
      player.x = 16.0;
      player.y = 16.0;

      engine.checkPowerupPickup(player, grid);
      expect(grid.getTile(1, 1)).toBe(TileType.EMPTY);
    });

    it('ignores collection check when tile is not yet revealed or is already collected', () => {
      const engine = createPowerupEngine(1);
      const grid = createStageGrid();
      const player = createBomberman();

      grid.setTile(1, 1, TileType.SOFT_BLOCK_WITH_POWERUP);
      player.x = 16.0;
      player.y = 16.0;

      const collected1 = engine.checkPowerupPickup(player, grid);
      expect(collected1).toBeNull();

      grid.setTile(1, 1, TileType.EMPTY);
      const collected2 = engine.checkPowerupPickup(player, grid);
      expect(collected2).toBeNull();
    });
  });

  describe('NES Death Persistence Policy (Kept vs Lost Upgrades)', () => {
    it('retains BOMB_UP extra bomb capacity when handlePlayerDeath() is invoked', () => {
      const engine = createPowerupEngine();
      const player = createBomberman();
      player.stats.maxBombs = 4;

      engine.handlePlayerDeath(player);
      expect(player.stats.maxBombs).toBe(4);
    });

    it('retains FIRE_UP extra flame range when handlePlayerDeath() is invoked', () => {
      const engine = createPowerupEngine();
      const player = createBomberman();
      player.stats.flameRange = 3;

      engine.handlePlayerDeath(player);
      expect(player.stats.flameRange).toBe(3);
    });

    it('retains SPEED_UP skate boost when handlePlayerDeath() is invoked', () => {
      const engine = createPowerupEngine();
      const player = createBomberman();
      player.stats.hasSpeedUp = true;
      player.stats.speed = 1.0;

      engine.handlePlayerDeath(player);
      expect(player.stats.hasSpeedUp).toBe(true);
      expect(player.stats.speed).toBe(1.0);
    });

    it('resets DETONATOR (hasDetonator = false) upon player death', () => {
      const engine = createPowerupEngine();
      const player = createBomberman();
      player.stats.hasDetonator = true;

      engine.handlePlayerDeath(player);
      expect(player.stats.hasDetonator).toBe(false);
    });

    it('resets WALLPASS (wallpass = false) upon player death', () => {
      const engine = createPowerupEngine();
      const player = createBomberman();
      player.stats.wallpass = true;

      engine.handlePlayerDeath(player);
      expect(player.stats.wallpass).toBe(false);
    });

    it('resets BOMBPASS (bombpass = false) upon player death', () => {
      const engine = createPowerupEngine();
      const player = createBomberman();
      player.stats.bombpass = true;

      engine.handlePlayerDeath(player);
      expect(player.stats.bombpass).toBe(false);
    });

    it('resets FLAMEPASS (flamepass = false) upon player death', () => {
      const engine = createPowerupEngine();
      const player = createBomberman();
      player.stats.flamepass = true;

      engine.handlePlayerDeath(player);
      expect(player.stats.flamepass).toBe(false);
    });

    it('resets MYSTERY invulnerability timer to 0 upon player death', () => {
      const engine = createPowerupEngine();
      const player = createBomberman();
      engine.applyPowerup('MYSTERY', player);
      expect(engine.isMysteryActive).toBe(true);
      expect(player.stats.invincibleTimerMs).toBe(30000);

      engine.handlePlayerDeath(player);
      expect(engine.isMysteryActive).toBe(false);
      expect(engine.mysteryTimerMs).toBe(0);
      expect(player.stats.invincibleTimerMs).toBe(0);
    });
  });

  describe('Stage Exit Door Mechanics (DOOR_REVEALED)', () => {
    it('clears the stage when player is aligned within <= 3px of DOOR_REVEALED and enemiesRemaining === 0', () => {
      const engine = createPowerupEngine(1);
      const grid = createStageGrid();
      const player = createBomberman();

      const doorCoord = grid.indexToCoord(grid.doorIndex);
      grid.setTile(doorCoord.x, doorCoord.y, TileType.DOOR_REVEALED);

      // Align player to door pixel coordinates within 2px
      player.x = doorCoord.x * 16 + 2.0;
      player.y = doorCoord.y * 16 + 1.0;

      const result = engine.checkDoorEntry(player, grid, 0);
      expect(result).toEqual({
        type: 'STAGE_CLEARED',
        nextStage: 2,
      });
    });

    it('remains inactive and walkable (does NOT trigger stage clear nor penalty wave) when player steps on door while enemiesRemaining > 0', () => {
      const engine = createPowerupEngine(1);
      const grid = createStageGrid();
      const player = createBomberman();

      const doorCoord = grid.indexToCoord(grid.doorIndex);
      grid.setTile(doorCoord.x, doorCoord.y, TileType.DOOR_REVEALED);

      player.x = doorCoord.x * 16;
      player.y = doorCoord.y * 16;

      // 3 enemies still alive on the stage
      const result = engine.checkDoorEntry(player, grid, 3);
      expect(result).toBeNull();
    });

    it('does not clear stage if player is outside 3px threshold of door even if enemiesRemaining === 0', () => {
      const engine = createPowerupEngine(1);
      const grid = createStageGrid();
      const player = createBomberman();

      const doorCoord = grid.indexToCoord(grid.doorIndex);
      grid.setTile(doorCoord.x, doorCoord.y, TileType.DOOR_REVEALED);

      // Player is 6px away from door
      player.x = doorCoord.x * 16 + 6.0;
      player.y = doorCoord.y * 16;

      const result = engine.checkDoorEntry(player, grid, 0);
      expect(result).toBeNull();
    });

    it('does not trigger door action if the door has not been revealed yet', () => {
      const engine = createPowerupEngine(1);
      const grid = createStageGrid();
      const player = createBomberman();

      const doorCoord = grid.indexToCoord(grid.doorIndex);
      // Door is still hidden under SOFT_BLOCK_WITH_DOOR
      expect(grid.getTile(doorCoord.x, doorCoord.y)).toBe(TileType.SOFT_BLOCK_WITH_DOOR);

      player.x = doorCoord.x * 16;
      player.y = doorCoord.y * 16;

      const result = engine.checkDoorEntry(player, grid, 0);
      expect(result).toBeNull();
    });
  });

  describe('Timer Updates & Synchronization', () => {
    it('decrements mysteryTimerMs with deltaMs on update()', () => {
      const engine = createPowerupEngine();
      const player = createBomberman();
      engine.applyPowerup('MYSTERY', player);

      engine.update(1000, player);
      expect(engine.mysteryTimerMs).toBe(29000);

      engine.update(30000, player);
      expect(engine.mysteryTimerMs).toBe(0);
      expect(engine.isMysteryActive).toBe(false);
    });
  });
});
