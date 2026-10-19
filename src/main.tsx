import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import {
  HudShell,
  emitHudUpdate,
  emitSessionState,
} from './features/hud-shell';
import type { GameActionEvent } from './features/hud-shell/types';
import { createGameLoop, IGameLoop } from './core/loop';
import { createInputEngine, IInputEngine } from './core/input';
import {
  createStageGrid,
  StageGridRenderer,
  calculateCameraX,
  IStageGridEngine,
} from './features/stage-grid';
import {
  createBomberman,
  IBombermanEntity,
  BombermanRenderer,
} from './features/bomberman';
import {
  createOrdinanceEngine,
  IOrdinanceEngine,
  OrdinanceRenderer,
} from './features/ordinance';
import {
  createPowerupEngine,
  IPowerupEngine,
  PowerupsRenderer,
} from './features/powerups';
import {
  createEnemiesEngine,
  IEnemiesEngine,
  EnemiesRenderer,
} from './features/enemies';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Failed to find root element');
}

// Pure TypeScript engine singletons decoupled from React (The React/Canvas Wall)
let gameLoop: IGameLoop | null = null;
let inputEngine: IInputEngine | null = null;
let stageGrid: IStageGridEngine | null = null;
let player: IBombermanEntity | null = null;
let ordinanceEngine: IOrdinanceEngine | null = null;
let powerupEngine: IPowerupEngine | null = null;
let enemiesEngine: IEnemiesEngine | null = null;

let stageRenderer: StageGridRenderer | null = null;
let playerRenderer: BombermanRenderer | null = null;
let ordinanceRenderer: OrdinanceRenderer | null = null;
let powerupsRenderer: PowerupsRenderer | null = null;
let enemiesRenderer: EnemiesRenderer | null = null;

// Debug hitboxes state (toggled strictly via F2 at runtime)
let debugHitboxes = import.meta.env.VITE_DEBUG_HITBOXES === 'true';
window.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.code === 'F2') {
    debugHitboxes = !debugHitboxes;
    e.preventDefault();
  }
});

// Session & Gameplay flags
let isGameActive = false;
let currentStage = 1;
let stageTimeRemaining = 200;
let timerAccumulatorMs = 0;
let timeOutTriggered = false;

// Listen for session commands dispatched by HudShell
window.addEventListener('nes-bomberman:action', (e: Event) => {
  const customEvent = e as CustomEvent<GameActionEvent>;
  if (!customEvent.detail) return;

  const { action, stage } = customEvent.detail;

  if (action === 'START_GAME') {
    currentStage = stage ?? 1;
    isGameActive = false;

    // Reset player if starting from Stage 1
    if (currentStage === 1 || !player) {
      player = createBomberman();
    } else {
      player.resetToSpawn();
    }

    stageGrid = createStageGrid();
    ordinanceEngine = createOrdinanceEngine();
    powerupEngine = createPowerupEngine(currentStage);
    enemiesEngine = createEnemiesEngine();
    enemiesEngine.spawnStageEnemies(currentStage, stageGrid);

    stageTimeRemaining = 200;
    timerAccumulatorMs = 0;
    timeOutTriggered = false;

    emitHudUpdate({
      score: player.stats.score,
      lives: player.stats.lives,
      time: stageTimeRemaining,
    });
  } else if (action === 'STAGE_READY') {
    isGameActive = true;
  } else if (action === 'RESTART_TO_TITLE') {
    isGameActive = false;
  }
});

function handleCanvasMount(canvas: HTMLCanvasElement): () => void {
  // Prevent duplicate loops under React StrictMode double invocation
  if (gameLoop) {
    gameLoop.stop();
    gameLoop = null;
  }
  if (inputEngine) {
    inputEngine.detach();
    inputEngine = null;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  // Strict pixel art contract
  ctx.imageSmoothingEnabled = false;

  // 1. Initialize input manager and attach to window
  inputEngine = createInputEngine();
  inputEngine.attach(window);

  // 2. Initialize domain entities and renderers
  stageGrid = createStageGrid();
  player = createBomberman();
  ordinanceEngine = createOrdinanceEngine();
  powerupEngine = createPowerupEngine(currentStage);
  enemiesEngine = createEnemiesEngine();

  stageRenderer = new StageGridRenderer(ctx);
  playerRenderer = new BombermanRenderer(ctx);
  ordinanceRenderer = new OrdinanceRenderer(ctx);
  powerupsRenderer = new PowerupsRenderer(ctx);
  enemiesRenderer = new EnemiesRenderer(ctx);

  // Synchronize initial HUD values with player state
  emitHudUpdate({
    score: player.stats.score,
    lives: player.stats.lives,
    time: stageTimeRemaining,
  });

  // 3. Initialize fixed timestep game loop (60 FPS) with tab switch clamp
  gameLoop = createGameLoop(
    (fixedDeltaMs) => {
      // Game loop tick executes strictly when session is active (PLAYING)
      if (
        !isGameActive ||
        !inputEngine ||
        !player ||
        !stageGrid ||
        !ordinanceEngine ||
        !powerupEngine ||
        !enemiesEngine
      ) {
        return;
      }

      // Sample physical keyboard state and calculate rising/falling edges
      inputEngine.update();

      // Pause toggle
      if (inputEngine.isJustPressed('PAUSE')) {
        if (gameLoop?.state === 'RUNNING') {
          gameLoop.pause();
        } else if (gameLoop?.state === 'PAUSED') {
          gameLoop.resume();
        }
        return;
      }

      // Exact 1-second real clock accumulator (TIME = 200 down to 0)
      timerAccumulatorMs += fixedDeltaMs;
      while (timerAccumulatorMs >= 1000) {
        timerAccumulatorMs -= 1000;
        if (stageTimeRemaining > 0) {
          stageTimeRemaining -= 1;
          emitHudUpdate({ time: stageTimeRemaining });

          // TIME_OUT punishment: spawns 8 PONTAN enemies once when time runs out
          if (stageTimeRemaining === 0 && !timeOutTriggered) {
            timeOutTriggered = true;
            enemiesEngine.spawnPunishmentWave(stageGrid, player);
          }
        }
      }

      // Plant Bomb on Space / KeyX
      if (inputEngine.isJustPressed('BOMB')) {
        const center = player.centerTile;
        ordinanceEngine.placeBomb(center.x, center.y, player, stageGrid);
      }

      // Manual Detonator Trigger on KeyZ (when player has detonator powerup)
      if (inputEngine.isJustPressed('DETONATE') && player.stats.hasDetonator) {
        ordinanceEngine.detonateOldestBomb(stageGrid, player);
      }

      // Resolve primary and secondary direction (NES zero-diagonal + corridor turning)
      const directions = inputEngine.getDirections();

      // Advance player physics with corner-sliding, anti-tunneling snap, and solid bomb collision
      player.update(fixedDeltaMs, directions, stageGrid, null, ordinanceEngine);

      // Advance ordinance (walk-off grace, fuse timers, explosions, and flame lethality)
      ordinanceEngine.update(fixedDeltaMs, player, stageGrid);

      // Check if bomb flames struck DOOR_REVEALED or POWERUP_REVEALED (punishment spawn)
      if (ordinanceEngine.consumePendingPunishmentWaves() > 0) {
        enemiesEngine.spawnPunishmentWave(stageGrid, player);
      }

      // Advance stage timers (480ms soft block disintegration)
      stageGrid.update(fixedDeltaMs);

      // Advance mystery power-up invulnerability timer
      powerupEngine.update(fixedDeltaMs, player);

      // Check power-up collection on current tile
      const collectedPowerup = powerupEngine.checkPowerupPickup(player, stageGrid);
      if (collectedPowerup) {
        emitHudUpdate({ score: player.stats.score });
      }

      // Advance enemy AI, movement, and intersection turns
      enemiesEngine.update(fixedDeltaMs, player, stageGrid, ordinanceEngine);

      // Check enemy collisions against active bomb flames (awards 1x, 2x, 4x, 8x combos)
      const kills = enemiesEngine.checkFlameCollisions(
        ordinanceEngine.activeExplosions,
        player
      );
      if (kills.length > 0) {
        emitHudUpdate({ score: player.stats.score });
      }

      // Check enemy lethality against Bomberman
      enemiesEngine.checkPlayerLethality(player);

      // Check Stage Clear via Exit Door (requires aliveCount === 0)
      const enemiesRemaining = enemiesEngine.aliveCount;
      const doorResult = powerupEngine.checkDoorEntry(player, stageGrid, enemiesRemaining);
      if (doorResult && doorResult.type === 'STAGE_CLEARED') {
        isGameActive = false;
        currentStage = powerupEngine.advanceStage();

        // Trigger NES Stage Intro curtain
        emitSessionState({ state: 'STAGE_INTRO', stage: currentStage });

        // Setup next stage
        stageGrid = createStageGrid();
        player.resetToSpawn();
        ordinanceEngine.clear();
        enemiesEngine.spawnStageEnemies(currentStage, stageGrid);

        stageTimeRemaining = 200;
        timerAccumulatorMs = 0;
        timeOutTriggered = false;

        emitHudUpdate({
          score: player.stats.score,
          time: stageTimeRemaining,
        });
        return;
      }

      // Handle Player Death cycle
      if (player.state === 'DEAD') {
        isGameActive = false;

        if (player.stats.lives > 0) {
          // Strip temporary equipment and retain permanent stats
          powerupEngine.handlePlayerDeath(player);
          player.resetToSpawn();
          stageGrid = createStageGrid();
          ordinanceEngine.clear();
          enemiesEngine.spawnStageEnemies(currentStage, stageGrid);

          stageTimeRemaining = 200;
          timerAccumulatorMs = 0;
          timeOutTriggered = false;

          emitHudUpdate({ lives: player.stats.lives, time: stageTimeRemaining });
          emitSessionState({ state: 'STAGE_INTRO', stage: currentStage });
        } else {
          // No lives remaining: Game Over
          emitSessionState({ state: 'GAME_OVER', score: player.stats.score });
        }
      }
    },
    (_alpha) => {
      if (
        !stageRenderer ||
        !playerRenderer ||
        !ordinanceRenderer ||
        !powerupsRenderer ||
        !enemiesRenderer ||
        !stageGrid ||
        !player ||
        !ordinanceEngine ||
        !powerupEngine ||
        !enemiesEngine
      ) {
        return;
      }

      if (!isGameActive) {
        // Clear canvas with black when menu/curtain is showing
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        return;
      }

      // Calculate camera scroll centered on player's 16x16 bounding box center
      const cameraX = calculateCameraX(player.x + 8.0);

      // 1. Render stage world (ground, walls, bricks, exit door)
      stageRenderer.render(stageGrid, { cameraX, debugHitboxes });

      // 2. Render revealed power-up icons
      powerupsRenderer.render(powerupEngine, stageGrid, { cameraX, debugHitboxes });

      // 3. Render bombs and cross explosions
      ordinanceRenderer.render(ordinanceEngine, { cameraX, debugHitboxes });

      // 4. Render active enemies and crumbling/score popups
      enemiesRenderer.render(enemiesEngine, { cameraX, debugHitboxes });

      // 5. Render player sprite
      playerRenderer.render(player, { cameraX, debugHitboxes });
    }
  );

  gameLoop.start();

  return () => {
    gameLoop?.stop();
    gameLoop = null;
    inputEngine?.detach();
    inputEngine = null;
  };
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <HudShell onCanvasReady={handleCanvasMount} />
  </React.StrictMode>
);
