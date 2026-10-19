import {
  HUD_OFFSET_Y,
  IStageGridEngine,
  STAGE_COLS,
  STAGE_ROWS,
  TileType,
  VIEWPORT_WIDTH,
} from './types';

export interface StageRenderOptions {
  readonly cameraX: number;
  readonly debugHitboxes?: boolean;
}

/**
 * Pure 2D Canvas Renderer for NES Bomberman Stage Grid.
 * Respects cameraX scrolling, NES color palette, pixel-perfect tile reliefs, and burning block animations.
 */
export class StageGridRenderer {
  private readonly ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;
  }

  public render(engine: IStageGridEngine, options: StageRenderOptions): void {
    const { cameraX, debugHitboxes } = options;
    const ctx = this.ctx;
    const scrollX = Math.floor(cameraX);

    const offsetY = ctx.canvas.height === 208 ? 0 : HUD_OFFSET_Y;

    // 1. Clear playfield viewport with NES green ground (#00a800)
    ctx.fillStyle = '#00a800';
    ctx.fillRect(0, offsetY, VIEWPORT_WIDTH, ctx.canvas.height - offsetY);

    // 2. Determine visible column range
    const startCol = Math.max(0, Math.floor(scrollX / 16));
    const endCol = Math.min(STAGE_COLS - 1, Math.ceil((scrollX + VIEWPORT_WIDTH) / 16));

    // 3. Render visible tiles
    for (let y = 0; y < STAGE_ROWS; y++) {
      const screenY = offsetY + y * 16;

      for (let x = startCol; x <= endCol; x++) {
        const screenX = x * 16 - scrollX;
        const tile = engine.getTile(x, y);

        switch (tile) {
          case TileType.HARD_WALL:
            this.drawHardWall(screenX, screenY);
            break;
          case TileType.SOFT_BLOCK:
          case TileType.SOFT_BLOCK_WITH_DOOR:
          case TileType.SOFT_BLOCK_WITH_POWERUP:
            this.drawSoftBlock(screenX, screenY);
            break;
          case TileType.BURNING_BLOCK: {
            const index = engine.coordToIndex(x, y);
            const burningState = engine.activeBurningBlocks.get(index);
            const phase = burningState?.phase ?? 0;
            this.drawBurningBlock(screenX, screenY, phase);
            break;
          }
          case TileType.DOOR_REVEALED:
            this.drawDoor(screenX, screenY);
            break;
          case TileType.POWERUP_REVEALED:
            this.drawPowerup(screenX, screenY);
            break;
          case TileType.EMPTY:
          default:
            // Ground background already drawn
            break;
        }

        // Optional debug wireframe for tile boundary verification
        if (debugHitboxes) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.lineWidth = 1;
          ctx.strokeRect(screenX, screenY, 16, 16);
        }
      }
    }
  }

  /**
   * Draws classic NES concrete pillar / border with top-left highlight and bottom-right shadow.
   */
  private drawHardWall(x: number, y: number): void {
    const ctx = this.ctx;

    // Base concrete fill
    ctx.fillStyle = '#bcbcbc';
    ctx.fillRect(x, y, 16, 16);

    // Top & Left highlight (white)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, 16, 2);
    ctx.fillRect(x, y, 2, 16);

    // Bottom & Right deep shadow
    ctx.fillStyle = '#505050';
    ctx.fillRect(x, y + 14, 16, 2);
    ctx.fillRect(x + 14, y, 2, 16);

    // Inner bevel relief
    ctx.fillStyle = '#808080';
    ctx.fillRect(x + 3, y + 3, 10, 10);
    ctx.fillStyle = '#bcbcbc';
    ctx.fillRect(x + 4, y + 4, 8, 8);
  }

  /**
   * Draws classic NES destructible brick block with mortar seams.
   */
  private drawSoftBlock(x: number, y: number): void {
    const ctx = this.ctx;

    // Brick reddish-brown base
    ctx.fillStyle = '#d85000';
    ctx.fillRect(x, y, 16, 16);

    // Dark mortar outlines
    ctx.fillStyle = '#000000';
    ctx.fillRect(x, y + 7, 16, 2); // Horizontal seam
    ctx.fillRect(x, y + 15, 16, 1); // Bottom seam

    // Vertical seams: Top row has seam at x+8
    ctx.fillRect(x + 7, y, 2, 7);
    // Bottom row has seams at edges
    ctx.fillRect(x + 15, y + 8, 1, 8);

    // Brick highlights (light orange/yellowish)
    ctx.fillStyle = '#fc9838';
    ctx.fillRect(x + 1, y + 1, 6, 2);
    ctx.fillRect(x + 9, y + 1, 6, 2);
    ctx.fillRect(x + 1, y + 9, 14, 2);

    // Brick shadow accents
    ctx.fillStyle = '#7c0800';
    ctx.fillRect(x + 1, y + 5, 6, 2);
    ctx.fillRect(x + 9, y + 5, 6, 2);
    ctx.fillRect(x + 1, y + 13, 14, 2);
  }

  /**
   * Draws 4-phase disintegrating burning brick animation.
   */
  private drawBurningBlock(x: number, y: number, phase: number): void {
    const ctx = this.ctx;

    // Progression of crumbling flame and dissolving fragments
    if (phase === 0) {
      this.drawSoftBlock(x, y);
      ctx.fillStyle = 'rgba(248, 56, 0, 0.6)';
      ctx.fillRect(x + 2, y + 2, 12, 12);
    } else if (phase === 1) {
      ctx.fillStyle = '#f83800';
      ctx.fillRect(x + 2, y + 2, 12, 12);
      ctx.fillStyle = '#fc9838';
      ctx.fillRect(x + 4, y + 4, 8, 8);
    } else if (phase === 2) {
      ctx.fillStyle = '#fc9838';
      ctx.fillRect(x + 4, y + 4, 8, 8);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 6, y + 6, 4, 4);
    } else {
      // Phase 3: Few crumbling sparks
      ctx.fillStyle = '#fc9838';
      ctx.fillRect(x + 2, y + 2, 3, 3);
      ctx.fillRect(x + 11, y + 3, 3, 3);
      ctx.fillRect(x + 4, y + 11, 3, 3);
      ctx.fillRect(x + 10, y + 10, 3, 3);
    }
  }

  /**
   * Draws revealed NES exit door.
   */
  private drawDoor(x: number, y: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#000000';
    ctx.fillRect(x + 1, y + 1, 14, 14);

    ctx.fillStyle = '#bcbcbc';
    ctx.fillRect(x + 2, y + 2, 12, 12);

    ctx.fillStyle = '#000000';
    ctx.fillRect(x + 4, y + 4, 8, 10);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 5, y + 5, 6, 8);
  }

  /**
   * Draws revealed powerup icon placeholder.
   */
  private drawPowerup(x: number, y: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#000000';
    ctx.fillRect(x + 2, y + 2, 12, 12);

    ctx.fillStyle = '#fc9838';
    ctx.fillRect(x + 3, y + 3, 10, 10);

    // Glowing center flame/bomb icon
    ctx.fillStyle = '#f83800';
    ctx.fillRect(x + 5, y + 5, 6, 6);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 6, y + 6, 4, 4);
  }
}
