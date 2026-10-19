import type { Bomb, Explosion, IOrdinanceEngine } from './types';

export interface OrdinanceRenderOptions {
  readonly cameraX: number;
  readonly debugHitboxes?: boolean;
}

/**
 * Pure 2D Canvas Renderer for Bombs, Fuses, and Cross Explosions.
 * Renders authentic NES pulsating bomb animations and 4-phase cross flame blasts.
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
   * Draws pulsating NES bomb with wick and fuse spark.
   */
  private drawBomb(bomb: Bomb, scrollX: number, debugHitboxes?: boolean): void {
    const ctx = this.ctx;
    const screenX = bomb.tx * 16 - scrollX;
    const screenY = bomb.ty * 16;

    // Viewport cull
    if (screenX + 16 < 0 || screenX > 256) return;

    // 250ms pulse animation (cycles between sizes and highlight colors)
    const pulseIndex = Math.floor(bomb.elapsedMs / 250) % 3;

    ctx.save();

    // Bomb body
    let bodyInset = 1;
    let mainColor = '#000000';
    let highlightColor = '#bcbcbc';

    if (pulseIndex === 1) {
      bodyInset = 0; // Expanded
      mainColor = '#f83800'; // Flashing red
      highlightColor = '#ffffff';
    } else if (pulseIndex === 2) {
      bodyInset = 2; // Contracted
      mainColor = '#000000';
      highlightColor = '#f85898';
    }

    const bx = screenX + bodyInset;
    const by = screenY + bodyInset;

    // Authentic NES rounded bomb body
    ctx.fillStyle = mainColor;
    ctx.fillRect(bx + 4, by + 4, 8, 1);
    ctx.fillRect(bx + 2, by + 5, 12, 8);
    ctx.fillRect(bx + 4, by + 13, 8, 1);

    // Highlight sheen
    ctx.fillStyle = highlightColor;
    ctx.fillRect(bx + 4, by + 6, 3, 2);
    ctx.fillRect(bx + 4, by + 8, 2, 2);

    // Top cap
    ctx.fillStyle = '#bcbcbc';
    ctx.fillRect(screenX + 6, screenY + 2, 4, 2);

    // Sparkling fuse
    const sparkColor = Math.floor(bomb.elapsedMs / 100) % 2 === 0 ? '#fc9838' : '#ffffff';
    ctx.fillStyle = sparkColor;
    ctx.fillRect(screenX + 7, screenY, 2, 2);

    if (debugHitboxes) {
      ctx.strokeStyle = bomb.ownerPassThrough ? '#00ffff' : '#ff0000';
      ctx.lineWidth = 1;
      ctx.strokeRect(screenX, screenY, 16, 16);
    }

    ctx.restore();
  }

  /**
   * Draws 4-phase cross explosion segments.
   */
  private drawExplosion(explosion: Explosion, scrollX: number, debugHitboxes?: boolean): void {
    const ctx = this.ctx;
    const phase = explosion.phase;

    // Phase palette definition (4 visual phases of 120ms each)
    // 0: Orange/Yellow core -> 1: Bright White/Yellow -> 2: Red/Orange -> 3: Dissipating sparks
    const palettes = [
      { core: '#ffffff', mid: '#fc9838', edge: '#f83800' },
      { core: '#ffffff', mid: '#f8b800', edge: '#fc9838' },
      { core: '#fc9838', mid: '#f83800', edge: '#7c0800' },
      { core: '#f83800', mid: '#505050', edge: 'transparent' },
    ];

    const currentPalette = palettes[Math.min(3, phase)];

    ctx.save();

    for (const segment of explosion.segments) {
      const screenX = segment.tx * 16 - scrollX;
      const screenY = segment.ty * 16;

      // Viewport cull
      if (screenX + 16 < 0 || screenX > 256) continue;

      this.drawFlameSegment(screenX, screenY, segment.type, currentPalette, phase);

      if (debugHitboxes) {
        ctx.strokeStyle = '#ff00ff';
        ctx.lineWidth = 1;
        ctx.strokeRect(screenX, screenY, 16, 16);
      }
    }

    ctx.restore();
  }

  private drawFlameSegment(
    x: number,
    y: number,
    type: string,
    palette: { core: string; mid: string; edge: string },
    phase: number
  ): void {
    const ctx = this.ctx;

    if (phase === 3) {
      // Dissipating sparks
      ctx.fillStyle = palette.core;
      ctx.fillRect(x + 4, y + 4, 3, 3);
      ctx.fillRect(x + 10, y + 8, 3, 3);
      ctx.fillRect(x + 6, y + 11, 2, 2);
      return;
    }

    // Outer edge fill
    ctx.fillStyle = palette.edge;
    ctx.fillRect(x + 1, y + 1, 14, 14);

    // Mid layer based on segment type
    ctx.fillStyle = palette.mid;
    if (type === 'CENTER') {
      ctx.fillRect(x + 3, y + 3, 10, 10);
    } else if (type === 'HORIZONTAL_BODY') {
      ctx.fillRect(x, y + 3, 16, 10);
    } else if (type === 'VERTICAL_BODY') {
      ctx.fillRect(x + 3, y, 10, 16);
    } else if (type === 'TOP_END') {
      ctx.fillRect(x + 3, y + 4, 10, 12);
    } else if (type === 'BOTTOM_END') {
      ctx.fillRect(x + 3, y, 10, 12);
    } else if (type === 'LEFT_END') {
      ctx.fillRect(x + 4, y + 3, 12, 10);
    } else if (type === 'RIGHT_END') {
      ctx.fillRect(x, y + 3, 12, 10);
    }

    // White core highlight
    ctx.fillStyle = palette.core;
    if (type === 'CENTER') {
      ctx.fillRect(x + 5, y + 5, 6, 6);
    } else if (type === 'HORIZONTAL_BODY') {
      ctx.fillRect(x, y + 5, 16, 6);
    } else if (type === 'VERTICAL_BODY') {
      ctx.fillRect(x + 5, y, 6, 16);
    } else if (type === 'TOP_END') {
      ctx.fillRect(x + 5, y + 6, 6, 10);
    } else if (type === 'BOTTOM_END') {
      ctx.fillRect(x + 5, y, 6, 10);
    } else if (type === 'LEFT_END') {
      ctx.fillRect(x + 6, y + 5, 10, 6);
    } else if (type === 'RIGHT_END') {
      ctx.fillRect(x, y + 5, 10, 6);
    }
  }
}
