import { drawNesSprite } from '../../shared/sprites/nes-sprites';
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
 * Respects cameraX scrolling, NES color palette, pixel-perfect 16x16 tile reliefs, and burning block animations.
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

    // 1. Clear playfield viewport with official NES green ground (#00A800)
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
   * Draws classic NES concrete pillar / border with 16x16 pixel-art matrix.
   */
  private drawHardWall(x: number, y: number): void {
    drawNesSprite(this.ctx, 'HARD_WALL', x, y);
  }

  /**
   * Draws classic NES destructible brick block with 16x16 pixel-art matrix.
   */
  private drawSoftBlock(x: number, y: number): void {
    drawNesSprite(this.ctx, 'SOFT_BLOCK', x, y);
  }

  /**
   * Draws 4-phase disintegrating burning brick animation with 16x16 pixel-art matrix.
   */
  private drawBurningBlock(x: number, y: number, phase: number): void {
    const clampedPhase = Math.min(3, Math.max(0, phase));
    drawNesSprite(this.ctx, `BURNING_BLOCK_${clampedPhase}`, x, y);
  }

  /**
   * Draws revealed NES exit door with 16x16 pixel-art matrix.
   */
  private drawDoor(x: number, y: number): void {
    drawNesSprite(this.ctx, 'DOOR_REVEALED', x, y);
  }

  /**
   * Draws revealed powerup icon placeholder card with 16x16 pixel-art matrix.
   */
  private drawPowerup(x: number, y: number): void {
    drawNesSprite(this.ctx, 'POWERUP_CARD_BG', x, y);
  }
}
