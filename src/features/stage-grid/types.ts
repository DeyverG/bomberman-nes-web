/**
 * Stage Grid Core Constants for NES Bomberman (1985)
 */
export const STAGE_COLS = 31;
export const STAGE_ROWS = 13;
export const STAGE_TOTAL_TILES = 403; // 31 * 13
export const DEFAULT_SOFT_BLOCKS = 60;
export const CANDIDATE_POOL_SIZE = 246; // 319 interior - 70 pillars - 3 safe spawn
export const BURNING_DURATION_MS = 480; // Total disintegration time (~30 frames at 60Hz)
export const BURNING_PHASE_DURATION_MS = 120; // 4 visual phases (480 / 4)
export const MAX_CAMERA_X = 240; // 496 - 256
export const VIEWPORT_WIDTH = 256;
export const VIEWPORT_HEIGHT = 240;
export const HUD_OFFSET_Y = 32; // Top 32px reserved for HUD

/**
 * Numeric tile values encoded directly in the flat Uint8Array buffer.
 */
export enum TileType {
  EMPTY = 0x00,
  HARD_WALL = 0x01,
  SOFT_BLOCK = 0x02,
  SOFT_BLOCK_WITH_DOOR = 0x03,
  SOFT_BLOCK_WITH_POWERUP = 0x04,
  DOOR_REVEALED = 0x05,
  POWERUP_REVEALED = 0x06,
  BURNING_BLOCK = 0x07,
}

/**
 * 2D Tile coordinates (discrete grid indices)
 */
export interface TileCoord {
  readonly x: number;
  readonly y: number;
}

/**
 * 2D World/Pixel coordinates
 */
export interface PixelCoord {
  readonly px: number;
  readonly py: number;
}

/**
 * Axis-Aligned Bounding Box in pixel space
 */
export interface PixelAABB {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly width: number;
  readonly height: number;
}

/**
 * State of an actively burning / disintegrating block.
 * Solves the Amnesia Bug by keeping targetType and elapsed timer.
 */
export interface BurningBlockState {
  readonly tileIndex: number;
  readonly x: number;
  readonly y: number;
  elapsedMs: number;
  readonly totalDurationMs: number;
  readonly targetType: TileType.EMPTY | TileType.DOOR_REVEALED | TileType.POWERUP_REVEALED;
  readonly phase: number; // 0, 1, 2, 3
}

/**
 * Detonation result emitted when an explosion flame impacts a tile.
 */
export type DetonationResult =
  | { readonly type: 'IMMUNE'; readonly tile: TileType; readonly x: number; readonly y: number }
  | { readonly type: 'EMPTY'; readonly tile: TileType; readonly x: number; readonly y: number }
  | { readonly type: 'ALREADY_BURNING'; readonly tile: TileType; readonly x: number; readonly y: number }
  | {
      readonly type: 'BURNING_STARTED';
      readonly tile: TileType;
      readonly x: number;
      readonly y: number;
      readonly targetType: TileType.EMPTY | TileType.DOOR_REVEALED | TileType.POWERUP_REVEALED;
    }
  | {
      readonly type: 'DOOR_HIT';
      readonly tile: TileType.DOOR_REVEALED;
      readonly x: number;
      readonly y: number;
      readonly spawnPunishmentEnemies: true;
    }
  | {
      readonly type: 'POWERUP_DESTROYED';
      readonly tile: TileType.EMPTY;
      readonly x: number;
      readonly y: number;
      readonly spawnPunishmentEnemies: true;
    };

/**
 * Procedural generation options for stage grid
 */
export interface StageGridConfig {
  readonly softBlockCount?: number;
  readonly rng?: () => number;
}

/**
 * Public interface for pure TypeScript Stage Grid Matrix Engine.
 */
export interface IStageGridEngine {
  readonly buffer: Uint8Array;
  readonly doorIndex: number;
  readonly powerupIndex: number;
  readonly activeBurningBlocks: ReadonlyMap<number, BurningBlockState>;

  coordToIndex(x: number, y: number): number;
  indexToCoord(index: number): TileCoord;
  pixelToTile(px: number, py: number): TileCoord;
  tileToPixelAABB(x: number, y: number): PixelAABB;
  isInBounds(x: number, y: number): boolean;
  getTile(x: number, y: number): TileType;
  setTile(x: number, y: number, type: TileType): void;
  isWalkable(x: number, y: number): boolean;
  blocksFlame(x: number, y: number): boolean;
  detonateTile(x: number, y: number): DetonationResult;
  update(deltaMs: number): void;
  generate(): void;
}
