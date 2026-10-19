import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { HudShell, emitHudUpdate } from './features/hud-shell';
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

let stageRenderer: StageGridRenderer | null = null;
let playerRenderer: BombermanRenderer | null = null;
let ordinanceRenderer: OrdinanceRenderer | null = null;
let powerupsRenderer: PowerupsRenderer | null = null;

// Debug hitboxes state (toggled strictly via F2 at runtime)
let debugHitboxes = import.meta.env.VITE_DEBUG_HITBOXES === 'true';
window.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.code === 'F2') {
    debugHitboxes = !debugHitboxes;
    e.preventDefault();
  }
});

// Stage clock state (200 seconds per level in NES Bomberman)
let remainingSeconds = 200;
let secondTimerMs = 0;

function handleCanvasMount(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Strict pixel art contract
  ctx.imageSmoothingEnabled = false;

  // 1. Initialize input manager and attach to window
  inputEngine = createInputEngine();
  inputEngine.attach(window);

  // 2. Initialize domain entities and renderers
  stageGrid = createStageGrid();
  player = createBomberman();
  ordinanceEngine = createOrdinanceEngine();
  powerupEngine = createPowerupEngine(1);

  stageRenderer = new StageGridRenderer(ctx);
  playerRenderer = new BombermanRenderer(ctx);
  ordinanceRenderer = new OrdinanceRenderer(ctx);
  powerupsRenderer = new PowerupsRenderer(ctx);

  // Synchronize initial HUD values with player state
  emitHudUpdate({
    score: player.stats.score,
    lives: player.stats.lives,
    time: remainingSeconds,
  });

  // 3. Initialize fixed timestep game loop (60 FPS)
  gameLoop = createGameLoop(
    (fixedDeltaMs) => {
      if (
        !inputEngine ||
        !player ||
        !stageGrid ||
        !ordinanceEngine ||
        !powerupEngine
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

      // Match countdown timer
      secondTimerMs += fixedDeltaMs;
      if (secondTimerMs >= 1000) {
        const passedSeconds = Math.floor(secondTimerMs / 1000);
        remainingSeconds = Math.max(0, remainingSeconds - passedSeconds);
        secondTimerMs %= 1000;
        emitHudUpdate({ time: remainingSeconds });

        if (remainingSeconds === 0 && player.state === 'ALIVE') {
          // Time out triggers lethality
          player.kill();
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

      // Advance stage timers (480ms soft block disintegration)
      stageGrid.update(fixedDeltaMs);

      // Advance mystery power-up invulnerability timer
      powerupEngine.update(fixedDeltaMs, player);

      // Check power-up collection on current tile
      const collectedPowerup = powerupEngine.checkPowerupPickup(player, stageGrid);
      if (collectedPowerup) {
        emitHudUpdate({ score: player.stats.score });
      }

      // Check Stage Clear via Exit Door (0 enemies alive for now)
      const enemiesRemaining = 0;
      const doorResult = powerupEngine.checkDoorEntry(player, stageGrid, enemiesRemaining);
      if (doorResult && doorResult.type === 'STAGE_CLEARED') {
        powerupEngine.advanceStage();
        stageGrid = createStageGrid();
        player.resetToSpawn();
        ordinanceEngine = createOrdinanceEngine();
        remainingSeconds = 200;
        secondTimerMs = 0;
        emitHudUpdate({
          score: player.stats.score,
          time: remainingSeconds,
        });
      }

      // Handle Player Death cycle
      if (player.state === 'DEAD') {
        if (player.stats.lives > 0) {
          powerupEngine.handlePlayerDeath(player);
          player.resetToSpawn();
          ordinanceEngine = createOrdinanceEngine();
          emitHudUpdate({ lives: player.stats.lives });
        }
      }
    },
    (_alpha) => {
      if (
        !stageRenderer ||
        !playerRenderer ||
        !ordinanceRenderer ||
        !powerupsRenderer ||
        !stageGrid ||
        !player ||
        !ordinanceEngine ||
        !powerupEngine
      ) {
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

      // 4. Render player sprite
      playerRenderer.render(player, { cameraX, debugHitboxes });
    }
  );

  gameLoop.start();
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <HudShell onCanvasReady={handleCanvasMount} />
  </React.StrictMode>
);
