import { HUD_OFFSET_Y } from '../stage-grid/types';
import type { IBombermanEntity } from './types';

export interface BombermanRenderOptions {
  readonly cameraX: number;
  readonly debugHitboxes?: boolean;
}

/**
 * Pure 2D Canvas Renderer for Bomberman Player Entity.
 * Renders classic NES pixel-art character sprite, directional facing, invulnerability flicker, and death animation.
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
      const isMysteryActive = player.stats.invincibleTimerMs > 0;
      let helmetColor = '#ffffff';
      if (isMysteryActive) {
        const flashColors = ['#ffffff', '#fc9838', '#00e8d8', '#f85898'];
        helmetColor = flashColors[Math.floor(performance.now() / 80) % flashColors.length];
      }
      this.drawAlive(screenX, screenY, player.facing, helmetColor);
    }

    // Hitbox outline strictly for debugging (activated via F2)
    if (debugHitboxes) {
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 1;
      ctx.strokeRect(screenX, screenY, 16, 16);
    }

    ctx.restore();
  }

  /**
   * Draws authentic NES Bomberman sprite based on facing direction.
   */
  private drawAlive(x: number, y: number, facing: string, helmetColor = '#ffffff'): void {
    const ctx = this.ctx;

    // 1. White Round Helmet / Body Base
    ctx.fillStyle = helmetColor;
    ctx.fillRect(x + 3, y + 2, 10, 8); // Head
    ctx.fillRect(x + 4, y + 9, 8, 5);  // Torso

    // 2. Pink Antenna Pom-Pom on top
    ctx.fillStyle = '#f85898';
    ctx.fillRect(x + 7, y, 2, 2);

    // 3. Blue Belt / Trimming
    ctx.fillStyle = '#0058f8';
    ctx.fillRect(x + 4, y + 11, 8, 2);

    // 4. Pink Shoes
    ctx.fillStyle = '#f83800';
    ctx.fillRect(x + 3, y + 14, 4, 2);
    ctx.fillRect(x + 9, y + 14, 4, 2);

    // 5. Direction-specific Face Details
    if (facing === 'DOWN') {
      // Front face visor
      ctx.fillStyle = '#fcb088'; // Skin tone
      ctx.fillRect(x + 5, y + 4, 6, 4);
      // Black eyes
      ctx.fillStyle = '#000000';
      ctx.fillRect(x + 6, y + 5, 1, 2);
      ctx.fillRect(x + 9, y + 5, 1, 2);
    } else if (facing === 'LEFT') {
      ctx.fillStyle = '#fcb088';
      ctx.fillRect(x + 3, y + 4, 5, 4);
      ctx.fillStyle = '#000000';
      ctx.fillRect(x + 4, y + 5, 1, 2);
    } else if (facing === 'RIGHT') {
      ctx.fillStyle = '#fcb088';
      ctx.fillRect(x + 8, y + 4, 5, 4);
      ctx.fillStyle = '#000000';
      ctx.fillRect(x + 11, y + 5, 1, 2);
    } else {
      // UP: Back of helmet (no face, white solid)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 3, y + 2, 10, 8);
    }
  }

  /**
   * Draws 1000ms death spin and deflation animation.
   */
  private drawDying(x: number, y: number, deathTimerMs: number): void {
    const ctx = this.ctx;
    const progress = Math.min(1.0, deathTimerMs / 1000);

    // Flash colors through death cycle
    const colors = ['#f83800', '#fc9838', '#f85898', '#ffffff'];
    const colorIndex = Math.floor(deathTimerMs / 100) % colors.length;
    ctx.fillStyle = colors[colorIndex];

    const shrink = Math.floor(progress * 6);
    const size = Math.max(4, 16 - shrink * 2);
    const offset = Math.floor((16 - size) / 2);

    ctx.fillRect(x + offset, y + offset, size, size);

    // Crumbling disintegration pixels
    ctx.fillStyle = '#000000';
    ctx.fillRect(x + 4, y + 4, 2, 2);
    ctx.fillRect(x + 10, y + 10, 2, 2);
  }
}
