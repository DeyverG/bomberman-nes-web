import { describe, it, expect } from 'vitest';
import { createStageGrid } from '../stage-grid';
import { BombermanEntity, isTilePassableForPlayer } from './bomberman.engine';
import { TileType } from '../stage-grid/types';

describe('Bomberman Player Entity & Corner-Sliding (Unit Test Verification)', () => {
  describe('Spawn & Coordinate Conventions', () => {
    it('spawns at exact top-left world coordinate (16.0, 16.0) corresponding to tile (1, 1)', () => {
      const player = new BombermanEntity();
      expect(player.x).toBe(16.0);
      expect(player.y).toBe(16.0);
      expect(player.centerTile).toEqual({ x: 1, y: 1 });
    });

    it('initializes in SPAWNING state with temporary invulnerability', () => {
      const player = new BombermanEntity();
      expect(player.state).toBe('SPAWNING');
      expect(player.isInvulnerable).toBe(true);
    });

    it('initializes stats with default values: 3 lives, base speed 1.0, 1 bomb, 1 flame range', () => {
      const player = new BombermanEntity();
      expect(player.stats.lives).toBe(3);
      expect(player.stats.speed).toBe(1.0);
      expect(player.stats.maxBombs).toBe(1);
      expect(player.stats.flameRange).toBe(1);
    });
  });

  describe('Speed & Sub-Pixel Physics', () => {
    it('advances position by exactly 1.0 px/tick under BASE_SPEED', () => {
      const grid = createStageGrid();
      const player = new BombermanEntity();
      player.update(500, null, grid); // Complete spawning phase

      // Safe spawn has (2, 1) empty, so moving RIGHT is unobstructed
      player.update(16.666, 'RIGHT', grid);
      expect(player.x).toBe(17.0);
      expect(player.y).toBe(16.0);
    });

    it('advances position by exactly 1.5 px/tick with SPEED_UP powerup active', () => {
      const grid = createStageGrid();
      const player = new BombermanEntity();
      player.update(500, null, grid); // Complete spawning
      player.stats.hasSpeedUp = true;

      player.update(16.666, 'RIGHT', grid);
      expect(player.x).toBe(17.5);
    });

    it('snaps flush to tile boundary when blocked at fractional speed 1.5 (Anti-Tunneling Snap-to-Tile)', () => {
      const grid = createStageGrid();
      const player = new BombermanEntity();
      player.update(500, null, grid);
      player.stats.hasSpeedUp = true; // Speed 1.5

      // Force player near left boundary wall (x = 0 is HARD_WALL, x=16 is corridor edge)
      player.x = 17.0; // 1.0px away from wall
      player.y = 16.0;

      // Move LEFT with speed 1.5: nextX would be 15.5, which collides with wall at x=0
      player.update(16.666, 'LEFT', grid);

      // Snap-to-tile must flush x exactly to (0 + 1) * 16 = 16.0
      expect(player.x).toBe(16.0);
    });
  });

  describe('Wallpass Predicate (isTilePassableForPlayer)', () => {
    it('treats HARD_WALL as impassable even with wallpass active', () => {
      const grid = createStageGrid();
      const player = new BombermanEntity();
      player.stats.wallpass = true;

      expect(isTilePassableForPlayer(0, 0, grid, player.stats)).toBe(false); // Border
      expect(isTilePassableForPlayer(2, 2, grid, player.stats)).toBe(false); // Fixed Pillar
    });

    it('blocks movement through SOFT_BLOCK when wallpass is false, allows it when wallpass is true', () => {
      const grid = createStageGrid();
      const player = new BombermanEntity();

      // Ensure tile (3, 1) has a soft block
      grid.setTile(3, 1, TileType.SOFT_BLOCK);

      player.stats.wallpass = false;
      expect(isTilePassableForPlayer(3, 1, grid, player.stats)).toBe(false);

      player.stats.wallpass = true;
      expect(isTilePassableForPlayer(3, 1, grid, player.stats)).toBe(true);
    });
  });

  describe('The Mathematical Corner-Sliding Algorithm (Critical Verification)', () => {
    it('activates Corner-Sliding when grazing pillar at (2,2) by 4 pixels moving DOWN (rx = 4 <= 6) -> slides LEFT towards open corridor at (1,2)', () => {
      const grid = createStageGrid();
      // Ensure corridor at (1, 2) is walkable, pillar at (2, 2) is HARD_WALL
      grid.setTile(1, 2, TileType.EMPTY);
      grid.setTile(2, 2, TileType.HARD_WALL);

      const player = new BombermanEntity();
      player.update(500, null, grid); // Finish spawning

      // Position player at x = 20.0, y = 16.0 (rx = 20 % 16 = 4)
      player.x = 20.0;
      player.y = 16.0;

      player.update(16.666, 'DOWN', grid);

      // Must slide LEFT (x decreases by 1.0) and move DOWN (y increases by 1.0)
      expect(player.x).toBe(19.0);
      expect(player.y).toBe(17.0);
    });

    it('activates Corner-Sliding when grazing pillar at (2,2) by 4 pixels moving DOWN from the other side (rx = 12 >= 10) -> slides RIGHT towards open corridor at (3,2)', () => {
      const grid = createStageGrid();
      grid.setTile(2, 2, TileType.HARD_WALL);
      grid.setTile(3, 2, TileType.EMPTY);

      const player = new BombermanEntity();
      player.update(500, null, grid);

      // Position player at x = 44.0, y = 16.0 (rx = 44 % 16 = 12 >= 10)
      player.x = 44.0;
      player.y = 16.0;

      player.update(16.666, 'DOWN', grid);

      // Must slide RIGHT (x increases by 1.0) and move DOWN (y increases by 1.0)
      expect(player.x).toBe(45.0);
      expect(player.y).toBe(17.0);
    });

    it('BLOCKS movement completely when hitting pillar at (2,2) head-on by 8 pixels (rx = 8 > 6) -> zero sliding, zero movement', () => {
      const grid = createStageGrid();
      grid.setTile(1, 2, TileType.EMPTY);
      grid.setTile(2, 2, TileType.HARD_WALL);

      const player = new BombermanEntity();
      player.update(500, null, grid);

      // Position player at x = 24.0, y = 16.0 (rx = 24 % 16 = 8, right in the middle)
      player.x = 24.0;
      player.y = 16.0;

      player.update(16.666, 'DOWN', grid);

      // Movement completely blocked, no slide
      expect(player.x).toBe(24.0);
      expect(player.y).toBe(16.0);
    });

    it('activates Corner-Sliding when grazing pillar at (2,2) by 4 pixels moving RIGHT (ry = 4 <= 6) -> slides UP towards open corridor at (2,1)', () => {
      const grid = createStageGrid();
      grid.setTile(2, 1, TileType.EMPTY);
      grid.setTile(2, 2, TileType.HARD_WALL);

      const player = new BombermanEntity();
      player.update(500, null, grid);

      // Position player at x = 16.0, y = 20.0 (ry = 20 % 16 = 4 <= 6)
      player.x = 16.0;
      player.y = 20.0;

      player.update(16.666, 'RIGHT', grid);

      // Must slide UP (y decreases by 1.0) and move RIGHT (x increases by 1.0)
      expect(player.y).toBe(19.0);
      expect(player.x).toBe(17.0);
    });

    it('BLOCKS horizontal movement completely when hitting pillar at (2,2) head-on by 8 pixels (ry = 8 > 6)', () => {
      const grid = createStageGrid();
      grid.setTile(2, 1, TileType.EMPTY);
      grid.setTile(2, 2, TileType.HARD_WALL);

      const player = new BombermanEntity();
      player.update(500, null, grid);

      // Position player at x = 16.0, y = 24.0 (ry = 8)
      player.x = 16.0;
      player.y = 24.0;

      player.update(16.666, 'RIGHT', grid);

      expect(player.x).toBe(16.0);
      expect(player.y).toBe(24.0);
    });
  });

  describe('Dual-Axis Input Resolution & Corner Turning', () => {
    it('evaluates secondary direction in same tick when primary is blocked', () => {
      const grid = createStageGrid();
      // Facing a wall moving UP (row 0 is border), but column to RIGHT (2, 1) is empty
      grid.setTile(1, 0, TileType.HARD_WALL);
      grid.setTile(2, 1, TileType.EMPTY);

      const player = new BombermanEntity();
      player.update(500, null, grid);
      player.x = 16.0;
      player.y = 16.0;

      // Primary is UP (blocked by wall), secondary is RIGHT (open)
      player.update(16.666, { primary: 'UP', secondary: 'RIGHT' }, grid);

      // Primary blocked, so secondary RIGHT executes
      expect(player.x).toBe(17.0);
      expect(player.y).toBe(16.0);
    });
  });

  describe('Player Lifecycle State Machine', () => {
    it('automatically transitions from SPAWNING to ALIVE after 500ms', () => {
      const grid = createStageGrid();
      const player = new BombermanEntity();
      expect(player.state).toBe('SPAWNING');

      player.update(400, null, grid);
      expect(player.state).toBe('SPAWNING');

      player.update(150, null, grid);
      expect(player.state).toBe('ALIVE');
      expect(player.isInvulnerable).toBe(false);
    });

    it('ignores lethal damage calls while in SPAWNING state', () => {
      const player = new BombermanEntity();
      const killed = player.kill();
      expect(killed).toBe(false);
      expect(player.state).toBe('SPAWNING');
    });

    it('transitions from ALIVE to DYING upon lethal damage', () => {
      const grid = createStageGrid();
      const player = new BombermanEntity();
      player.update(500, null, grid);

      const killed = player.kill();
      expect(killed).toBe(true);
      expect(player.state).toBe('DYING');
      expect(player.isInvulnerable).toBe(true);
    });

    it('freezes player movement while in DYING state', () => {
      const grid = createStageGrid();
      const player = new BombermanEntity();
      player.update(500, null, grid);
      player.kill();

      player.update(100, 'RIGHT', grid);
      expect(player.x).toBe(16.0);
      expect(player.y).toBe(16.0);
    });

    it('transitions from DYING to DEAD after 1000ms and decrements lives', () => {
      const grid = createStageGrid();
      const player = new BombermanEntity();
      player.update(500, null, grid);
      player.kill();

      player.update(500, null, grid);
      expect(player.state).toBe('DYING');
      expect(player.stats.lives).toBe(3);

      player.update(500, null, grid);
      expect(player.state).toBe('DEAD');
      expect(player.stats.lives).toBe(2);
    });

    it('resets player position to spawn point (16.0, 16.0) when resetToSpawn() is invoked', () => {
      const grid = createStageGrid();
      const player = new BombermanEntity();
      player.update(500, null, grid);
      player.x = 200.0;
      player.y = 100.0;

      player.resetToSpawn();
      expect(player.x).toBe(16.0);
      expect(player.y).toBe(16.0);
      expect(player.state).toBe('SPAWNING');
    });
  });
});
