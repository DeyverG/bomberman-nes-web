import { drawNesSprite } from '../../shared/sprites/nes-sprites';
import { HUD_OFFSET_Y } from '../stage-grid/types';
import type { IBombermanEntity } from './types';

export interface BombermanRenderOptions {
  readonly cameraX: number;
  readonly debugHitboxes?: boolean;
}

/**
 * Pure 2D Canvas Renderer for Bomberman Player Entity.
 * Renders authentic NES pixel-art character sprites with 3-frame walk cycles,
 * directional facing, invulnerability flicker, and 4-phase dying animation.
 */
export class BombermanRenderer {
  private readonly ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;
  }

  public render(player: IBombermanEntity, options: BombermanRenderOptions): void {
    const { cameraX, debugHitboxes } = options;
    const ctx = this.ctx;

    if (player.state === 'DEAD') return;

    const offsetY = ctx.canvas.height === 208 ? 0 : HUD_OFFSET_Y;
    const screenX = Math.floor(player.x) - Math.floor(cameraX);
    const screenY = offsetY + Math.floor(player.y);

    // Only render if within visible viewport
    if (screenX + 16 < 0 || screenX > 256) return;

    // SPAWNING Invulnerability Flicker (~60ms interval)
    if (player.state === 'SPAWNING') {
      const flicker = Math.floor(performance.now() / 60) % 2 === 0;
      if (!flicker) return;
    }

    ctx.save();

    if (player.state === 'DYING') {
      this.drawDying(screenX, screenY, player.getSnapshot().deathTimerMs);
    } else {
      this.drawAlive(screenX, screenY, player.facing, player.walkFrame);
    }

    // Hitbox outline strictly for debugging (activated via F2)
    if (debugHitboxes) {
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 1;
      ctx.strokeRect(screenX, screenY, 16, 16);
      // Also show 8x8 lethal hurtbox in cyan
      ctx.strokeStyle = '#00ffff';
      ctx.strokeRect(screenX + 4, screenY + 4, 8, 8);
    }

    ctx.restore();
  }

  /**
   * Draws authentic NES Bomberman 16x16 pixel-art sprite with walking animation.
   */
  private drawAlive(x: number, y: number, facing: string, walkFrame: number): void {
    const frame = walkFrame === 1 ? 'WALK1' : walkFrame === 2 ? 'WALK2' : 'IDLE';
    const spriteName = `BOMBERMAN_${facing}_${frame}`;

    drawNesSprite(this.ctx, spriteName, x, y);
  }

  /**
   * Draws authentic NES 4-frame dying and desintegrating animation.
   */
  private drawDying(x: number, y: number, deathTimerMs: number): void {
    const frameIndex = Math.min(4, Math.floor((deathTimerMs / 1000) * 4) + 1);
    drawNesSprite(this.ctx, `BOMBERMAN_DYING_${frameIndex}`, x, y);
  }
}
