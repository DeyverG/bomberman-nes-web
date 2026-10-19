import { MAX_CAMERA_X } from './types';

/**
 * Clamps a numerical value between min and max bounds.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Pure mathematical calculation of NES Bomberman horizontal camera scroll.
 * World width: 496px (31 tiles * 16px).
 * Viewport width: 256px.
 * Maximum camera scroll: 496 - 256 = 240px.
 * The viewport centers the player at 128px horizontally.
 *
 * @param playerPixelX Player X position in world pixel space
 * @returns Camera X offset in pixels clamped between 0 and 240
 */
export function calculateCameraX(playerPixelX: number): number {
  return clamp(Math.floor(playerPixelX - 128), 0, MAX_CAMERA_X);
}
