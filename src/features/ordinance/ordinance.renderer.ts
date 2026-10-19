import { drawNesSprite } from '../../shared/sprites/nes-sprites';
import type { Bomb, Explosion, IOrdinanceEngine } from './types';

export interface OrdinanceRenderOptions {
  readonly cameraX: number;
  readonly debugHitboxes?: boolean;
}

/**
 * Pure 2D Canvas Renderer for Bombs, Fuses, and Cross Explosions.
 * Renders authentic NES 16x16 pulsating bomb animations and pixel-art cross flame blasts.
 */
export class OrdinanceRenderer {
  private readonly ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;
  }

  public render(engine: IOrdinanceEngine, options: OrdinanceRenderOptions): void {
    const { cameraX, debugHitboxes } = options;
    const scrollX = Math.floor(cameraX);

    // 1. Render Active Bombs
    for (const bomb of engine.activeBombs) {
      this.drawBomb(bomb, scrollX, debugHitboxes);
    }

    // 2. Render Active Explosions (flames take visual precedence over ground/items)
    for (const explosion of engine.activeExplosions) {
      this.drawExplosion(explosion, scrollX, debugHitboxes);
    }
  }

  /**
   * Draws pulsating NES bomb with 16x16 pixel-art matrix.
   */
  private drawBomb(bomb: Bomb, scrollX: number, debugHitboxes?: boolean): void {
    const ctx = this.ctx;
    const screenX = bomb.tx * 16 - scrollX;
    const screenY = bomb.ty * 16;

    // Viewport cull
    if (screenX + 16 < 0 || screenX > 256) return;

    // 250ms pulse animation (cycles between sizes and highlight colors)
    const pulseIndex = Math.floor(bomb.elapsedMs / 250) % 3;
    const spriteName = `BOMB_PULSE_${pulseIndex + 1}`;

    ctx.save();
    drawNesSprite(ctx, spriteName, screenX, screenY);

    if (debugHitboxes) {
      ctx.strokeStyle = bomb.ownerPassThrough ? '#00ffff' : '#ff0000';
      ctx.lineWidth = 1;
      ctx.strokeRect(screenX, screenY, 16, 16);
    }

    ctx.restore();
  }

  /**
   * Draws 4-phase cross explosion segments with authentic NES pixel-art.
   */
  private drawExplosion(explosion: Explosion, scrollX: number, debugHitboxes?: boolean): void {
    const ctx = this.ctx;
    const phase = explosion.phase;

    ctx.save();

    // In phase 3 (dissipating), slightly reduce opacity for fading sparks
    if (phase === 3) {
      ctx.globalAlpha = 0.6;
    }

    for (const segment of explosion.segments) {
      const screenX = segment.tx * 16 - scrollX;
      const screenY = segment.ty * 16;

      // Viewport cull
      if (screenX + 16 < 0 || screenX > 256) continue;

      const spriteName = `FLAME_${segment.type}`;
      drawNesSprite(ctx, spriteName, screenX, screenY);

      if (debugHitboxes) {
        ctx.strokeStyle = '#ff00ff';
        ctx.lineWidth = 1;
        ctx.strokeRect(screenX, screenY, 16, 16);
      }
    }

    ctx.restore();
  }
}
