import { HUD_OFFSET_Y } from '../stage-grid/types';
import type { EnemyEntity, IEnemiesEngine } from './types';

export interface EnemiesRenderOptions {
  readonly cameraX: number;
  readonly debugHitboxes?: boolean;
}

/**
 * Pure 2D Canvas Renderer for NES Bomberman Enemies.
 * Renders authentic pixel art sprites for all 7 enemies, 600ms death animations,
 * and floating score rewards.
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
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(screenX, screenY, 16, 16);
      }

      ctx.restore();
    }
  }

  private drawAlive(x: number, y: number, enemy: EnemyEntity): void {
    switch (enemy.type) {
      case 'BALLOM':
        this.drawBallom(x, y);
        break;
      case 'ONEAL':
        this.drawOneal(x, y, enemy.speed > 0.5);
        break;
      case 'DAHL':
        this.drawDahl(x, y);
        break;
      case 'MINVO':
        this.drawMinvo(x, y);
        break;
      case 'OVAPE':
        this.drawOvape(x, y);
        break;
      case 'KONDORIA':
        this.drawKondoria(x, y);
        break;
      case 'PONTAN':
        this.drawPontan(x, y);
        break;
    }
  }

  /**
   * BALLOM: Orange balloon with smiling face
   */
  private drawBallom(x: number, y: number): void {
    const ctx = this.ctx;

    // Body
    ctx.fillStyle = '#fc9838';
    ctx.fillRect(x + 3, y + 2, 10, 11);
    ctx.fillRect(x + 2, y + 4, 12, 7);

    // Highlight
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 4, y + 3, 3, 2);

    // Eyes
    ctx.fillStyle = '#000000';
    ctx.fillRect(x + 5, y + 6, 2, 2);
    ctx.fillRect(x + 9, y + 6, 2, 2);

    // Smile
    ctx.fillRect(x + 6, y + 9, 4, 1);
    ctx.fillRect(x + 5, y + 8, 1, 1);
    ctx.fillRect(x + 10, y + 8, 1, 1);

    // Bottom knot
    ctx.fillStyle = '#d85000';
    ctx.fillRect(x + 7, y + 13, 2, 2);
  }

  /**
   * ONEAL: Blue ghost/onion with big eyes
   */
  private drawOneal(x: number, y: number, isBursting: boolean): void {
    const ctx = this.ctx;

    // Onion body
    ctx.fillStyle = isBursting ? '#f83800' : '#0058f8';
    ctx.fillRect(x + 7, y + 1, 2, 3); // top sprout
    ctx.fillRect(x + 4, y + 4, 8, 9);
    ctx.fillRect(x + 2, y + 6, 12, 6);

    // Big white eyes
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 4, y + 6, 3, 4);
    ctx.fillRect(x + 9, y + 6, 3, 4);

    // Black pupils
    ctx.fillStyle = '#000000';
    ctx.fillRect(x + 5, y + 7, 2, 2);
    ctx.fillRect(x + 10, y + 7, 2, 2);

    // Bottom wavy feet
    ctx.fillStyle = isBursting ? '#d85000' : '#0000a8';
    ctx.fillRect(x + 3, y + 13, 3, 2);
    ctx.fillRect(x + 10, y + 13, 3, 2);
  }

  /**
   * DAHL: Red spinning barrel / cylinder
   */
  private drawDahl(x: number, y: number): void {
    const ctx = this.ctx;

    // Barrel red body
    ctx.fillStyle = '#f83800';
    ctx.fillRect(x + 3, y + 2, 10, 12);
    ctx.fillRect(x + 2, y + 4, 12, 8);

    // Yellow / white stripes
    ctx.fillStyle = '#fc9838';
    ctx.fillRect(x + 2, y + 5, 12, 2);
    ctx.fillRect(x + 2, y + 9, 12, 2);

    // Slits
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 5, y + 7, 2, 1);
    ctx.fillRect(x + 9, y + 7, 2, 1);
  }

  /**
   * MINVO: Green aggressive chaser face
   */
  private drawMinvo(x: number, y: number): void {
    const ctx = this.ctx;

    // Green round face
    ctx.fillStyle = '#00a800';
    ctx.fillRect(x + 3, y + 2, 10, 12);
    ctx.fillRect(x + 2, y + 4, 12, 8);

    // Angled eyes
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 4, y + 5, 3, 3);
    ctx.fillRect(x + 9, y + 5, 3, 3);
    ctx.fillStyle = '#000000';
    ctx.fillRect(x + 5, y + 6, 2, 2);
    ctx.fillRect(x + 9, y + 6, 2, 2);

    // Grin with teeth
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 5, y + 10, 6, 2);
    ctx.fillStyle = '#000000';
    ctx.fillRect(x + 7, y + 10, 2, 2);
  }

  /**
   * OVAPE: Purple soft block ghost
   */
  private drawOvape(x: number, y: number): void {
    const ctx = this.ctx;

    // Purple ghost shape
    ctx.fillStyle = '#9838f8';
    ctx.fillRect(x + 4, y + 2, 8, 12);
    ctx.fillRect(x + 2, y + 5, 12, 7);

    // Eyes
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 5, y + 6, 2, 3);
    ctx.fillRect(x + 9, y + 6, 2, 3);
    ctx.fillStyle = '#000000';
    ctx.fillRect(x + 5, y + 7, 1, 2);
    ctx.fillRect(x + 9, y + 7, 1, 2);

    // Ghostly frills
    ctx.fillStyle = '#fcb088';
    ctx.fillRect(x + 3, y + 13, 2, 2);
    ctx.fillRect(x + 7, y + 13, 2, 2);
    ctx.fillRect(x + 11, y + 13, 2, 2);
  }

  /**
   * KONDORIA: Blue blob / amoeba
   */
  private drawKondoria(x: number, y: number): void {
    const ctx = this.ctx;

    // Amoeba body
    ctx.fillStyle = '#3cbcfc';
    ctx.fillRect(x + 3, y + 3, 10, 10);
    ctx.fillRect(x + 1, y + 6, 14, 5);

    // Core
    ctx.fillStyle = '#0058f8';
    ctx.fillRect(x + 5, y + 5, 6, 6);

    // White eyes
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 6, y + 6, 2, 2);
    ctx.fillRect(x + 9, y + 6, 2, 2);
  }

  /**
   * PONTAN: Orange/yellow spinning sun disc
   */
  private drawPontan(x: number, y: number): void {
    const ctx = this.ctx;

    // Disc body
    ctx.fillStyle = '#f8b800';
    ctx.fillRect(x + 3, y + 3, 10, 10);
    ctx.fillRect(x + 2, y + 5, 12, 6);

    // Radial flares
    ctx.fillStyle = '#f83800';
    ctx.fillRect(x + 7, y + 1, 2, 2);
    ctx.fillRect(x + 7, y + 13, 2, 2);
    ctx.fillRect(x + 1, y + 7, 2, 2);
    ctx.fillRect(x + 13, y + 7, 2, 2);

    // Center face
    ctx.fillStyle = '#000000';
    ctx.fillRect(x + 5, y + 6, 2, 2);
    ctx.fillRect(x + 9, y + 6, 2, 2);
    ctx.fillRect(x + 6, y + 9, 4, 1);
  }

  /**
   * 600ms Death Animation and Floating Point Reward Popup
   */
  private drawDying(x: number, y: number, enemy: EnemyEntity): void {
    const ctx = this.ctx;
    const progress = Math.min(1.0, enemy.deathTimerMs / 600);

    // 1. Disintegrating crumbling sprite
    const colors = ['#f83800', '#fc9838', '#ffffff', '#7c0800'];
    const color = colors[Math.floor(enemy.deathTimerMs / 75) % colors.length];

    ctx.fillStyle = color;
    const shrink = Math.floor(progress * 5);
    const size = Math.max(4, 14 - shrink * 2);
    const offset = Math.floor((16 - size) / 2);
    ctx.fillRect(x + offset, y + offset, size, size);

    // Sparks
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 2 + Math.floor(progress * 4), y + 2, 2, 2);
    ctx.fillRect(x + 12 - Math.floor(progress * 4), y + 12, 2, 2);

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
