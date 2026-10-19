import { drawNesSprite } from '../../shared/sprites/nes-sprites';
import { HUD_OFFSET_Y } from '../stage-grid/types';
import type { EnemyEntity, IEnemiesEngine } from './types';

export interface EnemiesRenderOptions {
  readonly cameraX: number;
  readonly debugHitboxes?: boolean;
}

/**
 * Pure 2D Canvas Renderer for NES Bomberman Enemies.
 * Renders authentic 16x16 pixel-art sprites for all 8 enemies with 2-frame walking
 * oscillations, dying desintegration frames, and floating score rewards.
 */
export class EnemiesRenderer {
  private readonly ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;
  }

  public render(engine: IEnemiesEngine, options: EnemiesRenderOptions): void {
    const { cameraX, debugHitboxes } = options;
    const ctx = this.ctx;
    const scrollX = Math.floor(cameraX);
    const offsetY = ctx.canvas.height === 208 ? 0 : HUD_OFFSET_Y;

    for (const enemy of engine.activeEnemies) {
      const screenX = Math.floor(enemy.x) - scrollX;
      const screenY = offsetY + Math.floor(enemy.y);

      // Viewport culling
      if (screenX + 16 < 0 || screenX > 256) continue;

      ctx.save();

      if (enemy.state === 'DYING') {
        this.drawDying(screenX, screenY, enemy);
      } else {
        this.drawAlive(screenX, screenY, enemy);
      }

      // Hitbox outline strictly for debugging (activated via F2)
      if (debugHitboxes) {
        // Physical 16x16 collision box
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(screenX, screenY, 16, 16);
        // Lethal 8x8 core hurtbox
        ctx.strokeStyle = '#ff0000';
        ctx.strokeRect(screenX + 4, screenY + 4, 8, 8);
      }

      ctx.restore();
    }
  }

  private drawAlive(x: number, y: number, enemy: EnemyEntity): void {
    // 2-frame walking oscillation (alternates every 150ms)
    const frame = (Math.floor(performance.now() / 150) % 2) + 1;
    const spriteName = `${enemy.type}_${frame}`;
    drawNesSprite(this.ctx, spriteName, x, y);
  }

  /**
   * 600ms Death Animation and Floating Point Reward Popup
   */
  private drawDying(x: number, y: number, enemy: EnemyEntity): void {
    const ctx = this.ctx;
    const progress = Math.min(1.0, enemy.deathTimerMs / 600);

    // 1. Draw dying pixel-art frame
    drawNesSprite(ctx, `${enemy.type}_DYING`, x, y);

    // 2. Floating Points Reward Popup
    if (enemy.scoreAwarded) {
      const floatY = y - Math.floor(progress * 10);
      const text = String(enemy.scoreAwarded);

      ctx.font = '8px monospace';
      ctx.fillStyle = '#ffff00';
      ctx.textAlign = 'center';
      ctx.fillText(text, x + 8, floatY);
    }
  }
}
