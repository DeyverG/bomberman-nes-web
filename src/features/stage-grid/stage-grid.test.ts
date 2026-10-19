import { describe, it, expect } from 'vitest';
import { calculateCameraX, clamp } from './camera';
import { StageGridEngine } from './stage-grid.engine';
import {
  BURNING_DURATION_MS,
  CANDIDATE_POOL_SIZE,
  DEFAULT_SOFT_BLOCKS,
  STAGE_COLS,
  STAGE_ROWS,
  STAGE_TOTAL_TILES,
  TileType,
} from './types';

describe('Stage Grid Matrix Engine (31x13 Canonical NES Verification)', () => {
  describe('Memory Allocation & Dimensions', () => {
    it('allocates a flat Uint8Array buffer of exactly 403 bytes (31x13)', () => {
      const engine = new StageGridEngine();
      expect(engine.buffer).toBeInstanceOf(Uint8Array);
      expect(engine.buffer.length).toBe(STAGE_TOTAL_TILES);
      expect(STAGE_TOTAL_TILES).toBe(403);
    });

    it('verifies candidate pool size is mathematically 246 tiles', () => {
      const interiorTiles = (STAGE_COLS - 2) * (STAGE_ROWS - 2); // 29 * 11 = 319
      const fixedPillars = 14 * 5; // 70
      const safeSpawn = 3;
      const calculatedPool = interiorTiles - fixedPillars - safeSpawn;
      expect(calculatedPool).toBe(CANDIDATE_POOL_SIZE);
      expect(CANDIDATE_POOL_SIZE).toBe(246);
    });
  });

  describe('Mathematical Coordinate Bijectivity', () => {
    it('proves bijective 1:1 mapping: coordToIndex(indexToCoord(i)) === i for all 403 tiles', () => {
      const engine = new StageGridEngine();
      for (let i = 0; i < STAGE_TOTAL_TILES; i++) {
        const coord = engine.indexToCoord(i);
        const mappedIndex = engine.coordToIndex(coord.x, coord.y);
        expect(mappedIndex).toBe(i);
      }
    });

    it('converts world pixels to tile coordinates via floor division by 16', () => {
      const engine = new StageGridEngine();
      expect(engine.pixelToTile(0, 0)).toEqual({ x: 0, y: 0 });
      expect(engine.pixelToTile(15.9, 15.9)).toEqual({ x: 0, y: 0 });
      expect(engine.pixelToTile(16, 16)).toEqual({ x: 1, y: 1 });
      expect(engine.pixelToTile(480, 192)).toEqual({ x: 30, y: 12 });
    });

    it('computes 16x16 pixel AABB bounds for tile coordinates', () => {
      const engine = new StageGridEngine();
      const aabb = engine.tileToPixelAABB(2, 3);
      expect(aabb).toEqual({
        minX: 32,
        minY: 48,
        maxX: 48,
        maxY: 64,
        width: 16,
        height: 16,
      });
    });
  });

  describe('The Mathematical Law of Perimeter Borders', () => {
    it('enforces row y = 0 and row y = 12 are strictly HARD_WALL for all 31 columns', () => {
      const engine = new StageGridEngine();
      for (let x = 0; x < STAGE_COLS; x++) {
        expect(engine.getTile(x, 0)).toBe(TileType.HARD_WALL);
        expect(engine.getTile(x, STAGE_ROWS - 1)).toBe(TileType.HARD_WALL);
      }
    });

    it('enforces column x = 0 and column x = 30 are strictly HARD_WALL for all 13 rows', () => {
      const engine = new StageGridEngine();
      for (let y = 0; y < STAGE_ROWS; y++) {
        expect(engine.getTile(0, y)).toBe(TileType.HARD_WALL);
        expect(engine.getTile(STAGE_COLS - 1, y)).toBe(TileType.HARD_WALL);
      }
    });
  });

  describe('The Mathematical Law of Fixed Pillars', () => {
    it('enforces that every interior tile with even X and even Y is strictly HARD_WALL', () => {
      const engine = new StageGridEngine();
      let pillarCount = 0;
      for (let y = 1; y < STAGE_ROWS - 1; y++) {
        for (let x = 1; x < STAGE_COLS - 1; x++) {
          if (x % 2 === 0 && y % 2 === 0) {
            expect(engine.getTile(x, y)).toBe(TileType.HARD_WALL);
            pillarCount++;
          }
        }
      }
      expect(pillarCount).toBe(70);
    });

    it('guarantees that interior tiles with odd coordinates are never fixed pillars', () => {
      const engine = new StageGridEngine();
      for (let y = 1; y < STAGE_ROWS - 1; y++) {
        for (let x = 1; x < STAGE_COLS - 1; x++) {
          if (x % 2 !== 0 || y % 2 !== 0) {
            // Can be EMPTY, SOFT_BLOCK, DOOR, or POWERUP, but never permanent HARD_WALL
            expect(engine.getTile(x, y)).not.toBe(TileType.HARD_WALL);
          }
        }
      }
    });
  });

  describe('Bomberman Safe Spawn Invariant', () => {
    it('guarantees tiles (1,1), (1,2), and (2,1) are strictly EMPTY', () => {
      const engine = new StageGridEngine();
      expect(engine.getTile(1, 1)).toBe(TileType.EMPTY);
      expect(engine.getTile(1, 2)).toBe(TileType.EMPTY);
      expect(engine.getTile(2, 1)).toBe(TileType.EMPTY);
    });
  });

  describe('Procedural Generation & Amnesia-Free Items Distribution', () => {
    it('spawns exactly DEFAULT_SOFT_BLOCKS (60) destructible blocks', () => {
      const engine = new StageGridEngine();
      let count = 0;
      for (let i = 0; i < STAGE_TOTAL_TILES; i++) {
        const tile = engine.buffer[i];
        if (
          tile === TileType.SOFT_BLOCK ||
          tile === TileType.SOFT_BLOCK_WITH_DOOR ||
          tile === TileType.SOFT_BLOCK_WITH_POWERUP
        ) {
          count++;
        }
      }
      expect(count).toBe(DEFAULT_SOFT_BLOCKS);
    });

    it('hides exactly one Exit Door and one Power-Up at distinct soft block indices', () => {
      const engine = new StageGridEngine();
      expect(engine.doorIndex).toBeGreaterThan(0);
      expect(engine.powerupIndex).toBeGreaterThan(0);
      expect(engine.doorIndex).not.toBe(engine.powerupIndex);

      expect(engine.buffer[engine.doorIndex]).toBe(TileType.SOFT_BLOCK_WITH_DOOR);
      expect(engine.buffer[engine.powerupIndex]).toBe(TileType.SOFT_BLOCK_WITH_POWERUP);
    });

    it('produces identical deterministic layouts when provided identical PRNG seed', () => {
      let seed1 = 42;
      const rng1 = () => {
        seed1 = (seed1 * 9301 + 49297) % 233280;
        return seed1 / 233280;
      };
      let seed2 = 42;
      const rng2 = () => {
        seed2 = (seed2 * 9301 + 49297) % 233280;
        return seed2 / 233280;
      };

      const engine1 = new StageGridEngine({ rng: rng1 });
      const engine2 = new StageGridEngine({ rng: rng2 });

      expect(engine1.buffer).toEqual(engine2.buffer);
      expect(engine1.doorIndex).toBe(engine2.doorIndex);
      expect(engine1.powerupIndex).toBe(engine2.powerupIndex);
    });
  });

  describe('Destruction Mechanics & 480ms Amnesia Bug Resolution', () => {
    it('retains door target when SOFT_BLOCK_WITH_DOOR is detonated and decaying', () => {
      const engine = new StageGridEngine();
      const doorCoord = engine.indexToCoord(engine.doorIndex);

      const result = engine.detonateTile(doorCoord.x, doorCoord.y);
      expect(result.type).toBe('BURNING_STARTED');
      if (result.type === 'BURNING_STARTED') {
        expect(result.targetType).toBe(TileType.DOOR_REVEALED);
      }
      expect(engine.getTile(doorCoord.x, doorCoord.y)).toBe(TileType.BURNING_BLOCK);

      // Advance by 240ms (halfway through disintegration)
      engine.update(240);
      expect(engine.getTile(doorCoord.x, doorCoord.y)).toBe(TileType.BURNING_BLOCK);

      // Advance past remaining 240ms (total >= 480ms)
      engine.update(240);
      expect(engine.getTile(doorCoord.x, doorCoord.y)).toBe(TileType.DOOR_REVEALED);
      expect(engine.activeBurningBlocks.size).toBe(0);
    });

    it('retains powerup target when SOFT_BLOCK_WITH_POWERUP is detonated and decaying', () => {
      const engine = new StageGridEngine();
      const pCoord = engine.indexToCoord(engine.powerupIndex);

      const result = engine.detonateTile(pCoord.x, pCoord.y);
      expect(result.type).toBe('BURNING_STARTED');
      if (result.type === 'BURNING_STARTED') {
        expect(result.targetType).toBe(TileType.POWERUP_REVEALED);
      }

      engine.update(BURNING_DURATION_MS);
      expect(engine.getTile(pCoord.x, pCoord.y)).toBe(TileType.POWERUP_REVEALED);
    });

    it('transitions standard SOFT_BLOCK to EMPTY after 480ms decay', () => {
      const engine = new StageGridEngine();
      // Find a standard soft block
      let regularBlockIndex = -1;
      for (let i = 0; i < STAGE_TOTAL_TILES; i++) {
        if (engine.buffer[i] === TileType.SOFT_BLOCK) {
          regularBlockIndex = i;
          break;
        }
      }
      expect(regularBlockIndex).toBeGreaterThan(0);

      const coord = engine.indexToCoord(regularBlockIndex);
      const res = engine.detonateTile(coord.x, coord.y);
      expect(res.type).toBe('BURNING_STARTED');

      engine.update(BURNING_DURATION_MS);
      expect(engine.getTile(coord.x, coord.y)).toBe(TileType.EMPTY);
    });
  });

  describe('Explosion Impact on Revealed Items', () => {
    it('leaves DOOR_REVEALED intact but emits spawnPunishmentEnemies when hit by flame', () => {
      const engine = new StageGridEngine();
      const doorCoord = engine.indexToCoord(engine.doorIndex);

      // Reveal door
      engine.detonateTile(doorCoord.x, doorCoord.y);
      engine.update(BURNING_DURATION_MS);
      expect(engine.getTile(doorCoord.x, doorCoord.y)).toBe(TileType.DOOR_REVEALED);

      // Second hit on revealed door
      const secondHit = engine.detonateTile(doorCoord.x, doorCoord.y);
      expect(secondHit.type).toBe('DOOR_HIT');
      if (secondHit.type === 'DOOR_HIT') {
        expect(secondHit.spawnPunishmentEnemies).toBe(true);
      }
      expect(engine.getTile(doorCoord.x, doorCoord.y)).toBe(TileType.DOOR_REVEALED);
    });

    it('destroys POWERUP_REVEALED and emits spawnPunishmentEnemies when hit by flame', () => {
      const engine = new StageGridEngine();
      const pCoord = engine.indexToCoord(engine.powerupIndex);

      // Reveal powerup
      engine.detonateTile(pCoord.x, pCoord.y);
      engine.update(BURNING_DURATION_MS);
      expect(engine.getTile(pCoord.x, pCoord.y)).toBe(TileType.POWERUP_REVEALED);

      // Second hit on revealed powerup incinerates it
      const secondHit = engine.detonateTile(pCoord.x, pCoord.y);
      expect(secondHit.type).toBe('POWERUP_DESTROYED');
      if (secondHit.type === 'POWERUP_DESTROYED') {
        expect(secondHit.spawnPunishmentEnemies).toBe(true);
      }
      expect(engine.getTile(pCoord.x, pCoord.y)).toBe(TileType.EMPTY);
    });
  });

  describe('Horizontal Viewport Camera Mathematics', () => {
    it('clamps clamp(v, min, max) correctly', () => {
      expect(clamp(-5, 0, 240)).toBe(0);
      expect(clamp(100, 0, 240)).toBe(100);
      expect(clamp(300, 0, 240)).toBe(240);
    });

    it('calculates cameraX centered at 128px clamped between [0, 240]', () => {
      expect(calculateCameraX(0)).toBe(0);
      expect(calculateCameraX(128)).toBe(0);
      expect(calculateCameraX(200)).toBe(72);
      expect(calculateCameraX(368)).toBe(240);
      expect(calculateCameraX(450)).toBe(240);
    });
  });
});
