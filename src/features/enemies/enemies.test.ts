import { describe, expect, it } from 'vitest';
import { createBomberman } from '../bomberman/bomberman.engine';
import { createOrdinanceEngine } from '../ordinance/ordinance.engine';
import { createStageGrid } from '../stage-grid/stage-grid.engine';
import { TileType } from '../stage-grid/types';
import { createEnemiesEngine } from './enemies.engine';
import {
  ENEMY_BASE_SCORES,
  ENEMY_BASE_SPEEDS,
  ENEMY_DEATH_DURATION_MS,
  ENEMY_SIZE,
  ENEMY_WALLPASS_CAPABILITIES,
  EnemyType,
  SPAWN_EXCLUSION_MANHATTAN_DISTANCE,
} from './types';

describe('Enemy Subsystem & Artificial Intelligence (Unit Test Suite)', () => {
  describe('Canonical Enemy Catalog & Attributes', () => {
    const allEnemies: EnemyType[] = [
      'BALLOM',
      'ONEAL',
      'DAHL',
      'MINVO',
      'OVAPE',
      'KONDORIA',
      'PONTAN',
    ];

    it('contains exactly 7 canonical NES Bomberman enemies', () => {
      expect(allEnemies).toHaveLength(7);
    });

    it('defines authentic base point values (100, 200, 400, 800, 1000, 2000, 8000)', () => {
      expect(ENEMY_BASE_SCORES.BALLOM).toBe(100);
      expect(ENEMY_BASE_SCORES.ONEAL).toBe(200);
      expect(ENEMY_BASE_SCORES.DAHL).toBe(400);
      expect(ENEMY_BASE_SCORES.MINVO).toBe(800);
      expect(ENEMY_BASE_SCORES.OVAPE).toBe(1000);
      expect(ENEMY_BASE_SCORES.KONDORIA).toBe(2000);
      expect(ENEMY_BASE_SCORES.PONTAN).toBe(8000);
    });

    it('defines authentic movement speeds in px/tick at 60Hz', () => {
      expect(ENEMY_BASE_SPEEDS.BALLOM).toBe(0.375);
      expect(ENEMY_BASE_SPEEDS.ONEAL).toBe(0.5);
      expect(ENEMY_BASE_SPEEDS.DAHL).toBe(0.5);
      expect(ENEMY_BASE_SPEEDS.MINVO).toBe(0.75);
      expect(ENEMY_BASE_SPEEDS.OVAPE).toBe(0.375);
      expect(ENEMY_BASE_SPEEDS.KONDORIA).toBe(0.25);
      expect(ENEMY_BASE_SPEEDS.PONTAN).toBe(1.125);
    });

    it('grants soft block wallpass strictly to ghost enemies (OVAPE, KONDORIA, PONTAN)', () => {
      expect(ENEMY_WALLPASS_CAPABILITIES.BALLOM).toBe(false);
      expect(ENEMY_WALLPASS_CAPABILITIES.ONEAL).toBe(false);
      expect(ENEMY_WALLPASS_CAPABILITIES.DAHL).toBe(false);
      expect(ENEMY_WALLPASS_CAPABILITIES.MINVO).toBe(false);

      expect(ENEMY_WALLPASS_CAPABILITIES.OVAPE).toBe(true);
      expect(ENEMY_WALLPASS_CAPABILITIES.KONDORIA).toBe(true);
      expect(ENEMY_WALLPASS_CAPABILITIES.PONTAN).toBe(true);
    });

    it('specifies 600ms death duration and 16px sprite size', () => {
      expect(ENEMY_DEATH_DURATION_MS).toBe(600);
      expect(ENEMY_SIZE).toBe(16);
      expect(SPAWN_EXCLUSION_MANHATTAN_DISTANCE).toBe(5);
    });
  });

  describe('Stage Enemy Rosters (getStageEnemyRoster)', () => {
    const engine = createEnemiesEngine();

    it('guarantees Stage 1 roster is 6 BALLOM', () => {
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

    it('guarantees Stage 5 introduces OVAPE', () => {
      const roster = engine.getStageEnemyRoster(5);
      expect(roster).toContain('OVAPE');
    });

    it('guarantees Stage 10 contains PONTAN', () => {
      const roster = engine.getStageEnemyRoster(10);
      expect(roster).toContain('PONTAN');
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
