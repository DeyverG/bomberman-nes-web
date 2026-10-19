import type { IBombermanEntity } from '../bomberman/types';
import type { IStageGridEngine } from '../stage-grid/types';
import { TileType } from '../stage-grid/types';
import {
  Bomb,
  Explosion,
  EXPLOSION_DURATION_MS,
  FLAME_PHASE_DURATION_MS,
  FlameSegment,
  FlameSegmentType,
  FUSE_DURATION_MS,
  IOrdinanceEngine,
} from './types';

export class OrdinanceEngine implements IOrdinanceEngine {
  private _activeBombs: Bomb[] = [];
  private _activeExplosions: Explosion[] = [];
  private bombIdCounter = 0;
  private explosionIdCounter = 0;

  public get activeBombs(): readonly Bomb[] {
    return this._activeBombs;
  }

  public get activeExplosions(): readonly Explosion[] {
    return this._activeExplosions;
  }

  public placeBomb(
    tx: number,
    ty: number,
    player: IBombermanEntity,
    grid: IStageGridEngine
  ): Bomb | null {
    // 1. Capacity check
    if (this._activeBombs.length >= player.stats.maxBombs) {
      return null;
    }

    // 2. Occupancy check
    if (this.isBombAt(tx, ty)) {
      return null;
    }

    // 3. Ground passability check (cannot plant inside hard walls or bricks)
    if (!grid.isInBounds(tx, ty)) return null;
    const tile = grid.getTile(tx, ty);
    if (
      tile === TileType.HARD_WALL ||
      tile === TileType.SOFT_BLOCK ||
      tile === TileType.SOFT_BLOCK_WITH_DOOR ||
      tile === TileType.SOFT_BLOCK_WITH_POWERUP ||
      tile === TileType.BURNING_BLOCK
    ) {
      return null;
    }

    // 4. Create Bomb with Walk-Off Grace enabled
    const bomb: Bomb = {
      id: ++this.bombIdCounter,
      tx,
      ty,
      flameRange: player.stats.flameRange,
      elapsedMs: 0,
      fuseDurationMs: FUSE_DURATION_MS,
      ownerPassThrough: true,
      state: 'PLANTED',
    };

    this._activeBombs.push(bomb);
    player.stats.activeBombs = this._activeBombs.length;
    return bomb;
  }

  public detonateOldestBomb(grid: IStageGridEngine, player?: IBombermanEntity): void {
    if (this._activeBombs.length === 0) return;
    const oldest = this._activeBombs[0];
    this.detonateBomb(oldest.id, grid, player);
  }

  /**
   * Detonates a bomb by ID and processes chain reactions iteratively using a FIFO queue.
   * State mutation occurs BEFORE raycasting to eliminate infinite loop risk.
   */
  public detonateBomb(
    bombId: number,
    grid: IStageGridEngine,
    player?: IBombermanEntity
  ): void {
    const queue: Bomb[] = [];
    const bombIndex = this._activeBombs.findIndex((b) => b.id === bombId);

    if (bombIndex !== -1) {
      const [initialBomb] = this._activeBombs.splice(bombIndex, 1);
      initialBomb.state = 'DETONATING';
      queue.push(initialBomb);
    }

    // Process all explosions and chain reactions iteratively (FIFO Queue)
    while (queue.length > 0) {
      const currentBomb = queue.shift()!;
      currentBomb.state = 'CLEARED';
      this.createExplosion(currentBomb, grid, queue);
    }

    if (player) {
      player.stats.activeBombs = this._activeBombs.length;
    }
  }

  /**
   * Creates a 4-way cross explosion and queues any chain-reaction bombs encountered.
   */
  private createExplosion(
    bomb: Bomb,
    grid: IStageGridEngine,
    chainQueue: Bomb[]
  ): void {
    const bx = bomb.tx;
    const by = bomb.ty;
    const segments: FlameSegment[] = [{ tx: bx, ty: by, type: 'CENTER' }];

    const directions = [
      { dir: 'UP', dx: 0, dy: -1, body: 'VERTICAL_BODY' as FlameSegmentType, end: 'TOP_END' as FlameSegmentType },
      { dir: 'DOWN', dx: 0, dy: 1, body: 'VERTICAL_BODY' as FlameSegmentType, end: 'BOTTOM_END' as FlameSegmentType },
      { dir: 'LEFT', dx: -1, dy: 0, body: 'HORIZONTAL_BODY' as FlameSegmentType, end: 'LEFT_END' as FlameSegmentType },
      { dir: 'RIGHT', dx: 1, dy: 0, body: 'HORIZONTAL_BODY' as FlameSegmentType, end: 'RIGHT_END' as FlameSegmentType },
    ];

    for (const { dx, dy, body, end } of directions) {
      for (let step = 1; step <= bomb.flameRange; step++) {
        const rx = bx + dx * step;
        const ry = by + dy * step;

        if (!grid.isInBounds(rx, ry)) break;

        const tile = grid.getTile(rx, ry);

        // 1. HARD_WALL halts raycast completely (immune)
        if (tile === TileType.HARD_WALL) {
          break;
        }

        // 2. Chain Reaction: active bomb struck by flame
        const hitBombIndex = this._activeBombs.findIndex(
          (b) => b.tx === rx && b.ty === ry
        );
        if (hitBombIndex !== -1) {
          const [hitBomb] = this._activeBombs.splice(hitBombIndex, 1);
          hitBomb.state = 'DETONATING';
          chainQueue.push(hitBomb);
          break; // Ray stops at struck bomb
        }

        // 3. Destructible soft blocks absorb flame ray
        if (
          tile === TileType.SOFT_BLOCK ||
          tile === TileType.SOFT_BLOCK_WITH_DOOR ||
          tile === TileType.SOFT_BLOCK_WITH_POWERUP
        ) {
          grid.detonateTile(rx, ry);
          break; // Does not penetrate past brick
        }

        // 4. Currently burning block halts ray without resetting
        if (tile === TileType.BURNING_BLOCK) {
          break;
        }

        // 5. Revealed Special Tiles: Early terminal stop
        if (tile === TileType.DOOR_REVEALED || tile === TileType.POWERUP_REVEALED) {
          grid.detonateTile(rx, ry);
          // Terminal flame segment placed on early stopping tile
          segments.push({ tx: rx, ty: ry, type: end });
          break;
        }

        // 6. Walkable EMPTY ground
        const isEnd = step === bomb.flameRange;
        segments.push({
          tx: rx,
          ty: ry,
          type: isEnd ? end : body,
        });
      }
    }

    const explosion: Explosion = {
      id: ++this.explosionIdCounter,
      originTx: bx,
      originTy: by,
      range: bomb.flameRange,
      segments,
      elapsedMs: 0,
      totalDurationMs: EXPLOSION_DURATION_MS,
      phase: 0,
      isFinished: false,
    };

    this._activeExplosions.push(explosion);
  }

  public update(
    deltaMs: number,
    player: IBombermanEntity,
    grid: IStageGridEngine
  ): void {
    // 1. Update Walk-Off Grace status
    const playerMinX = player.x;
    const playerMinY = player.y;
    const playerMaxX = player.x + 16;
    const playerMaxY = player.y + 16;

    for (const bomb of this._activeBombs) {
      if (bomb.ownerPassThrough) {
        const bombMinX = bomb.tx * 16;
        const bombMinY = bomb.ty * 16;
        const bombMaxX = bombMinX + 16;
        const bombMaxY = bombMinY + 16;

        const intersects =
          playerMinX < bombMaxX &&
          playerMaxX > bombMinX &&
          playerMinY < bombMaxY &&
          playerMaxY > bombMinY;

        if (!intersects) {
          bomb.ownerPassThrough = false;
        }
      }
    }

    // 2. Advance Existing Active Explosions (before adding new explosions this tick)
    const activeExplosionsList: Explosion[] = [];
    for (const explosion of this._activeExplosions) {
      explosion.elapsedMs += deltaMs;
      if (explosion.elapsedMs >= explosion.totalDurationMs) {
        (explosion as { isFinished: boolean }).isFinished = true;
      } else {
        const phase = Math.min(
          3,
          Math.floor(explosion.elapsedMs / FLAME_PHASE_DURATION_MS)
        );
        (explosion as { phase: number }).phase = phase;
        activeExplosionsList.push(explosion);
      }
    }
    this._activeExplosions = activeExplosionsList;

    // 3. Fuse Countdown & Natural Detonations (generates fresh explosions with elapsedMs = 0)
    const expiredBombs: Bomb[] = [];
    for (const bomb of this._activeBombs) {
      bomb.elapsedMs += deltaMs;
      if (bomb.elapsedMs >= bomb.fuseDurationMs) {
        expiredBombs.push(bomb);
      }
    }

    for (const expired of expiredBombs) {
      this.detonateBomb(expired.id, grid, player);
    }

    // 4. Flame Lethality against Bomberman
    if (!player.stats.flamepass && player.state === 'ALIVE') {
      // Inner damage hitbox: 12x12px centered inside 16x16px
      const dmgMinX = player.x + 2;
      const dmgMinY = player.y + 2;
      const dmgMaxX = player.x + 14;
      const dmgMaxY = player.y + 14;

      for (const explosion of this._activeExplosions) {
        for (const segment of explosion.segments) {
          const segMinX = segment.tx * 16;
          const segMinY = segment.ty * 16;
          const segMaxX = segMinX + 16;
          const segMaxY = segMinY + 16;

          const intersects =
            dmgMinX < segMaxX &&
            dmgMaxX > segMinX &&
            dmgMinY < segMaxY &&
            dmgMaxY > segMinY;

          if (intersects) {
            player.kill();
            return;
          }
        }
      }
    }
  }

  public isBombAt(tx: number, ty: number): boolean {
    return this._activeBombs.some((b) => b.tx === tx && b.ty === ty);
  }

  public isFlameAt(tx: number, ty: number): boolean {
    return this._activeExplosions.some((exp) =>
      exp.segments.some((seg) => seg.tx === tx && seg.ty === ty)
    );
  }

  public isTileBlockedByBomb(
    tx: number,
    ty: number,
    player: IBombermanEntity
  ): boolean {
    if (player.stats.bombpass) return false;

    const bomb = this._activeBombs.find((b) => b.tx === tx && b.ty === ty);
    if (!bomb) return false;

    return !bomb.ownerPassThrough;
  }

  public clear(): void {
    this._activeBombs = [];
    this._activeExplosions = [];
  }
}

/**
 * Factory helper for creating Ordinance engine.
 */
export function createOrdinanceEngine(): IOrdinanceEngine {
  return new OrdinanceEngine();
}
