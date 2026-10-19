import {
  BURNING_DURATION_MS,
  BURNING_PHASE_DURATION_MS,
  CANDIDATE_POOL_SIZE,
  DEFAULT_SOFT_BLOCKS,
  DetonationResult,
  IStageGridEngine,
  PixelAABB,
  STAGE_COLS,
  STAGE_ROWS,
  STAGE_TOTAL_TILES,
  StageGridConfig,
  TileCoord,
  TileType,
} from './types';
import type { BurningBlockState } from './types';

export class StageGridEngine implements IStageGridEngine {
  public readonly buffer: Uint8Array = new Uint8Array(STAGE_TOTAL_TILES);
  private _doorIndex = -1;
  private _powerupIndex = -1;
  private _activeBurningBlocks: Map<number, BurningBlockState> = new Map();
  private readonly rng: () => number;
  private readonly requestedSoftBlocks: number;

  constructor(config?: StageGridConfig) {
    this.rng = config?.rng ?? Math.random;
    this.requestedSoftBlocks = Math.max(
      2,
      Math.min(CANDIDATE_POOL_SIZE, config?.softBlockCount ?? DEFAULT_SOFT_BLOCKS)
    );
    this.generate();
  }

  public get doorIndex(): number {
    return this._doorIndex;
  }

  public get powerupIndex(): number {
    return this._powerupIndex;
  }

  public get activeBurningBlocks(): ReadonlyMap<number, BurningBlockState> {
    return this._activeBurningBlocks;
  }

  public coordToIndex(x: number, y: number): number {
    return y * STAGE_COLS + x;
  }

  public indexToCoord(index: number): TileCoord {
    return {
      x: index % STAGE_COLS,
      y: Math.floor(index / STAGE_COLS),
    };
  }

  public pixelToTile(px: number, py: number): TileCoord {
    return {
      x: Math.floor(px / 16),
      y: Math.floor(py / 16),
    };
  }

  public tileToPixelAABB(x: number, y: number): PixelAABB {
    const minX = x * 16;
    const minY = y * 16;
    return {
      minX,
      minY,
      maxX: minX + 16,
      maxY: minY + 16,
      width: 16,
      height: 16,
    };
  }

  public isInBounds(x: number, y: number): boolean {
    return x >= 0 && x < STAGE_COLS && y >= 0 && y < STAGE_ROWS;
  }

  public getTile(x: number, y: number): TileType {
    if (!this.isInBounds(x, y)) {
      return TileType.HARD_WALL;
    }
    return this.buffer[this.coordToIndex(x, y)] as TileType;
  }

  public setTile(x: number, y: number, type: TileType): void {
    if (!this.isInBounds(x, y)) return;
    this.buffer[this.coordToIndex(x, y)] = type;
  }

  public isWalkable(x: number, y: number): boolean {
    if (!this.isInBounds(x, y)) return false;
    const tile = this.getTile(x, y);
    return (
      tile === TileType.EMPTY ||
      tile === TileType.DOOR_REVEALED ||
      tile === TileType.POWERUP_REVEALED
    );
  }

  public blocksFlame(x: number, y: number): boolean {
    if (!this.isInBounds(x, y)) return true;
    const tile = this.getTile(x, y);
    return (
      tile === TileType.HARD_WALL ||
      tile === TileType.SOFT_BLOCK ||
      tile === TileType.SOFT_BLOCK_WITH_DOOR ||
      tile === TileType.SOFT_BLOCK_WITH_POWERUP ||
      tile === TileType.BURNING_BLOCK
    );
  }

  public detonateTile(x: number, y: number): DetonationResult {
    if (!this.isInBounds(x, y)) {
      return { type: 'IMMUNE', tile: TileType.HARD_WALL, x, y };
    }

    const index = this.coordToIndex(x, y);
    const tile = this.getTile(x, y);

    if (tile === TileType.HARD_WALL) {
      return { type: 'IMMUNE', tile: TileType.HARD_WALL, x, y };
    }

    if (tile === TileType.BURNING_BLOCK) {
      return { type: 'ALREADY_BURNING', tile: TileType.BURNING_BLOCK, x, y };
    }

    if (tile === TileType.EMPTY) {
      return { type: 'EMPTY', tile: TileType.EMPTY, x, y };
    }

    if (tile === TileType.DOOR_REVEALED) {
      return {
        type: 'DOOR_HIT',
        tile: TileType.DOOR_REVEALED,
        x,
        y,
        spawnPunishmentEnemies: true,
      };
    }

    if (tile === TileType.POWERUP_REVEALED) {
      this.buffer[index] = TileType.EMPTY;
      return {
        type: 'POWERUP_DESTROYED',
        tile: TileType.EMPTY,
        x,
        y,
        spawnPunishmentEnemies: true,
      };
    }

    // Must be SOFT_BLOCK, SOFT_BLOCK_WITH_DOOR, or SOFT_BLOCK_WITH_POWERUP
    let targetType: TileType.EMPTY | TileType.DOOR_REVEALED | TileType.POWERUP_REVEALED;
    if (index === this._doorIndex) {
      targetType = TileType.DOOR_REVEALED;
    } else if (index === this._powerupIndex) {
      targetType = TileType.POWERUP_REVEALED;
    } else {
      targetType = TileType.EMPTY;
    }

    this.buffer[index] = TileType.BURNING_BLOCK;

    const burningState: BurningBlockState = {
      tileIndex: index,
      x,
      y,
      elapsedMs: 0,
      totalDurationMs: BURNING_DURATION_MS,
      targetType,
      phase: 0,
    };
    this._activeBurningBlocks.set(index, burningState);

    return {
      type: 'BURNING_STARTED',
      tile: TileType.BURNING_BLOCK,
      x,
      y,
      targetType,
    };
  }

  public update(deltaMs: number): void {
    if (this._activeBurningBlocks.size === 0) return;

    const finishedIndices: number[] = [];

    for (const [index, state] of this._activeBurningBlocks) {
      state.elapsedMs += deltaMs;
      if (state.elapsedMs >= BURNING_DURATION_MS) {
        this.buffer[index] = state.targetType;
        finishedIndices.push(index);
      } else {
        const phase = Math.min(
          3,
          Math.floor(state.elapsedMs / BURNING_PHASE_DURATION_MS)
        );
        (state as { phase: number }).phase = phase;
      }
    }

    for (const finishedIndex of finishedIndices) {
      this._activeBurningBlocks.delete(finishedIndex);
    }
  }

  public generate(): void {
    this._activeBurningBlocks.clear();
    this.buffer.fill(TileType.EMPTY);

    // 1. Build Indestructible Borders
    for (let x = 0; x < STAGE_COLS; x++) {
      this.buffer[this.coordToIndex(x, 0)] = TileType.HARD_WALL;
      this.buffer[this.coordToIndex(x, STAGE_ROWS - 1)] = TileType.HARD_WALL;
    }
    for (let y = 0; y < STAGE_ROWS; y++) {
      this.buffer[this.coordToIndex(0, y)] = TileType.HARD_WALL;
      this.buffer[this.coordToIndex(STAGE_COLS - 1, y)] = TileType.HARD_WALL;
    }

    // 2. Build Fixed Mathematical Pillars (x % 2 === 0 && y % 2 === 0)
    for (let y = 1; y < STAGE_ROWS - 1; y++) {
      for (let x = 1; x < STAGE_COLS - 1; x++) {
        if (x % 2 === 0 && y % 2 === 0) {
          this.buffer[this.coordToIndex(x, y)] = TileType.HARD_WALL;
        }
      }
    }

    // 3. Assemble Soft Block Candidate Pool (excluding safe spawn: (1,1), (1,2), (2,1))
    const candidates: number[] = [];
    for (let y = 1; y < STAGE_ROWS - 1; y++) {
      for (let x = 1; x < STAGE_COLS - 1; x++) {
        const isPillar = x % 2 === 0 && y % 2 === 0;
        const isSafeSpawn =
          (x === 1 && y === 1) ||
          (x === 1 && y === 2) ||
          (x === 2 && y === 1);

        if (!isPillar && !isSafeSpawn) {
          candidates.push(this.coordToIndex(x, y));
        }
      }
    }

    // 4. Shuffle candidate pool using PRNG (Fisher-Yates)
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      const temp = candidates[i];
      candidates[i] = candidates[j];
      candidates[j] = temp;
    }

    // 5. Place Soft Blocks
    const chosenBlocks = candidates.slice(0, this.requestedSoftBlocks);
    for (const index of chosenBlocks) {
      this.buffer[index] = TileType.SOFT_BLOCK;
    }

    // 6. Hide Door and Power-Up under two distinct soft blocks
    this._doorIndex = chosenBlocks[0];
    this._powerupIndex = chosenBlocks[1];

    this.buffer[this._doorIndex] = TileType.SOFT_BLOCK_WITH_DOOR;
    this.buffer[this._powerupIndex] = TileType.SOFT_BLOCK_WITH_POWERUP;
  }
}

/**
 * Factory helper for stage grid engine.
 */
export function createStageGrid(config?: StageGridConfig): IStageGridEngine {
  return new StageGridEngine(config);
}
