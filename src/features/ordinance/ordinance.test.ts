import { describe, it, expect } from 'vitest';
import { createBomberman } from '../bomberman';
import { createStageGrid } from '../stage-grid';
import { TileType } from '../stage-grid/types';
import { OrdinanceEngine } from './ordinance.engine';
import { FUSE_DURATION_MS } from './types';

describe('Ordinance & Explosion System (Unit Test Verification)', () => {
  describe('Bomb Placement Preconditions', () => {
    it('successfully plants a bomb when activeBombs < maxBombs and tile is EMPTY', () => {
      const ordinance = new OrdinanceEngine();
      const grid = createStageGrid();
      const player = createBomberman();

      // Tile (1, 1) is empty safe spawn
      const bomb = ordinance.placeBomb(1, 1, player, grid);
      expect(bomb).not.toBeNull();
      expect(bomb?.tx).toBe(1);
      expect(bomb?.ty).toBe(1);
      expect(ordinance.activeBombs.length).toBe(1);
      expect(player.stats.activeBombs).toBe(1);
    });

    it('prevents planting a bomb when activeBombs has reached player.stats.maxBombs', () => {
      const ordinance = new OrdinanceEngine();
      const grid = createStageGrid();
      const player = createBomberman();
      player.stats.maxBombs = 1;

      ordinance.placeBomb(1, 1, player, grid);
      // Attempt second bomb with maxBombs = 1
      const secondBomb = ordinance.placeBomb(1, 2, player, grid);
      expect(secondBomb).toBeNull();
      expect(ordinance.activeBombs.length).toBe(1);
    });

    it('prevents planting a bomb on a tile that already contains an active bomb', () => {
      const ordinance = new OrdinanceEngine();
      const grid = createStageGrid();
      const player = createBomberman();
      player.stats.maxBombs = 5;

      ordinance.placeBomb(1, 1, player, grid);
      const duplicate = ordinance.placeBomb(1, 1, player, grid);
      expect(duplicate).toBeNull();
      expect(ordinance.activeBombs.length).toBe(1);
    });

    it('prevents planting a bomb on a HARD_WALL or SOFT_BLOCK', () => {
      const ordinance = new OrdinanceEngine();
      const grid = createStageGrid();
      const player = createBomberman();
      player.stats.maxBombs = 5;

      // Tile (0, 0) is HARD_WALL border
      expect(ordinance.placeBomb(0, 0, player, grid)).toBeNull();

      // Tile (2, 2) is HARD_WALL pillar
      expect(ordinance.placeBomb(2, 2, player, grid)).toBeNull();

      // Soft block tile
      grid.setTile(3, 1, TileType.SOFT_BLOCK);
      expect(ordinance.placeBomb(3, 1, player, grid)).toBeNull();
    });
  });

  describe('The "Walk-Off Grace" Invariant (Non-Trap Guarantee)', () => {
    it('initializes a newly planted bomb with ownerPassThrough: true', () => {
      const ordinance = new OrdinanceEngine();
      const grid = createStageGrid();
      const player = createBomberman();

      const bomb = ordinance.placeBomb(1, 1, player, grid);
      expect(bomb?.ownerPassThrough).toBe(true);
      expect(ordinance.isTileBlockedByBomb(1, 1, player)).toBe(false);
    });

    it('mutates ownerPassThrough to false on the very first tick where player AABB no longer intersects bomb AABB', () => {
      const ordinance = new OrdinanceEngine();
      const grid = createStageGrid();
      const player = createBomberman();
      player.update(500, null, grid); // Finish spawning

      // Player starts at (16, 16). Plants bomb at (1, 1) -> tile box [16, 16, 32, 32]
      const bomb = ordinance.placeBomb(1, 1, player, grid)!;
      expect(bomb.ownerPassThrough).toBe(true);

      // Player moves slightly (x = 24.0), still intersecting bomb box [16, 32]
      player.x = 24.0;
      ordinance.update(16.666, player, grid);
      expect(bomb.ownerPassThrough).toBe(true);

      // Player completely clears the tile to x = 32.0 (box [32, 48] does not intersect [16, 32])
      player.x = 32.0;
      ordinance.update(16.666, player, grid);
      expect(bomb.ownerPassThrough).toBe(false);

      // Now the bomb blocks player
      expect(ordinance.isTileBlockedByBomb(1, 1, player)).toBe(true);
    });

    it('allows Bomberman to walk through the bomb even after ownerPassThrough is false if bombpass is true', () => {
      const ordinance = new OrdinanceEngine();
      const grid = createStageGrid();
      const player = createBomberman();
      player.update(500, null, grid);

      const bomb = ordinance.placeBomb(1, 1, player, grid)!;
      player.x = 32.0;
      ordinance.update(16.666, player, grid);
      expect(bomb.ownerPassThrough).toBe(false);

      player.stats.bombpass = true;
      expect(ordinance.isTileBlockedByBomb(1, 1, player)).toBe(false);
    });
  });

  describe('Fuse Countdown & Detonation Trigger', () => {
    it('maintains bomb in PLANTED state while elapsedMs < FUSE_DURATION_MS (3000ms)', () => {
      const ordinance = new OrdinanceEngine();
      const grid = createStageGrid();
      const player = createBomberman();

      ordinance.placeBomb(1, 1, player, grid);
      ordinance.update(2500, player, grid);

      expect(ordinance.activeBombs.length).toBe(1);
      expect(ordinance.activeExplosions.length).toBe(0);
    });

    it('triggers explosion and transitions bomb state to CLEARED when fuse timer reaches 3000ms', () => {
      const ordinance = new OrdinanceEngine();
      const grid = createStageGrid();
      const player = createBomberman();

      ordinance.placeBomb(1, 1, player, grid);
      ordinance.update(FUSE_DURATION_MS, player, grid);

      expect(ordinance.activeBombs.length).toBe(0);
      expect(ordinance.activeExplosions.length).toBe(1);
      expect(player.stats.activeBombs).toBe(0);
    });

    it('allows immediate manual detonation via detonateOldestBomb()', () => {
      const ordinance = new OrdinanceEngine();
      const grid = createStageGrid();
      const player = createBomberman();

      ordinance.placeBomb(1, 1, player, grid);
      expect(ordinance.activeBombs.length).toBe(1);

      ordinance.detonateOldestBomb(grid, player);
      expect(ordinance.activeBombs.length).toBe(0);
      expect(ordinance.activeExplosions.length).toBe(1);
    });
  });

  describe('Cross Explosion Raycasting (4-Way Discrete Propagation)', () => {
    it('creates a central explosion segment (CENTER) on the origin tile of the detonated bomb', () => {
      const ordinance = new OrdinanceEngine();
      const grid = createStageGrid();
      const player = createBomberman();

      ordinance.placeBomb(1, 1, player, grid);
      ordinance.detonateOldestBomb(grid, player);

      const explosion = ordinance.activeExplosions[0];
      expect(explosion.originTx).toBe(1);
      expect(explosion.originTy).toBe(1);
      expect(explosion.segments.some((s) => s.tx === 1 && s.ty === 1 && s.type === 'CENTER')).toBe(true);
    });

    it('halts raycast immediately when encountering HARD_WALL', () => {
      const ordinance = new OrdinanceEngine();
      const grid = createStageGrid();
      const player = createBomberman();
      player.stats.flameRange = 3;

      // Bomb at (1, 1). Tile (0, 1) is border HARD_WALL, tile (1, 0) is border HARD_WALL
      ordinance.placeBomb(1, 1, player, grid);
      ordinance.detonateOldestBomb(grid, player);

      const explosion = ordinance.activeExplosions[0];
      // Must not generate flame on (0, 1) or (1, 0)
      expect(explosion.segments.some((s) => s.tx === 0 && s.ty === 1)).toBe(false);
      expect(explosion.segments.some((s) => s.tx === 1 && s.ty === 0)).toBe(false);
    });

    it('consumes a single SOFT_BLOCK by calling grid.detonateTile() and halts raycast without penetrating', () => {
      const ordinance = new OrdinanceEngine();
      const grid = createStageGrid();
      const player = createBomberman();
      player.stats.flameRange = 3;

      // Put soft block at (2, 1) and empty ground behind it at (3, 1)
      grid.setTile(2, 1, TileType.SOFT_BLOCK);
      grid.setTile(3, 1, TileType.EMPTY);

      ordinance.placeBomb(1, 1, player, grid);
      ordinance.detonateOldestBomb(grid, player);

      // (2, 1) must have transitioned to BURNING_BLOCK in grid
      expect(grid.getTile(2, 1)).toBe(TileType.BURNING_BLOCK);

      // Explosion ray must NOT penetrate to (3, 1)
      const explosion = ordinance.activeExplosions[0];
      expect(explosion.segments.some((s) => s.tx === 3 && s.ty === 1)).toBe(false);
    });

    it('halts raycast and creates a terminal END segment when hitting DOOR_REVEALED or POWERUP_REVEALED', () => {
      const ordinance = new OrdinanceEngine();
      const grid = createStageGrid();
      const player = createBomberman();
      player.stats.flameRange = 3;

      grid.setTile(2, 1, TileType.DOOR_REVEALED);

      ordinance.placeBomb(1, 1, player, grid);
      ordinance.detonateOldestBomb(grid, player);

      const explosion = ordinance.activeExplosions[0];
      const doorFlame = explosion.segments.find((s) => s.tx === 2 && s.ty === 1);
      expect(doorFlame).toBeDefined();
      expect(doorFlame?.type).toBe('RIGHT_END'); // Terminal tip on early stop
    });
  });

  describe('Chain Reactions (Bomb Hitting Bomb without Infinite Loops)', () => {
    it('triggers immediate chain reaction detonation on the same tick when an explosion ray strikes another active bomb', () => {
      const ordinance = new OrdinanceEngine();
      const grid = createStageGrid();
      const player = createBomberman();
      player.stats.maxBombs = 5;
      player.stats.flameRange = 2;

      // Ensure path between (1, 1) and (1, 2) is open
      grid.setTile(1, 1, TileType.EMPTY);
      grid.setTile(1, 2, TileType.EMPTY);

      const bomb1 = ordinance.placeBomb(1, 1, player, grid)!;
      const bomb2 = ordinance.placeBomb(1, 2, player, grid)!;

      expect(ordinance.activeBombs.length).toBe(2);

      // Detonate bomb 1
      ordinance.detonateBomb(bomb1.id, grid, player);

      // Both bombs should have detonated in chain reaction
      expect(ordinance.activeBombs.length).toBe(0);
      expect(ordinance.activeExplosions.length).toBe(2);
      expect(bomb2.state).toBe('CLEARED');
    });

    it('supports cascading chain reactions across 3 bombs in a row', () => {
      const ordinance = new OrdinanceEngine();
      const grid = createStageGrid();
      const player = createBomberman();
      player.stats.maxBombs = 5;
      player.stats.flameRange = 2;

      grid.setTile(1, 1, TileType.EMPTY);
      grid.setTile(1, 2, TileType.EMPTY);
      grid.setTile(1, 3, TileType.EMPTY);

      const b1 = ordinance.placeBomb(1, 1, player, grid)!;
      ordinance.placeBomb(1, 2, player, grid);
      ordinance.placeBomb(1, 3, player, grid);

      expect(ordinance.activeBombs.length).toBe(3);

      ordinance.detonateBomb(b1.id, grid, player);

      expect(ordinance.activeBombs.length).toBe(0);
      expect(ordinance.activeExplosions.length).toBe(3);
    });
  });

  describe('Flame Duration & Lethality', () => {
    it('keeps explosion flames active for exactly EXPLOSION_DURATION_MS (480ms)', () => {
      const ordinance = new OrdinanceEngine();
      const grid = createStageGrid();
      const player = createBomberman();

      ordinance.placeBomb(1, 1, player, grid);
      ordinance.detonateOldestBomb(grid, player);
      expect(ordinance.activeExplosions.length).toBe(1);

      // Advance 240ms (halfway)
      ordinance.update(240, player, grid);
      expect(ordinance.activeExplosions.length).toBe(1);

      // Advance past remaining 240ms (total >= 480ms)
      ordinance.update(240, player, grid);
      expect(ordinance.activeExplosions.length).toBe(0);
    });

    it('kills Bomberman if inner damage hitbox intersects an active flame segment when flamepass is false', () => {
      const ordinance = new OrdinanceEngine();
      const grid = createStageGrid();
      const player = createBomberman();
      player.update(500, null, grid); // Finish spawning -> ALIVE

      // Player is at (16, 16). Detonate bomb at (1, 1) -> flame covers (1, 1)
      ordinance.placeBomb(1, 1, player, grid);
      ordinance.detonateOldestBomb(grid, player);

      expect(player.state).toBe('ALIVE');
      ordinance.update(16.666, player, grid);

      expect(player.state).toBe('DYING');
    });

    it('spares Bomberman from explosion damage when player.stats.flamepass is true', () => {
      const ordinance = new OrdinanceEngine();
      const grid = createStageGrid();
      const player = createBomberman();
      player.update(500, null, grid);
      player.stats.flamepass = true;

      ordinance.placeBomb(1, 1, player, grid);
      ordinance.detonateOldestBomb(grid, player);

      ordinance.update(16.666, player, grid);
      expect(player.state).toBe('ALIVE');
    });
  });
});
