import { drawNesSprite } from '../../shared/sprites/nes-sprites';
import { HUD_OFFSET_Y, IStageGridEngine, STAGE_COLS, STAGE_ROWS, TileType } from '../stage-grid/types';
import type { IPowerupEngine, PowerupType } from './types';

export interface PowerupsRenderOptions {
  readonly cameraX: number;
  readonly debugHitboxes?: boolean;
}

/**
 * Pure 2D Canvas Renderer for NES Power-Up Icons.
 * Renders authentic NES 16x16 powerup sprites over revealed item tiles.
 */
export class PowerupsRenderer {
  private readonly ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;
  }

  public render(
    engine: IPowerupEngine,
    grid: IStageGridEngine,
    options: PowerupsRenderOptions
  ): void {
    const { cameraX } = options;
    const ctx = this.ctx;
    const scrollX = Math.floor(cameraX);
    const offsetY = ctx.canvas.height === 208 ? 0 : HUD_OFFSET_Y;

    // Viewport tile range
    const startCol = Math.max(0, Math.floor(scrollX / 16));
    const endCol = Math.min(STAGE_COLS - 1, Math.ceil((scrollX + 256) / 16));

    // Powerup type for current stage
    const powerupType = engine.getPowerupForStage(engine.currentStage);

    for (let y = 0; y < STAGE_ROWS; y++) {
      const screenY = offsetY + y * 16;

      for (let x = startCol; x <= endCol; x++) {
        if (grid.getTile(x, y) === TileType.POWERUP_REVEALED) {
          const screenX = x * 16 - scrollX;
          this.drawPowerup(screenX, screenY, powerupType);
        }
      }
    }
  }

  /**
   * Draws authentic NES power-up item container and symbol using 16x16 pixel-art matrix.
   */
  public drawPowerup(x: number, y: number, type: PowerupType): void {
    drawNesSprite(this.ctx, `POWERUP_${type}`, x, y);
  }
}
