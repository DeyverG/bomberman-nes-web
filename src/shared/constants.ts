/**
 * Core NES Hardware and Bomberman (1985) Global Constants
 */

export const TILE_SIZE = 16; // 16x16 pixels per tile

export const NES_RESOLUTION = {
  WIDTH: 256,
  HEIGHT: 240,
} as const;

export const ENGINE_CLOCK = {
  TARGET_FPS: 60,
  FIXED_DELTA_MS: 1000 / 60, // ~16.666667ms per tick
  MAX_ACCUMULATED_DELTA_MS: 100, // Clamp spiral-of-death (max ~6 sub-ticks per frame)
} as const;
