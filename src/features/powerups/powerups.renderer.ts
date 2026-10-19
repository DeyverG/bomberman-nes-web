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
   * Draws authentic NES power-up item container and symbol.
   */
  public drawPowerup(x: number, y: number, type: PowerupType): void {
    const ctx = this.ctx;

    // Outer tile bevel (NES card/tile background)
    ctx.fillStyle = '#000000';
    ctx.fillRect(x + 1, y + 1, 14, 14);

    ctx.fillStyle = '#bcbcbc';
    ctx.fillRect(x + 2, y + 2, 12, 12);

    ctx.fillStyle = '#fcb088';
    ctx.fillRect(x + 3, y + 3, 10, 10);

    switch (type) {
      case 'FIRE_UP': {
        // Red flame with yellow inner core
        ctx.fillStyle = '#f83800';
        ctx.fillRect(x + 6, y + 4, 4, 8);
        ctx.fillRect(x + 5, y + 6, 6, 5);
        ctx.fillStyle = '#f8b800';
        ctx.fillRect(x + 6, y + 7, 4, 4);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 7, y + 8, 2, 2);
        break;
      }
      case 'BOMB_UP': {
        // Black mini-bomb with spark
        ctx.fillStyle = '#000000';
        ctx.fillRect(x + 5, y + 6, 6, 6);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 6, y + 7, 2, 2);
        ctx.fillStyle = '#f83800';
        ctx.fillRect(x + 7, y + 4, 2, 2);
        break;
      }
      case 'SPEED_UP': {
        // Blue roller skate / boot
        ctx.fillStyle = '#0058f8';
        ctx.fillRect(x + 5, y + 5, 5, 5);
        ctx.fillRect(x + 5, y + 8, 7, 3);
        // Skate wheels
        ctx.fillStyle = '#f83800';
        ctx.fillRect(x + 5, y + 11, 2, 2);
        ctx.fillRect(x + 9, y + 11, 2, 2);
        break;
      }
      case 'DETONATOR': {
        // Red detonator remote with yellow button
        ctx.fillStyle = '#f83800';
        ctx.fillRect(x + 5, y + 6, 6, 6);
        // Antenna
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 9, y + 3, 1, 3);
        // Detonator button
        ctx.fillStyle = '#f8b800';
        ctx.fillRect(x + 7, y + 8, 2, 2);
        break;
      }
      case 'WALLPASS': {
        // White walking silhouette with brick blocks
        ctx.fillStyle = '#d85000';
        ctx.fillRect(x + 4, y + 4, 3, 8);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 8, y + 4, 4, 8);
        break;
      }
      case 'BOMBPASS': {
        // Black bomb on feet
        ctx.fillStyle = '#000000';
        ctx.fillRect(x + 5, y + 5, 6, 5);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 6, y + 6, 2, 2);
        // Legs
        ctx.fillStyle = '#f83800';
        ctx.fillRect(x + 5, y + 10, 2, 3);
        ctx.fillRect(x + 9, y + 10, 2, 3);
        break;
      }
      case 'FLAMEPASS': {
        // Flame shielding suit/vest
        ctx.fillStyle = '#0058f8';
        ctx.fillRect(x + 4, y + 5, 8, 7);
        ctx.fillStyle = '#f83800';
        ctx.fillRect(x + 6, y + 7, 4, 4);
        break;
      }
      case 'MYSTERY': {
        // Flashing question mark icon
        const colors = ['#f83800', '#f8b800', '#0058f8', '#00a800'];
        const color = colors[Math.floor(performance.now() / 100) % colors.length];
        ctx.fillStyle = color;
        ctx.fillRect(x + 5, y + 4, 6, 2);
        ctx.fillRect(x + 9, y + 6, 2, 3);
        ctx.fillRect(x + 7, y + 8, 2, 2);
        ctx.fillRect(x + 7, y + 11, 2, 2);
        break;
      }
    }
  }
}
