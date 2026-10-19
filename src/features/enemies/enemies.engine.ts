import type { IBombermanEntity } from '../bomberman/types';
import type { Explosion, IOrdinanceEngine } from '../ordinance/types';
import type { IStageGridEngine } from '../stage-grid/types';
import { TileType } from '../stage-grid/types';
import {
  ComboKillResult,
  ENEMY_BASE_SCORES,
  ENEMY_BASE_SPEEDS,
  ENEMY_DEATH_DURATION_MS,
  ENEMY_WALLPASS_CAPABILITIES,
  EnemyDirection,
  EnemyEntity,
  EnemyType,
  IEnemiesEngine,
  ONEAL_BURST_SPEED,
  SPAWN_EXCLUSION_MANHATTAN_DISTANCE,
} from './types';

/**
 * Authentic NES Bomberman (1985) Stage Enemy Rosters
 */
export const STAGE_ENEMY_ROSTERS: Readonly<Record<number, readonly EnemyType[]>> = {
  1: ['BALLOM', 'BALLOM', 'BALLOM', 'BALLOM', 'BALLOM', 'BALLOM'],
  2: ['BALLOM', 'BALLOM', 'BALLOM', 'ONEAL', 'ONEAL', 'ONEAL'],
  3: ['BALLOM', 'BALLOM', 'ONEAL', 'ONEAL', 'DAHL', 'DAHL'],
  4: ['BALLOM', 'ONEAL', 'DAHL', 'DAHL', 'MINVO', 'MINVO'],
  5: ['BALLOM', 'ONEAL', 'ONEAL', 'DAHL', 'DAHL', 'DAHL', 'MINVO', 'OVAPE'],
  6: ['BALLOM', 'ONEAL', 'DAHL', 'DAHL', 'DAHL', 'MINVO', 'MINVO', 'OVAPE'],
  7: ['ONEAL', 'ONEAL', 'DAHL', 'DAHL', 'DAHL', 'MINVO', 'MINVO', 'KONDORIA'],
  8: ['ONEAL', 'DAHL', 'DAHL', 'MINVO', 'MINVO', 'MINVO', 'MINVO', 'KONDORIA'],
  9: ['ONEAL', 'DAHL', 'MINVO', 'MINVO', 'MINVO', 'MINVO', 'OVAPE', 'KONDORIA'],
  10: ['ONEAL', 'DAHL', 'MINVO', 'OVAPE', 'KONDORIA', 'KONDORIA', 'KONDORIA', 'PONTAN'],
};

export class EnemiesEngine implements IEnemiesEngine {
  private _enemies: EnemyEntity[] = [];
  private enemyIdCounter = 0;
  private explosionKills = new Map<number, number>();

  public get activeEnemies(): readonly EnemyEntity[] {
    return this._enemies;
  }

  public get aliveCount(): number {
    let count = 0;
    for (let i = 0; i < this._enemies.length; i++) {
      if (this._enemies[i].state === 'ALIVE') {
        count++;
      }
    }
    return count;
  }

  public clearAll(): void {
    this._enemies = [];
    this.explosionKills.clear();
  }

  public getStageEnemyRoster(stage: number): readonly EnemyType[] {
    const s = Math.max(1, Math.floor(stage));
    if (s in STAGE_ENEMY_ROSTERS) {
      return STAGE_ENEMY_ROSTERS[s];
    }
    // Progression scaling for stages > 10
    return ['ONEAL', 'DAHL', 'MINVO', 'MINVO', 'OVAPE', 'KONDORIA', 'KONDORIA', 'PONTAN'];
  }

  public spawnEnemy(
    type: EnemyType,
    tx: number,
    ty: number,
    grid: IStageGridEngine
  ): EnemyEntity | null {
    // 1. Safe spawn exclusion zone: Manhattan distance < 5 from player spawn (1, 1)
    const dist = Math.abs(tx - 1) + Math.abs(ty - 1);
    if (dist < SPAWN_EXCLUSION_MANHATTAN_DISTANCE) {
      return null;
    }

    // 2. Bounds check
    if (!grid.isInBounds(tx, ty)) {
      return null;
    }

    const tile = grid.getTile(tx, ty);

    // Hard walls are always impassable for spawning
    if (tile === TileType.HARD_WALL) {
      return null;
    }

    const hasWallpass = ENEMY_WALLPASS_CAPABILITIES[type];

    // Non-wallpass enemies must spawn on EMPTY walkable tiles
    if (!hasWallpass) {
      if (tile !== TileType.EMPTY) {
        return null;
      }
    } else {
      // Wallpass ghost enemies may spawn in EMPTY or SOFT_BLOCK
      if (
        tile !== TileType.EMPTY &&
        tile !== TileType.SOFT_BLOCK &&
        tile !== TileType.SOFT_BLOCK_WITH_DOOR &&
        tile !== TileType.SOFT_BLOCK_WITH_POWERUP
      ) {
        return null;
      }
    }

    const enemy: EnemyEntity = {
      id: ++this.enemyIdCounter,
      type,
      x: tx * 16.0,
      y: ty * 16.0,
      direction: 'RIGHT',
      state: 'ALIVE',
      speed: ENEMY_BASE_SPEEDS[type],
      hasWallpass,
      baseScore: ENEMY_BASE_SCORES[type],
      deathTimerMs: 0,
    };

    this._enemies.push(enemy);
    return enemy;
  }

  public spawnStageEnemies(
    stage: number,
    grid: IStageGridEngine,
    rng: () => number = Math.random
  ): readonly EnemyEntity[] {
    this.clearAll();
    const roster = this.getStageEnemyRoster(stage);

    // Collect qualified interior candidate tiles outside safe spawn zone
    const candidates: { x: number; y: number }[] = [];
    for (let y = 1; y < 12; y++) {
      for (let x = 1; x < 30; x++) {
        const dist = Math.abs(x - 1) + Math.abs(y - 1);
        if (dist >= SPAWN_EXCLUSION_MANHATTAN_DISTANCE) {
          const tile = grid.getTile(x, y);
          if (tile !== TileType.HARD_WALL) {
            candidates.push({ x, y });
          }
        }
      }
    }

    // Shuffle candidate tiles with provided RNG
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const temp = candidates[i];
      candidates[i] = candidates[j];
      candidates[j] = temp;
    }

    let candIdx = 0;
    for (const enemyType of roster) {
      const hasWallpass = ENEMY_WALLPASS_CAPABILITIES[enemyType];
      let spawned = false;

      // Find an acceptable tile
      const startIdx = candIdx;
      while (candIdx < candidates.length) {
        const { x, y } = candidates[candIdx++];
        const tile = grid.getTile(x, y);

        if (!hasWallpass && tile === TileType.EMPTY) {
          this.spawnEnemy(enemyType, x, y, grid);
          spawned = true;
          break;
        } else if (hasWallpass && (tile === TileType.EMPTY || tile === TileType.SOFT_BLOCK)) {
          this.spawnEnemy(enemyType, x, y, grid);
          spawned = true;
          break;
        }
      }

      if (!spawned) {
        // Fallback: search from beginning of candidate pool
        for (let k = 0; k < startIdx; k++) {
          const { x, y } = candidates[k];
          const tile = grid.getTile(x, y);
          if (tile === TileType.EMPTY || (hasWallpass && tile === TileType.SOFT_BLOCK)) {
            this.spawnEnemy(enemyType, x, y, grid);
            break;
          }
        }
      }
    }

    return this._enemies;
  }

  public spawnPunishmentWave(
    grid: IStageGridEngine,
    player: IBombermanEntity,
    rng: () => number = Math.random
  ): readonly EnemyEntity[] {
    const spawned: EnemyEntity[] = [];
    const playerTile = player.centerTile;

    // Find 8 valid tiles at distance >= 5 from player
    const candidates: { x: number; y: number }[] = [];
    for (let y = 1; y < 12; y++) {
      for (let x = 1; x < 30; x++) {
        const dist = Math.abs(x - playerTile.x) + Math.abs(y - playerTile.y);
        if (dist >= 5) {
          const tile = grid.getTile(x, y);
          if (tile !== TileType.HARD_WALL) {
            candidates.push({ x, y });
          }
        }
      }
    }

    // Shuffle
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const temp = candidates[i];
      candidates[i] = candidates[j];
      candidates[j] = temp;
    }

    const count = Math.min(8, candidates.length);
    for (let i = 0; i < count; i++) {
      const { x, y } = candidates[i];
      const pontan = this.spawnEnemy('PONTAN', x, y, grid);
      if (pontan) {
        spawned.push(pontan);
      }
    }

    return spawned;
  }

  public update(
    deltaMs: number,
    player: IBombermanEntity,
    grid: IStageGridEngine,
    ordinance: IOrdinanceEngine
  ): void {
    const playerTile = player.centerTile;

    for (let i = this._enemies.length - 1; i >= 0; i--) {
      const enemy = this._enemies[i];

      if (enemy.state === 'DEAD') {
        this._enemies.splice(i, 1);
        continue;
      }

      if (enemy.state === 'DYING') {
        enemy.deathTimerMs += deltaMs;
        if (enemy.deathTimerMs >= ENEMY_DEATH_DURATION_MS) {
          enemy.state = 'DEAD';
          this._enemies.splice(i, 1);
        }
        continue;
      }

      // Enemy is ALIVE: advance movement with anti-tunneling snap to grid intersection
      this.stepEnemyMovement(enemy, playerTile, grid, ordinance);
    }
  }

  private stepEnemyMovement(
    enemy: EnemyEntity,
    playerTile: { x: number; y: number },
    grid: IStageGridEngine,
    ordinance: IOrdinanceEngine
  ): void {
    const rx = ((enemy.x % 16) + 16) % 16;
    const ry = ((enemy.y % 16) + 16) % 16;
    const isAtIntersection =
      (rx < 0.0001 || rx > 15.9999) && (ry < 0.0001 || ry > 15.9999);

    if (isAtIntersection) {
      // Normalize exact coordinates on grid
      enemy.x = Math.round(enemy.x / 16) * 16.0;
      enemy.y = Math.round(enemy.y / 16) * 16.0;

      const tx = Math.round(enemy.x / 16);
      const ty = Math.round(enemy.y / 16);
      const nextTx = tx + this.dirX(enemy.direction);
      const nextTy = ty + this.dirY(enemy.direction);

      if (!this.canEnemyPassTile(nextTx, nextTy, enemy, grid, ordinance)) {
        this.evaluateTurnAtIntersection(enemy, playerTile, grid, ordinance);
      }
    }

    const speed = enemy.speed;
    const dir = enemy.direction;

    if (dir === 'RIGHT') {
      const currentTx = Math.floor(enemy.x / 16);
      const targetX = (currentTx + 1) * 16.0;
      const dist = targetX - enemy.x;

      if (speed >= dist - 0.0001) {
        enemy.x = targetX;
        this.evaluateTurnAtIntersection(enemy, playerTile, grid, ordinance);
      } else {
        enemy.x += speed;
      }
    } else if (dir === 'LEFT') {
      const currentTx = Math.floor((enemy.x + 16 - 0.0001) / 16);
      const targetX = (currentTx - 1) * 16.0;
      const dist = enemy.x - targetX;

      if (speed >= dist - 0.0001) {
        enemy.x = targetX;
        this.evaluateTurnAtIntersection(enemy, playerTile, grid, ordinance);
      } else {
        enemy.x -= speed;
      }
    } else if (dir === 'DOWN') {
      const currentTy = Math.floor(enemy.y / 16);
      const targetY = (currentTy + 1) * 16.0;
      const dist = targetY - enemy.y;

      if (speed >= dist - 0.0001) {
        enemy.y = targetY;
        this.evaluateTurnAtIntersection(enemy, playerTile, grid, ordinance);
      } else {
        enemy.y += speed;
      }
    } else if (dir === 'UP') {
      const currentTy = Math.floor((enemy.y + 16 - 0.0001) / 16);
      const targetY = (currentTy - 1) * 16.0;
      const dist = enemy.y - targetY;

      if (speed >= dist - 0.0001) {
        enemy.y = targetY;
        this.evaluateTurnAtIntersection(enemy, playerTile, grid, ordinance);
      } else {
        enemy.y -= speed;
      }
    }
  }

  public canEnemyPassTile(
    tx: number,
    ty: number,
    enemy: EnemyEntity,
    grid: IStageGridEngine,
    ordinance: IOrdinanceEngine
  ): boolean {
    if (!grid.isInBounds(tx, ty)) return false;
    const tile = grid.getTile(tx, ty);
    if (tile === TileType.HARD_WALL) return false;

    // Solid bomb check
    if (ordinance.isBombAt(tx, ty)) return false;

    if (!enemy.hasWallpass) {
      if (
        tile === TileType.SOFT_BLOCK ||
        tile === TileType.SOFT_BLOCK_WITH_DOOR ||
        tile === TileType.SOFT_BLOCK_WITH_POWERUP ||
        tile === TileType.BURNING_BLOCK
      ) {
        return false;
      }
    }

    return true;
  }

  private evaluateTurnAtIntersection(
    enemy: EnemyEntity,
    playerTile: { x: number; y: number },
    grid: IStageGridEngine,
    ordinance: IOrdinanceEngine
  ): void {
    const tx = Math.round(enemy.x / 16);
    const ty = Math.round(enemy.y / 16);

    const canPass = (targetTx: number, targetTy: number) =>
      this.canEnemyPassTile(targetTx, targetTy, enemy, grid, ordinance);

    const forward = enemy.direction;
    const reverse = this.getOppositeDirection(forward);
    const [perp1, perp2] = this.getPerpendicularDirections(forward);

    const isForwardOpen = canPass(tx + this.dirX(forward), ty + this.dirY(forward));
    const isPerp1Open = canPass(tx + this.dirX(perp1), ty + this.dirY(perp1));
    const isPerp2Open = canPass(tx + this.dirX(perp2), ty + this.dirY(perp2));
    const isReverseOpen = canPass(tx + this.dirX(reverse), ty + this.dirY(reverse));

    // ONEAL burst check
    if (enemy.type === 'ONEAL') {
      const distToPlayer = Math.abs(tx - playerTile.x) + Math.abs(ty - playerTile.y);
      if (distToPlayer <= 5) {
        enemy.speed = ONEAL_BURST_SPEED; // 0.75 px/tick
      } else {
        enemy.speed = ENEMY_BASE_SPEEDS.ONEAL; // 0.5 px/tick
      }
    }

    // AI Direction Selection
    const openDirections: EnemyDirection[] = [];
    if (isForwardOpen) openDirections.push(forward);
    if (isPerp1Open) openDirections.push(perp1);
    if (isPerp2Open) openDirections.push(perp2);

    // Chasing Archetypes: MINVO, KONDORIA, PONTAN, or ONEAL in burst
    const isChaser =
      enemy.type === 'MINVO' ||
      enemy.type === 'KONDORIA' ||
      enemy.type === 'PONTAN' ||
      (enemy.type === 'ONEAL' && enemy.speed === ONEAL_BURST_SPEED);

    if (isChaser && (openDirections.length > 0 || isReverseOpen)) {
      const candidates = openDirections.length > 0 ? openDirections : [reverse];
      // Pick direction that minimizes Manhattan distance to player
      let bestDir = candidates[0];
      let bestDist = Infinity;

      for (const d of candidates) {
        const nextX = tx + this.dirX(d);
        const nextY = ty + this.dirY(d);
        const dScore = Math.abs(nextX - playerTile.x) + Math.abs(nextY - playerTile.y);
        if (dScore < bestDist) {
          bestDist = dScore;
          bestDir = d;
        }
      }

      enemy.direction = bestDir;
      return;
    }

    // Wandering Archetypes: BALLOM, DAHL, OVAPE
    if (openDirections.length > 0) {
      if (enemy.type === 'DAHL') {
        // DAHL prefers perpendicular turns
        const openPerps: EnemyDirection[] = [];
        if (isPerp1Open) openPerps.push(perp1);
        if (isPerp2Open) openPerps.push(perp2);

        if (openPerps.length > 0) {
          enemy.direction = openPerps[Math.floor(Math.random() * openPerps.length)];
          return;
        }
      }

      // Ballom / Ovape: 75% continue forward if open, otherwise turn
      if (isForwardOpen && Math.random() < 0.75) {
        enemy.direction = forward;
      } else {
        enemy.direction = openDirections[Math.floor(Math.random() * openDirections.length)];
      }
    } else if (isReverseOpen) {
      // Dead end: turnaround 180 degrees
      enemy.direction = reverse;
    }
  }

  public checkFlameCollisions(
    explosions: readonly Explosion[],
    player: IBombermanEntity
  ): readonly ComboKillResult[] {
    const results: ComboKillResult[] = [];

    for (const explosion of explosions) {
      for (const segment of explosion.segments) {
        const segMinX = segment.tx * 16;
        const segMaxX = segMinX + 16;
        const segMinY = segment.ty * 16;
        const segMaxY = segMinY + 16;

        for (const enemy of this._enemies) {
          if (enemy.state !== 'ALIVE') continue;

          // AABB overlap between Enemy (16x16) and Flame Segment (16x16)
          if (
            enemy.x < segMaxX &&
            enemy.x + 16 > segMinX &&
            enemy.y < segMaxY &&
            enemy.y + 16 > segMinY
          ) {
            // Register combo kill for this explosion
            const currentKills = this.explosionKills.get(explosion.id) ?? 0;
            const comboIndex = currentKills + 1;
            this.explosionKills.set(explosion.id, comboIndex);

            let multiplier = 1;
            if (comboIndex === 2) multiplier = 2;
            else if (comboIndex === 3) multiplier = 4;
            else if (comboIndex >= 4) multiplier = 8;

            const pointsAwarded = enemy.baseScore * multiplier;

            // Transition enemy to DYING
            enemy.state = 'DYING';
            enemy.deathTimerMs = 0;
            enemy.scoreAwarded = pointsAwarded;

            // Award points to player stats
            player.stats.score += pointsAwarded;

            results.push({
              enemyId: enemy.id,
              enemyType: enemy.type,
              comboIndex,
              multiplier,
              pointsAwarded,
            });
          }
        }
      }
    }

    return results;
  }

  public checkPlayerLethality(player: IBombermanEntity): boolean {
    if (player.state !== 'ALIVE' || player.isInvulnerable) {
      return false;
    }

    // Player inner vulnerability hitbox (12x12 centered at [x+2, y+2])
    const pMinX = player.x + 2;
    const pMaxX = player.x + 14;
    const pMinY = player.y + 2;
    const pMaxY = player.y + 14;

    for (const enemy of this._enemies) {
      if (enemy.state !== 'ALIVE') continue;

      // Enemy outer bounding box (16x16)
      if (
        enemy.x < pMaxX &&
        enemy.x + 16 > pMinX &&
        enemy.y < pMaxY &&
        enemy.y + 16 > pMinY
      ) {
        player.kill();
        return true;
      }
    }

    return false;
  }

  private dirX(dir: EnemyDirection): number {
    if (dir === 'LEFT') return -1;
    if (dir === 'RIGHT') return 1;
    return 0;
  }

  private dirY(dir: EnemyDirection): number {
    if (dir === 'UP') return -1;
    if (dir === 'DOWN') return 1;
    return 0;
  }

  private getOppositeDirection(dir: EnemyDirection): EnemyDirection {
    switch (dir) {
      case 'UP':
        return 'DOWN';
      case 'DOWN':
        return 'UP';
      case 'LEFT':
        return 'RIGHT';
      case 'RIGHT':
        return 'LEFT';
    }
  }

  private getPerpendicularDirections(dir: EnemyDirection): [EnemyDirection, EnemyDirection] {
    if (dir === 'UP' || dir === 'DOWN') {
      return ['LEFT', 'RIGHT'];
    }
    return ['UP', 'DOWN'];
  }
}

export function createEnemiesEngine(): IEnemiesEngine {
  return new EnemiesEngine();
}
