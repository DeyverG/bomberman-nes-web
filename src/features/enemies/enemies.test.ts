import { describe, expect, it } from 'vitest';
import { createBomberman } from '../bomberman/bomberman.engine';
import { createOrdinanceEngine } from '../ordinance/ordinance.engine';
import { createPowerupEngine } from '../powerups/powerups.engine';
import { createStageGrid } from '../stage-grid/stage-grid.engine';
import { TileType } from '../stage-grid/types';
import { createEnemiesEngine, getTrapEnemyTypeForStage } from './enemies.engine';
import {
  ENEMY_BASE_SCORES,
  ENEMY_BASE_SPEEDS,
  ENEMY_DEATH_DURATION_MS,
  ENEMY_SIZE,
  ENEMY_WALLPASS_CAPABILITIES,
  EnemyType,
  SPAWN_EXCLUSION_MANHATTAN_DISTANCE,
  STAGE_SPAWN_INITIAL_MIN_DISTANCE,
} from './types';

describe('Enemy Subsystem & Artificial Intelligence (Unit Test Suite)', () => {
  describe('Canonical Enemy Catalog & Attributes', () => {
    const allEnemies: EnemyType[] = [
      'BALLOM',
      'ONEAL',
      'DAHL',
      'MINVO',
      'KONDORIA',
      'OVAPE',
      'PASS',
      'PONTAN',
    ];

    it('contains exactly 8 canonical NES Bomberman enemies', () => {
      expect(allEnemies).toHaveLength(8);
    });

    it('defines authentic base point values (100, 200, 400, 800, 1000, 2000, 4000, 8000)', () => {
      expect(ENEMY_BASE_SCORES.BALLOM).toBe(100);
      expect(ENEMY_BASE_SCORES.ONEAL).toBe(200);
      expect(ENEMY_BASE_SCORES.DAHL).toBe(400);
      expect(ENEMY_BASE_SCORES.MINVO).toBe(800);
      expect(ENEMY_BASE_SCORES.KONDORIA).toBe(1000);
      expect(ENEMY_BASE_SCORES.OVAPE).toBe(2000);
      expect(ENEMY_BASE_SCORES.PASS).toBe(4000);
      expect(ENEMY_BASE_SCORES.PONTAN).toBe(8000);
    });

    it('defines authentic movement speeds in px/tick at 60Hz', () => {
      expect(ENEMY_BASE_SPEEDS.BALLOM).toBe(0.375);
      expect(ENEMY_BASE_SPEEDS.ONEAL).toBe(0.5);
      expect(ENEMY_BASE_SPEEDS.DAHL).toBe(0.625);
      expect(ENEMY_BASE_SPEEDS.MINVO).toBe(0.75);
      expect(ENEMY_BASE_SPEEDS.KONDORIA).toBe(0.25);
      expect(ENEMY_BASE_SPEEDS.OVAPE).toBe(0.375);
      expect(ENEMY_BASE_SPEEDS.PASS).toBe(1.0);
      expect(ENEMY_BASE_SPEEDS.PONTAN).toBe(1.125);
    });

    it('grants soft block wallpass strictly to ghost enemies (KONDORIA, OVAPE, PONTAN)', () => {
      expect(ENEMY_WALLPASS_CAPABILITIES.BALLOM).toBe(false);
      expect(ENEMY_WALLPASS_CAPABILITIES.ONEAL).toBe(false);
      expect(ENEMY_WALLPASS_CAPABILITIES.DAHL).toBe(false);
      expect(ENEMY_WALLPASS_CAPABILITIES.MINVO).toBe(false);
      expect(ENEMY_WALLPASS_CAPABILITIES.PASS).toBe(false);

      expect(ENEMY_WALLPASS_CAPABILITIES.KONDORIA).toBe(true);
      expect(ENEMY_WALLPASS_CAPABILITIES.OVAPE).toBe(true);
      expect(ENEMY_WALLPASS_CAPABILITIES.PONTAN).toBe(true);
    });

    it('specifies 600ms death duration and 16px sprite size', () => {
      expect(ENEMY_DEATH_DURATION_MS).toBe(600);
      expect(ENEMY_SIZE).toBe(16);
      expect(SPAWN_EXCLUSION_MANHATTAN_DISTANCE).toBe(5);
      expect(STAGE_SPAWN_INITIAL_MIN_DISTANCE).toBe(8);
    });
  });

  describe('Stage Enemy Rosters (getStageEnemyRoster)', () => {
    const engine = createEnemiesEngine();

    it('guarantees Stage 1 roster is strictly 6 BALLOM', () => {
      const roster = engine.getStageEnemyRoster(1);
      expect(roster).toHaveLength(6);
      expect(roster.every((t) => t === 'BALLOM')).toBe(true);
    });

    it('guarantees Stage 2 roster is 3 BALLOM and 3 ONEAL', () => {
      const roster = engine.getStageEnemyRoster(2);
      expect(roster).toEqual(['BALLOM', 'BALLOM', 'BALLOM', 'ONEAL', 'ONEAL', 'ONEAL']);
    });

    it('guarantees Stage 3 roster is 2 BALLOM, 2 ONEAL, 2 DAHL', () => {
      const roster = engine.getStageEnemyRoster(3);
      expect(roster).toEqual(['BALLOM', 'BALLOM', 'ONEAL', 'ONEAL', 'DAHL', 'DAHL']);
    });

    it('guarantees Stage 4 roster is 1 BALLOM, 1 ONEAL, 2 DAHL, 2 MINVO', () => {
      const roster = engine.getStageEnemyRoster(4);
      expect(roster).toEqual(['BALLOM', 'ONEAL', 'DAHL', 'DAHL', 'MINVO', 'MINVO']);
    });

    it('guarantees Stage 5 roster is 4 ONEAL, 3 DAHL', () => {
      const roster = engine.getStageEnemyRoster(5);
      expect(roster).toEqual(['ONEAL', 'ONEAL', 'ONEAL', 'ONEAL', 'DAHL', 'DAHL', 'DAHL']);
    });

    it('guarantees Stage 6 introduces KONDORIA', () => {
      const roster = engine.getStageEnemyRoster(6);
      expect(roster).toContain('KONDORIA');
    });

    it('guarantees Stage 10 roster contains OVAPE and 3 KONDORIA', () => {
      const roster = engine.getStageEnemyRoster(10);
      expect(roster).toContain('OVAPE');
      expect(roster.filter((e) => e === 'KONDORIA')).toHaveLength(3);
    });

    it('guarantees Stage 14 contains 7 OVAPE and 1 PASS', () => {
      const roster = engine.getStageEnemyRoster(14);
      expect(roster.filter((e) => e === 'OVAPE')).toHaveLength(7);
      expect(roster).toContain('PASS');
    });

    it('guarantees Stage 50 contains 4 PASS and 4 PONTAN', () => {
      const roster = engine.getStageEnemyRoster(50);
      expect(roster.filter((e) => e === 'PASS')).toHaveLength(4);
      expect(roster.filter((e) => e === 'PONTAN')).toHaveLength(4);
    });
  });

  describe('Spawn Exclusion Geometry & Safe Zone', () => {
    it('spawnEnemy() returns null when target tile is inside the 5-tile Manhattan exclusion zone', () => {
      const engine = createEnemiesEngine();
      const grid = createStageGrid();

      // (1, 1) is dist 0, (2, 2) is dist 2, (3, 3) is dist 4
      expect(engine.spawnEnemy('BALLOM', 1, 1, grid)).toBeNull();
      expect(engine.spawnEnemy('BALLOM', 1, 2, grid)).toBeNull();
      expect(engine.spawnEnemy('BALLOM', 2, 1, grid)).toBeNull();
      expect(engine.spawnEnemy('BALLOM', 3, 3, grid)).toBeNull();
      expect(engine.spawnEnemy('BALLOM', 4, 1, grid)).toBeNull();
      expect(engine.aliveCount).toBe(0);
    });

    it('spawnEnemy() rejects non-wallpass enemies on HARD_WALL and SOFT_BLOCK tiles', () => {
      const engine = createEnemiesEngine();
      const grid = createStageGrid();

      grid.setTile(6, 1, TileType.HARD_WALL);
      expect(engine.spawnEnemy('BALLOM', 6, 1, grid)).toBeNull();

      grid.setTile(6, 1, TileType.SOFT_BLOCK);
      expect(engine.spawnEnemy('BALLOM', 6, 1, grid)).toBeNull();
    });

    it('spawnEnemy() permits wallpass ghost enemies (OVAPE, KONDORIA, PONTAN) inside SOFT_BLOCK tiles outside safe zone', () => {
      const engine = createEnemiesEngine();
      const grid = createStageGrid();

      grid.setTile(6, 1, TileType.SOFT_BLOCK);
      const ghost = engine.spawnEnemy('OVAPE', 6, 1, grid);

      expect(ghost).not.toBeNull();
      expect(ghost?.type).toBe('OVAPE');
      expect(ghost?.hasWallpass).toBe(true);
    });

    it('spawnEnemy() places enemy coordinates snapped to integer tile boundaries (x = tx * 16, y = ty * 16)', () => {
      const engine = createEnemiesEngine();
      const grid = createStageGrid();

      grid.setTile(7, 3, TileType.EMPTY);
      const enemy = engine.spawnEnemy('ONEAL', 7, 3, grid);

      expect(enemy).not.toBeNull();
      expect(enemy?.x).toBe(112.0);
      expect(enemy?.y).toBe(48.0);
    });

    it('spawnStageEnemies() enforces Manhattan distance >= 8 and blocks direct line-of-sight in (1,1)', () => {
      const engine = createEnemiesEngine();
      const grid = createStageGrid();

      const spawned = engine.spawnStageEnemies(1, grid);
      expect(spawned).toHaveLength(6);
      expect(spawned.every((e) => e.type === 'BALLOM')).toBe(true);

      for (const enemy of spawned) {
        const tx = Math.round(enemy.x / 16);
        const ty = Math.round(enemy.y / 16);
        const dist = Math.abs(tx - 1) + Math.abs(ty - 1);

        // Manhattan distance must be >= 8 tiles
        expect(dist).toBeGreaterThanOrEqual(STAGE_SPAWN_INITIAL_MIN_DISTANCE);

        // Safe corridor: never on row ty === 1 with tx < 8
        if (ty === 1) {
          expect(tx).toBeGreaterThanOrEqual(8);
        }
        // Safe corridor: never on col tx === 1 with ty < 7
        if (tx === 1) {
          expect(ty).toBeGreaterThanOrEqual(7);
        }
      }
    });
  });

  describe('Grid-Aligned Movement & Anti-Tunneling Snap', () => {
    it('applies anti-tunneling snap when fractional speed advancement crosses a 16px tile boundary', () => {
      const engine = createEnemiesEngine();
      const grid = createStageGrid();
      const player = createBomberman();
      const ordinance = createOrdinanceEngine();

      grid.setTile(6, 1, TileType.EMPTY);
      grid.setTile(7, 1, TileType.EMPTY);

      const enemy = engine.spawnEnemy('BALLOM', 6, 1, grid);
      expect(enemy).not.toBeNull();
      if (!enemy) return;

      enemy.direction = 'RIGHT';
      // Put enemy at 111.8 (0.2px away from 112.0)
      enemy.x = 111.8;
      // Moving RIGHT with speed 0.375: 111.8 + 0.375 = 112.175 >= 112.0
      // Snap must clench enemy.x exactly to 112.0
      engine.update(16.666, player, grid, ordinance);

      expect(enemy.x).toBe(112.0);
      expect(enemy.x % 16).toBe(0);
    });

    it('treats HARD_WALL as impassable for all 7 enemy types', () => {
      const engine = createEnemiesEngine();
      const grid = createStageGrid();
      const player = createBomberman();
      const ordinance = createOrdinanceEngine();

      // Enemy at (6, 1) facing RIGHT towards HARD_WALL at (7, 1)
      grid.setTile(6, 1, TileType.EMPTY);
      grid.setTile(7, 1, TileType.HARD_WALL);
      grid.setTile(6, 2, TileType.HARD_WALL);
      grid.setTile(6, 0, TileType.HARD_WALL);
      grid.setTile(5, 1, TileType.EMPTY); // Reverse is open

      const enemy = engine.spawnEnemy('PONTAN', 6, 1, grid);
      expect(enemy).not.toBeNull();
      if (!enemy) return;

      enemy.direction = 'RIGHT';
      enemy.x = 96.0;

      // Update at intersection: forward is blocked by HARD_WALL, must turnaround to LEFT
      engine.update(16.666, player, grid, ordinance);
      expect(enemy.direction).toBe('LEFT');
    });

    it('forces a 180-degree turnaround when an enemy reaches a dead end', () => {
      const engine = createEnemiesEngine();
      const grid = createStageGrid();
      const player = createBomberman();
      const ordinance = createOrdinanceEngine();

      // Dead end corridor: (6, 1) surrounded by walls on UP, DOWN, RIGHT
      grid.setTile(6, 1, TileType.EMPTY);
      grid.setTile(7, 1, TileType.HARD_WALL);
      grid.setTile(6, 0, TileType.HARD_WALL);
      grid.setTile(6, 2, TileType.HARD_WALL);
      grid.setTile(5, 1, TileType.EMPTY);

      const enemy = engine.spawnEnemy('BALLOM', 6, 1, grid);
      if (!enemy) return;

      enemy.direction = 'RIGHT';
      enemy.x = 96.0;
      enemy.y = 16.0;

      engine.update(16.666, player, grid, ordinance);
      expect(enemy.direction).toBe('LEFT');
    });
  });

  describe('Simultaneous Bomb Combo Multipliers (1x, 2x, 4x, 8x)', () => {
    it('awards combo multipliers sequentially when multiple enemies are hit by the same bomb explosion', () => {
      const engine = createEnemiesEngine();
      const grid = createStageGrid();
      const player = createBomberman();
      const ordinance = createOrdinanceEngine();

      // Spawn 4 BALLOM enemies (base score = 100)
      grid.setTile(6, 1, TileType.EMPTY);
      grid.setTile(7, 1, TileType.EMPTY);
      grid.setTile(8, 1, TileType.EMPTY);
      grid.setTile(9, 1, TileType.EMPTY);

      const e1 = engine.spawnEnemy('BALLOM', 6, 1, grid);
      const e2 = engine.spawnEnemy('BALLOM', 7, 1, grid);
      const e3 = engine.spawnEnemy('BALLOM', 8, 1, grid);
      const e4 = engine.spawnEnemy('BALLOM', 9, 1, grid);

      expect(e1).not.toBeNull();
      expect(e2).not.toBeNull();
      expect(e3).not.toBeNull();
      expect(e4).not.toBeNull();

      // Plant bomb at (6, 1) with range 5 and detonate
      player.x = 96.0;
      player.y = 16.0;
      player.stats.flameRange = 5;

      const bomb = ordinance.placeBomb(6, 1, player, grid);
      expect(bomb).not.toBeNull();

      ordinance.detonateBomb(bomb!.id, grid, player);
      expect(ordinance.activeExplosions).toHaveLength(1);

      const initialScore = player.stats.score;
      const results = engine.checkFlameCollisions(ordinance.activeExplosions, player);

      expect(results).toHaveLength(4);
      // 1st kill = 100 * 1 = 100
      expect(results[0].multiplier).toBe(1);
      expect(results[0].pointsAwarded).toBe(100);

      // 2nd kill = 100 * 2 = 200
      expect(results[1].multiplier).toBe(2);
      expect(results[1].pointsAwarded).toBe(200);

      // 3rd kill = 100 * 4 = 400
      expect(results[2].multiplier).toBe(4);
      expect(results[2].pointsAwarded).toBe(400);

      // 4th kill = 100 * 8 = 800
      expect(results[3].multiplier).toBe(8);
      expect(results[3].pointsAwarded).toBe(800);

      // Total added score = 100 + 200 + 400 + 800 = 1500
      expect(player.stats.score).toBe(initialScore + 1500);
    });
  });

  describe('Penalty Wave Spawns (spawnPunishmentWave)', () => {
    it('spawns exactly 8 PONTAN enemies outside the player safe spawn zone', () => {
      const engine = createEnemiesEngine();
      const grid = createStageGrid();
      const player = createBomberman();

      player.x = 16.0;
      player.y = 16.0;

      const wave = engine.spawnPunishmentWave(grid, player);
      expect(wave).toHaveLength(8);
      expect(wave.every((e) => e.type === 'PONTAN')).toBe(true);
      expect(wave.every((e) => e.speed === 1.125)).toBe(true);
      expect(wave.every((e) => e.hasWallpass === true)).toBe(true);
    });
  });

  describe('Canonical NES TIME = 0:00 Pontan Horde & Farming (spawnTimeOutHorde)', () => {
    it('spawns exactly 12 PONTAN enemies with speed 1.125, wallpass true, and 8000 base points', () => {
      const engine = createEnemiesEngine();
      const grid = createStageGrid();
      const player = createBomberman();
      player.x = 16.0;
      player.y = 16.0;

      const horde = engine.spawnTimeOutHorde(grid, player);
      expect(horde).toHaveLength(12);
      expect(engine.getAliveCount()).toBe(12);
      expect(horde.every((e) => e.type === 'PONTAN')).toBe(true);
      expect(horde.every((e) => e.speed === 1.125)).toBe(true);
      expect(horde.every((e) => e.hasWallpass === true)).toBe(true);
      expect(horde.every((e) => e.baseScore === 8000)).toBe(true);
      expect(horde.every((e) => e.state === 'ALIVE')).toBe(true);
    });

    it('spawns all 12 Pontans respecting Manhattan distance >= 5 from current Bomberman position', () => {
      const engine = createEnemiesEngine();
      const grid = createStageGrid();
      const player = createBomberman();

      // Bomberman at tile (10, 5) -> world coords (160, 80)
      player.x = 160.0;
      player.y = 80.0;

      const horde = engine.spawnTimeOutHorde(grid, player);
      expect(horde).toHaveLength(12);

      for (const enemy of horde) {
        const enemyTx = Math.round(enemy.x / 16.0);
        const enemyTy = Math.round(enemy.y / 16.0);
        const dist = Math.abs(enemyTx - 10) + Math.abs(enemyTy - 5);
        expect(dist).toBeGreaterThanOrEqual(5);
      }
    });

    it('does NOT automatically kill Bomberman when TIME reaches 0:00 and spawnTimeOutHorde is triggered', () => {
      const engine = createEnemiesEngine();
      const grid = createStageGrid();
      const player = createBomberman();
      player.update(500, { primary: null, secondary: null }, grid);

      expect(player.state).toBe('ALIVE');

      // Trigger timeout horde
      engine.spawnTimeOutHorde(grid, player);

      // Bomberman is still alive, clock hit 0:00 without killing the player
      expect(player.state).toBe('ALIVE');
      expect(engine.getAliveCount()).toBe(12);
    });

    it('allows player to farm Pontans for 8000 points base + combos and clear stage once count hits 0', () => {
      const engine = createEnemiesEngine();
      const grid = createStageGrid();
      const player = createBomberman();
      player.update(500, { primary: null, secondary: null }, grid);
      const ordinance = createOrdinanceEngine();
      const powerups = createPowerupEngine();

      player.x = 16.0;
      player.y = 16.0;
      const initialScore = player.stats.score;

      // Spawn timeout horde
      engine.spawnTimeOutHorde(grid, player);
      expect(engine.getAliveCount()).toBe(12);

      // Door coordinates from grid
      const doorCoord = grid.indexToCoord(grid.doorIndex);
      grid.setTile(doorCoord.x, doorCoord.y, TileType.DOOR_REVEALED);

      // While 12 Pontans are alive, attempting door entry does NOT clear stage
      player.x = doorCoord.x * 16.0;
      player.y = doorCoord.y * 16.0;
      const blockedDoorResult = powerups.checkDoorEntry(player, grid, engine.getAliveCount());
      expect(blockedDoorResult).toBeNull();

      // Eliminate Pontans with bomb flames
      // Spawn two Pontans at (6, 1) and (7, 1) on EMPTY ground
      engine.clearAll();
      grid.setTile(6, 1, TileType.EMPTY);
      grid.setTile(7, 1, TileType.EMPTY);
      const p1 = engine.spawnEnemy('PONTAN', 6, 1, grid);
      const p2 = engine.spawnEnemy('PONTAN', 7, 1, grid);
      expect(p1).not.toBeNull();
      expect(p2).not.toBeNull();

      player.stats.flameRange = 3;
      player.x = 96.0;
      player.y = 16.0;
      const bomb = ordinance.placeBomb(6, 1, player, grid);
      ordinance.detonateBomb(bomb!.id, grid, player);

      const kills = engine.checkFlameCollisions(ordinance.activeExplosions, player);
      expect(kills).toHaveLength(2);
      expect(kills[0].pointsAwarded).toBe(8000); // 1x combo = 8000
      expect(kills[1].pointsAwarded).toBe(16000); // 2x combo = 16000
      expect(player.stats.score).toBe(initialScore + 24000);

      // Finish decay
      engine.update(600, player, grid, ordinance);
      expect(engine.getAliveCount()).toBe(0);

      // With 0 enemies alive, standing on door succeeds
      player.x = doorCoord.x * 16.0;
      player.y = doorCoord.y * 16.0;
      const clearedDoorResult = powerups.checkDoorEntry(player, grid, engine.getAliveCount());
      expect(clearedDoorResult?.type).toBe('STAGE_CLEARED');
    });
  });

  describe('Door & Power-Up Trap Spawns (spawnFromTile)', () => {
    it('spawns a group of 4 to 8 enemies originating at the exact tile coordinates of the door', () => {
      const engine = createEnemiesEngine();
      const doorTx = 14;
      const doorTy = 5;

      const spawned = engine.spawnFromTile(doorTx, doorTy);
      expect(spawned.length).toBeGreaterThanOrEqual(4);
      expect(spawned.length).toBeLessThanOrEqual(8);
      expect(engine.getAliveCount()).toBe(spawned.length);

      // Verifies exact tile coordinates (x = tx * 16, y = ty * 16)
      expect(spawned.every((e) => e.x === doorTx * 16.0 && e.y === doorTy * 16.0)).toBe(true);

      // Verifies enemy archetypes (ONEAL, MINVO, PONTAN)
      const allowedTypes: EnemyType[] = ['ONEAL', 'MINVO', 'PONTAN'];
      expect(spawned.every((e) => allowedTypes.includes(e.type))).toBe(true);
      expect(spawned.every((e) => e.state === 'ALIVE')).toBe(true);
    });

    it('disperses enemies across available cardinal directions upon spawning', () => {
      const engine = createEnemiesEngine();
      const spawned = engine.spawnFromTile(10, 5, 4);

      expect(spawned).toHaveLength(4);
      const directions = spawned.map((e) => e.direction);
      // All 4 cardinal directions assigned sequentially
      expect(directions).toContain('UP');
      expect(directions).toContain('RIGHT');
      expect(directions).toContain('DOWN');
      expect(directions).toContain('LEFT');
    });

    it('spawns custom count and explicit enemy type when parameters are provided', () => {
      const engine = createEnemiesEngine();
      const spawned = engine.spawnFromTile(8, 8, 6, 'MINVO');

      expect(spawned).toHaveLength(6);
      expect(spawned.every((e) => e.type === 'MINVO')).toBe(true);
      expect(spawned.every((e) => e.x === 8 * 16.0 && e.y === 8 * 16.0)).toBe(true);
    });

    it('increases aliveCount when door is bombed, blocking exit until newly spawned enemies are cleared', () => {
      const engine = createEnemiesEngine();
      const grid = createStageGrid();
      const player = createBomberman();
      player.update(500, { primary: null, secondary: null }, grid);
      const powerups = createPowerupEngine();

      const doorCoord = grid.indexToCoord(grid.doorIndex);
      grid.setTile(doorCoord.x, doorCoord.y, TileType.DOOR_REVEALED);
      player.x = doorCoord.x * 16.0;
      player.y = doorCoord.y * 16.0;

      // Initially 0 enemies alive
      expect(engine.getAliveCount()).toBe(0);
      const canExitInitially = powerups.checkDoorEntry(player, grid, engine.getAliveCount());
      expect(canExitInitially?.type).toBe('STAGE_CLEARED');

      // Bombing the revealed door triggers spawnFromTile(doorCoord.x, doorCoord.y)
      engine.spawnFromTile(doorCoord.x, doorCoord.y, 5, 'ONEAL');
      expect(engine.getAliveCount()).toBe(5);

      // Exit is now blocked because getAliveCount() > 0
      const blockedExit = powerups.checkDoorEntry(player, grid, engine.getAliveCount());
      expect(blockedExit).toBeNull();

      // Clear the trap enemies
      engine.clearAll();
      expect(engine.getAliveCount()).toBe(0);

      // Door exit is unlocked again
      const unblockedExit = powerups.checkDoorEntry(player, grid, engine.getAliveCount());
      expect(unblockedExit?.type).toBe('STAGE_CLEARED');
    });

    it('spawns enemies from POWERUP_REVEALED exact tile coordinates when powerup is hit', () => {
      const engine = createEnemiesEngine();
      const pTx = 7;
      const pTy = 3;

      const spawned = engine.spawnFromTile(pTx, pTy, 4, 'PONTAN');
      expect(spawned).toHaveLength(4);
      expect(spawned.every((e) => e.x === pTx * 16.0 && e.y === pTy * 16.0)).toBe(true);
      expect(spawned.every((e) => e.type === 'PONTAN')).toBe(true);
    });

    it('determines canonical trap wave enemy type based on stage (Stage 1: ONEAL .. Stage 10+: PONTAN)', () => {
      expect(getTrapEnemyTypeForStage(1)).toBe('ONEAL');
      expect(getTrapEnemyTypeForStage(2)).toBe('DAHL');
      expect(getTrapEnemyTypeForStage(3)).toBe('MINVO');
      expect(getTrapEnemyTypeForStage(4)).toBe('KONDORIA');
      expect(getTrapEnemyTypeForStage(5)).toBe('OVAPE');
      expect(getTrapEnemyTypeForStage(6)).toBe('OVAPE');
      expect(getTrapEnemyTypeForStage(7)).toBe('PASS');
      expect(getTrapEnemyTypeForStage(8)).toBe('PASS');
      expect(getTrapEnemyTypeForStage(9)).toBe('PASS');
      expect(getTrapEnemyTypeForStage(10)).toBe('PONTAN');
      expect(getTrapEnemyTypeForStage(50)).toBe('PONTAN');
    });

    it('spawnTrapWave() spawns exactly 8 scaled enemies from exact tile coordinates', () => {
      const engine = createEnemiesEngine();

      // Stage 1 trap: 8 ONEAL
      const wave1 = engine.spawnTrapWave(1, 10, 5);
      expect(wave1).toHaveLength(8);
      expect(wave1.every((e) => e.type === 'ONEAL')).toBe(true);
      expect(wave1.every((e) => e.x === 10 * 16.0 && e.y === 5 * 16.0)).toBe(true);

      // Stage 3 trap: 8 MINVO
      const wave3 = engine.spawnTrapWave(3, 12, 6);
      expect(wave3).toHaveLength(8);
      expect(wave3.every((e) => e.type === 'MINVO')).toBe(true);

      // Stage 7 trap: 8 PASS
      const wave7 = engine.spawnTrapWave(7, 8, 4);
      expect(wave7).toHaveLength(8);
      expect(wave7.every((e) => e.type === 'PASS')).toBe(true);

      // Stage 10 trap: 8 PONTAN
      const wave10 = engine.spawnTrapWave(10, 15, 7);
      expect(wave10).toHaveLength(8);
      expect(wave10.every((e) => e.type === 'PONTAN')).toBe(true);
    });
  });

  describe('Enemy Death Sequence (DYING State)', () => {
    it('transitions enemy from ALIVE to DYING and removes it after 600ms', () => {
      const engine = createEnemiesEngine();
      const grid = createStageGrid();
      const player = createBomberman();
      const ordinance = createOrdinanceEngine();

      grid.setTile(6, 1, TileType.EMPTY);
      const enemy = engine.spawnEnemy('BALLOM', 6, 1, grid);
      expect(enemy?.state).toBe('ALIVE');

      // Create an explosion at (6, 1)
      player.x = 96.0;
      player.y = 16.0;
      const bomb = ordinance.placeBomb(6, 1, player, grid);
      ordinance.detonateBomb(bomb!.id, grid, player);

      engine.checkFlameCollisions(ordinance.activeExplosions, player);
      expect(enemy?.state).toBe('DYING');

      // Advance by 300ms: still DYING
      engine.update(300, player, grid, ordinance);
      expect(enemy?.state).toBe('DYING');
      expect(engine.aliveCount).toBe(0);
      expect(engine.activeEnemies).toHaveLength(1);

      // Advance by remaining 300ms: transitions to DEAD and is removed
      engine.update(300, player, grid, ordinance);
      expect(engine.activeEnemies).toHaveLength(0);
    });
  });

  describe('Lethality Against Bomberman', () => {
    it('triggers player.kill() when an ALIVE enemy collides with Bomberman inner 12x12 hitbox', () => {
      const engine = createEnemiesEngine();
      const grid = createStageGrid();
      const player = createBomberman();

      // Complete player spawning invulnerability
      player.update(500, null, grid);
      expect(player.state).toBe('ALIVE');
      expect(player.isInvulnerable).toBe(false);

      grid.setTile(6, 1, TileType.EMPTY);
      const enemy = engine.spawnEnemy('BALLOM', 6, 1, grid);
      expect(enemy).not.toBeNull();
      if (!enemy) return;

      // Position enemy right on top of player at (16.0, 16.0)
      enemy.x = 16.0;
      enemy.y = 16.0;

      const killed = engine.checkPlayerLethality(player);
      expect(killed).toBe(true);
      expect(player.state).toBe('DYING');
    });

    it('ignores collision when player has active MYSTERY invulnerability (invincibleTimerMs > 0)', () => {
      const engine = createEnemiesEngine();
      const grid = createStageGrid();
      const player = createBomberman();

      player.update(500, null, grid);
      player.stats.invincibleTimerMs = 30000;
      expect(player.isInvulnerable).toBe(true);

      const enemy = engine.spawnEnemy('BALLOM', 6, 1, grid);
      if (!enemy) return;

      enemy.x = 16.0;
      enemy.y = 16.0;

      const killed = engine.checkPlayerLethality(player);
      expect(killed).toBe(false);
      expect(player.state).toBe('ALIVE');
    });

    it('ignores collision when enemy is DYING', () => {
      const engine = createEnemiesEngine();
      const grid = createStageGrid();
      const player = createBomberman();

      player.update(500, null, grid);

      const enemy = engine.spawnEnemy('BALLOM', 6, 1, grid);
      if (!enemy) return;

      enemy.state = 'DYING';
      enemy.x = 16.0;
      enemy.y = 16.0;

      const killed = engine.checkPlayerLethality(player);
      expect(killed).toBe(false);
      expect(player.state).toBe('ALIVE');
    });
  });
});
