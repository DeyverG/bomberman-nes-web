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
  STAGE_SPAWN_INITIAL_MIN_DISTANCE,
} from './types';

/**
 * Authentic NES Bomberman (1985) Stage Enemy Rosters (Stages 1 to 50)
 */
export const STAGE_ENEMY_ROSTERS: Readonly<Record<number, readonly EnemyType[]>> = {
  1: ['BALLOM', 'BALLOM', 'BALLOM', 'BALLOM', 'BALLOM', 'BALLOM'],
  2: ['BALLOM', 'BALLOM', 'BALLOM', 'ONEAL', 'ONEAL', 'ONEAL'],
  3: ['BALLOM', 'BALLOM', 'ONEAL', 'ONEAL', 'DAHL', 'DAHL'],
  4: ['BALLOM', 'ONEAL', 'DAHL', 'DAHL', 'MINVO', 'MINVO'],
  5: ['ONEAL', 'ONEAL', 'ONEAL', 'ONEAL', 'DAHL', 'DAHL', 'DAHL'],
  6: ['ONEAL', 'ONEAL', 'DAHL', 'DAHL', 'MINVO', 'MINVO', 'KONDORIA'],
  7: ['ONEAL', 'ONEAL', 'DAHL', 'DAHL', 'DAHL', 'KONDORIA', 'KONDORIA'],
  8: ['ONEAL', 'DAHL', 'DAHL', 'MINVO', 'MINVO', 'MINVO', 'MINVO'],
  9: ['ONEAL', 'DAHL', 'MINVO', 'MINVO', 'MINVO', 'MINVO', 'KONDORIA'],
  10: ['ONEAL', 'DAHL', 'MINVO', 'KONDORIA', 'KONDORIA', 'KONDORIA', 'OVAPE'],
  11: ['ONEAL', 'DAHL', 'DAHL', 'MINVO', 'MINVO', 'MINVO', 'KONDORIA', 'OVAPE'],
  12: ['ONEAL', 'DAHL', 'MINVO', 'KONDORIA', 'KONDORIA', 'KONDORIA', 'KONDORIA', 'OVAPE'],
  13: ['DAHL', 'DAHL', 'DAHL', 'MINVO', 'MINVO', 'MINVO', 'KONDORIA', 'KONDORIA'],
  14: ['OVAPE', 'OVAPE', 'OVAPE', 'OVAPE', 'OVAPE', 'OVAPE', 'OVAPE', 'PASS'],
  15: ['DAHL', 'MINVO', 'MINVO', 'MINVO', 'KONDORIA', 'KONDORIA', 'KONDORIA', 'PASS'],
  16: ['MINVO', 'MINVO', 'MINVO', 'KONDORIA', 'KONDORIA', 'KONDORIA', 'KONDORIA', 'PASS'],
  17: ['DAHL', 'DAHL', 'DAHL', 'DAHL', 'DAHL', 'KONDORIA', 'KONDORIA', 'PASS'],
  18: ['BALLOM', 'BALLOM', 'BALLOM', 'ONEAL', 'ONEAL', 'ONEAL', 'PASS', 'PASS'],
  19: ['BALLOM', 'ONEAL', 'DAHL', 'DAHL', 'DAHL', 'OVAPE', 'PASS', 'PASS'],
  20: ['ONEAL', 'DAHL', 'MINVO', 'OVAPE', 'KONDORIA', 'KONDORIA', 'PASS', 'PASS'],
  21: ['OVAPE', 'OVAPE', 'OVAPE', 'KONDORIA', 'KONDORIA', 'KONDORIA', 'KONDORIA', 'PASS', 'PASS'],
  22: ['DAHL', 'DAHL', 'DAHL', 'DAHL', 'MINVO', 'MINVO', 'MINVO', 'KONDORIA', 'PASS'],
  23: ['DAHL', 'DAHL', 'MINVO', 'MINVO', 'OVAPE', 'OVAPE', 'KONDORIA', 'KONDORIA', 'PASS'],
  24: ['DAHL', 'MINVO', 'OVAPE', 'OVAPE', 'KONDORIA', 'KONDORIA', 'KONDORIA', 'KONDORIA', 'PASS'],
  25: ['ONEAL', 'ONEAL', 'DAHL', 'MINVO', 'OVAPE', 'OVAPE', 'KONDORIA', 'KONDORIA', 'PASS'],
  26: ['MINVO', 'MINVO', 'MINVO', 'OVAPE', 'OVAPE', 'KONDORIA', 'PASS', 'PASS'],
  27: ['DAHL', 'MINVO', 'MINVO', 'OVAPE', 'OVAPE', 'KONDORIA', 'PASS', 'PASS'],
  28: ['MINVO', 'MINVO', 'MINVO', 'MINVO', 'KONDORIA', 'KONDORIA', 'PASS', 'PASS'],
  29: ['DAHL', 'DAHL', 'MINVO', 'MINVO', 'OVAPE', 'KONDORIA', 'PASS', 'PONTAN'],
  30: ['MINVO', 'MINVO', 'OVAPE', 'OVAPE', 'KONDORIA', 'PASS', 'PASS', 'PONTAN'],
  31: ['MINVO', 'MINVO', 'MINVO', 'OVAPE', 'KONDORIA', 'PASS', 'PASS', 'PONTAN'],
  32: ['DAHL', 'DAHL', 'MINVO', 'MINVO', 'OVAPE', 'PASS', 'PASS', 'PONTAN'],
  33: ['MINVO', 'MINVO', 'MINVO', 'OVAPE', 'OVAPE', 'PASS', 'PASS', 'PONTAN'],
  34: ['MINVO', 'MINVO', 'OVAPE', 'OVAPE', 'KONDORIA', 'PASS', 'PASS', 'PONTAN'],
  35: ['OVAPE', 'OVAPE', 'OVAPE', 'KONDORIA', 'PASS', 'PASS', 'PASS', 'PONTAN'],
  36: ['MINVO', 'MINVO', 'OVAPE', 'KONDORIA', 'PASS', 'PASS', 'PASS', 'PONTAN'],
  37: ['MINVO', 'MINVO', 'OVAPE', 'OVAPE', 'PASS', 'PASS', 'PONTAN', 'PONTAN'],
  38: ['MINVO', 'MINVO', 'MINVO', 'KONDORIA', 'PASS', 'PASS', 'PONTAN', 'PONTAN'],
  39: ['OVAPE', 'OVAPE', 'KONDORIA', 'KONDORIA', 'PASS', 'PASS', 'PONTAN', 'PONTAN'],
  40: ['MINVO', 'MINVO', 'OVAPE', 'KONDORIA', 'PASS', 'PASS', 'PONTAN', 'PONTAN'],
  41: ['OVAPE', 'OVAPE', 'OVAPE', 'KONDORIA', 'PASS', 'PASS', 'PONTAN', 'PONTAN'],
  42: ['MINVO', 'MINVO', 'OVAPE', 'PASS', 'PASS', 'PASS', 'PONTAN', 'PONTAN'],
  43: ['OVAPE', 'OVAPE', 'KONDORIA', 'PASS', 'PASS', 'PASS', 'PONTAN', 'PONTAN'],
  44: ['MINVO', 'OVAPE', 'OVAPE', 'PASS', 'PASS', 'PASS', 'PONTAN', 'PONTAN'],
  45: ['OVAPE', 'OVAPE', 'KONDORIA', 'PASS', 'PASS', 'PONTAN', 'PONTAN', 'PONTAN'],
  46: ['MINVO', 'MINVO', 'OVAPE', 'PASS', 'PASS', 'PONTAN', 'PONTAN', 'PONTAN'],
  47: ['OVAPE', 'OVAPE', 'KONDORIA', 'PASS', 'PASS', 'PONTAN', 'PONTAN', 'PONTAN'],
  48: ['OVAPE', 'OVAPE', 'PASS', 'PASS', 'PASS', 'PONTAN', 'PONTAN', 'PONTAN'],
  49: ['OVAPE', 'KONDORIA', 'PASS', 'PASS', 'PONTAN', 'PONTAN', 'PONTAN', 'PONTAN'],
  50: ['PASS', 'PASS', 'PASS', 'PASS', 'PONTAN', 'PONTAN', 'PONTAN', 'PONTAN'],
};

/**
 * Returns canonical trap enemy difficulty corresponding to stage:
 * Stage 1: ONEAL, Stage 2: DAHL, Stage 3: MINVO, Stage 4: KONDORIA,
 * Stage 5-6: OVAPE, Stage 7-9: PASS, Stage 10+: PONTAN.
 */
export function getTrapEnemyTypeForStage(stage: number): EnemyType {
  const s = Math.max(1, Math.floor(stage));
  if (s === 1) return 'ONEAL';
  if (s === 2) return 'DAHL';
  if (s === 3) return 'MINVO';
  if (s === 4) return 'KONDORIA';
  if (s === 5 || s === 6) return 'OVAPE';
  if (s >= 7 && s <= 9) return 'PASS';
  return 'PONTAN'; // Stage 10+
}

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

  public getAliveCount(): number {
    return this.aliveCount;
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
    return STAGE_ENEMY_ROSTERS[50];
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
      spawnImmunityMs: 0,
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

    // Rule 3: Safe spawn zone in Stage 1 and initial level spawns:
    // No enemy may spawn in row ty === 1 with tx < 8, nor in col tx === 1 with ty < 7
    // (prevents direct line of sight to player spawn (1, 1)).
    // Requires minimum Manhattan distance of >= 8 tiles from (1, 1),
    // falling back to >= 5 only if candidate pool is smaller than roster count.
    const isExcludedFromInitialSpawn = (x: number, y: number): boolean => {
      if (y === 1 && x < 8) return true;
      if (x === 1 && y < 7) return true;
      return false;
    };

    const getCandidates = (minDist: number) => {
      const list: { x: number; y: number }[] = [];
      for (let y = 1; y < 12; y++) {
        for (let x = 1; x < 30; x++) {
          if (isExcludedFromInitialSpawn(x, y)) continue;
          const dist = Math.abs(x - 1) + Math.abs(y - 1);
          if (dist >= minDist) {
            const tile = grid.getTile(x, y);
            if (tile !== TileType.HARD_WALL) {
              list.push({ x, y });
            }
          }
        }
      }
      return list;
    };

    let candidates = getCandidates(STAGE_SPAWN_INITIAL_MIN_DISTANCE);
    if (candidates.length < roster.length) {
      candidates = getCandidates(SPAWN_EXCLUSION_MANHATTAN_DISTANCE);
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

  public spawnTimeOutHorde(
    grid: IStageGridEngine,
    playerPos: { x: number; y: number } | IBombermanEntity,
    rng: () => number = Math.random
  ): readonly EnemyEntity[] {
    let pTileX = 1;
    let pTileY = 1;
    if ('centerTile' in playerPos) {
      pTileX = playerPos.centerTile.x;
      pTileY = playerPos.centerTile.y;
    } else if ('x' in playerPos && 'y' in playerPos) {
      pTileX = playerPos.x > 31 ? Math.floor(playerPos.x / 16) : Math.floor(playerPos.x);
      pTileY = playerPos.y > 13 ? Math.floor(playerPos.y / 16) : Math.floor(playerPos.y);
    }

    // Collect all non-hard-wall interior tiles respecting Manhattan distance >= 5
    // Including revealed door, powerups, edges, empty ground, and soft blocks
    const candidates: { x: number; y: number }[] = [];
    for (let y = 1; y < 12; y++) {
      for (let x = 1; x < 30; x++) {
        const dist = Math.abs(x - pTileX) + Math.abs(y - pTileY);
        if (dist >= 5) {
          const tile = grid.getTile(x, y);
          if (tile !== TileType.HARD_WALL) {
            candidates.push({ x, y });
          }
        }
      }
    }

    // Shuffle candidate tiles
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const temp = candidates[i];
      candidates[i] = candidates[j];
      candidates[j] = temp;
    }

    const spawned: EnemyEntity[] = [];
    const directions: EnemyDirection[] = ['RIGHT', 'UP', 'LEFT', 'DOWN'];
    const targetCount = 12;

    for (let i = 0; i < targetCount; i++) {
      if (candidates.length === 0) break;
      const coord = candidates[i % candidates.length];
      const dir = directions[i % directions.length];

      const pontan: EnemyEntity = {
        id: ++this.enemyIdCounter,
        type: 'PONTAN',
        x: coord.x * 16.0,
        y: coord.y * 16.0,
        direction: dir,
        state: 'ALIVE',
        speed: ENEMY_BASE_SPEEDS.PONTAN,
        hasWallpass: true,
        baseScore: ENEMY_BASE_SCORES.PONTAN,
        deathTimerMs: 0,
        spawnImmunityMs: 0,
      };

      this._enemies.push(pontan);
      spawned.push(pontan);
    }

    return spawned;
  }

  public spawnTrapWave(
    stage: number,
    tx: number,
    ty: number,
    rng: () => number = Math.random
  ): readonly EnemyEntity[] {
    const enemyType = getTrapEnemyTypeForStage(stage);
    return this.spawnFromTile(tx, ty, 8, enemyType, rng);
  }

  public spawnFromTile(
    doorTx: number,
    doorTy: number,
    count?: number,
    type?: EnemyType,
    rng: () => number = Math.random
  ): readonly EnemyEntity[] {
    const defaultTypes: EnemyType[] = ['ONEAL', 'MINVO', 'PONTAN'];
    // 4 to 8 enemies if count is not specified
    const numToSpawn = count ?? (Math.floor(rng() * 5) + 4);
    const directions: EnemyDirection[] = ['UP', 'RIGHT', 'DOWN', 'LEFT'];

    const spawned: EnemyEntity[] = [];
    for (let i = 0; i < numToSpawn; i++) {
      const enemyType = type ?? defaultTypes[Math.floor(rng() * defaultTypes.length)];
      const dir = directions[i % directions.length];

      const enemy: EnemyEntity = {
        id: ++this.enemyIdCounter,
        type: enemyType,
        x: doorTx * 16.0,
        y: doorTy * 16.0,
        direction: dir,
        state: 'ALIVE',
        speed: ENEMY_BASE_SPEEDS[enemyType],
        hasWallpass: ENEMY_WALLPASS_CAPABILITIES[enemyType],
        baseScore: ENEMY_BASE_SCORES[enemyType],
        deathTimerMs: 0,
        spawnImmunityMs: 520,
      };

      this._enemies.push(enemy);
      spawned.push(enemy);
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

      if (enemy.spawnImmunityMs > 0) {
        enemy.spawnImmunityMs = Math.max(0, enemy.spawnImmunityMs - deltaMs);
      }

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
    // Immediate 180° rebound when moving towards an active bomb (trapping mechanic)
    if (enemy.direction === 'RIGHT') {
      const targetTx = Math.floor(enemy.x / 16) + 1;
      const targetTy = Math.round(enemy.y / 16);
      if (ordinance.isBombAt(targetTx, targetTy)) {
        enemy.x = Math.floor(enemy.x / 16) * 16.0;
        enemy.direction = 'LEFT';
        return;
      }
    } else if (enemy.direction === 'LEFT') {
      const targetTx = Math.ceil(enemy.x / 16) - 1;
      const targetTy = Math.round(enemy.y / 16);
      if (ordinance.isBombAt(targetTx, targetTy)) {
        enemy.x = Math.ceil(enemy.x / 16) * 16.0;
        enemy.direction = 'RIGHT';
        return;
      }
    } else if (enemy.direction === 'DOWN') {
      const targetTx = Math.round(enemy.x / 16);
      const targetTy = Math.floor(enemy.y / 16) + 1;
      if (ordinance.isBombAt(targetTx, targetTy)) {
        enemy.y = Math.floor(enemy.y / 16) * 16.0;
        enemy.direction = 'UP';
        return;
      }
    } else if (enemy.direction === 'UP') {
      const targetTx = Math.round(enemy.x / 16);
      const targetTy = Math.ceil(enemy.y / 16) - 1;
      if (ordinance.isBombAt(targetTx, targetTy)) {
        enemy.y = Math.ceil(enemy.y / 16) * 16.0;
        enemy.direction = 'DOWN';
        return;
      }
    }

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

    // ONEAL burst check (persigue si está a <= 4 tiles)
    if (enemy.type === 'ONEAL') {
      const distToPlayer = Math.abs(tx - playerTile.x) + Math.abs(ty - playerTile.y);
      if (distToPlayer <= 4) {
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

    // Chasing Archetypes: MINVO, PASS, KONDORIA, PONTAN, or ONEAL in burst
    const isChaser =
      enemy.type === 'MINVO' ||
      enemy.type === 'PASS' ||
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
          if (enemy.spawnImmunityMs > 0) continue;

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

    // Both Bomberman and enemies have an 8x8px lethal core hurtbox centered at [pos + 4]
    // Collision condition: Math.abs(player.x - enemy.x) < 8 && Math.abs(player.y - enemy.y) < 8
    for (const enemy of this._enemies) {
      if (enemy.state !== 'ALIVE') continue;

      if (
        Math.abs(player.x - enemy.x) < 8 &&
        Math.abs(player.y - enemy.y) < 8
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
