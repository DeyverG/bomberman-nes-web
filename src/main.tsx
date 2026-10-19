import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import {
  HudShell,
  emitHudUpdate,
  emitSessionState,
} from './features/hud-shell';
import type { GameActionEvent } from './features/hud-shell/types';
import { createAudioEngine, IAudioEngine } from './core/audio';
import { createGameLoop, IGameLoop } from './core/loop';
import { createInputEngine, IInputEngine } from './core/input';
import {
  createStageGrid,
  StageGridRenderer,
  calculateCameraX,
  IStageGridEngine,
  TileType,
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

// 8-Bit Synthesized Audio Subsystem singleton
const audioEngine: IAudioEngine = createAudioEngine();

function emitAudioMute(isMuted: boolean): void {
  window.dispatchEvent(new CustomEvent('nes-bomberman:mute', { detail: { isMuted } }));
}

// Safe Web Audio unlock on initial user gesture (compliant with browser autoplay policies)
const unlockAudio = () => {
  audioEngine.unlock();
};
window.addEventListener('keydown', unlockAudio, { once: true });
window.addEventListener('click', unlockAudio, { once: true });
window.addEventListener('touchstart', unlockAudio, { once: true });

// Global Mute toggle via 'M' key
window.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.code === 'KeyM') {
    const isMuted = audioEngine.toggleMute();
    emitAudioMute(isMuted);
    e.preventDefault();
  }
});

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
let isPaused = false;
let currentStage = 1;
let stageTimeRemaining = 200;
let timerAccumulatorMs = 0;
let timeOutTriggered = false;

// Per-stage one-shot SFX tracking flags
let doorRevealedSoundPlayed = false;
let enemiesClearedSoundPlayed = false;
let playerDeathSoundPlayed = false;
let stepDistancePx = 0;

// Listen for session commands dispatched by HudShell
window.addEventListener('nes-bomberman:action', (e: Event) => {
  const customEvent = e as CustomEvent<GameActionEvent>;
  if (!customEvent.detail) return;

  const { action, stage, continueStats } = customEvent.detail;

  if (action === 'TOGGLE_MUTE') {
    const isMuted = audioEngine.toggleMute();
    emitAudioMute(isMuted);
    return;
  }

  if (action === 'TOGGLE_PAUSE') {
    if (isGameActive) {
      isPaused = !isPaused;
      audioEngine.playPause();
      if (isPaused) {
        audioEngine.pauseBgm();
      } else {
        audioEngine.resumeBgm();
      }
      emitSessionState({ state: 'PLAYING', isPaused });
    }
    return;
  }

  if (action === 'START_GAME') {
    currentStage = stage ?? 1;
    isGameActive = false;
    isPaused = false;
    audioEngine.unlock();
    audioEngine.playStageIntro();

    doorRevealedSoundPlayed = false;
    enemiesClearedSoundPlayed = false;
    playerDeathSoundPlayed = false;
    stepDistancePx = 0;

    // Support CONTINUE: restore permanent upgrades (bombs, flame, speed, score) with 3 lives
    if (continueStats) {
      player = createBomberman({
        lives: 3,
        score: continueStats.score ?? 0,
        maxBombs: continueStats.maxBombs ?? 1,
        flameRange: continueStats.flameRange ?? 1,
        hasSpeedUp: continueStats.hasSpeedUp ?? false,
      });
    } else if (currentStage === 1 || !player) {
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
    isPaused = false;
    audioEngine.playStageTheme();
  } else if (action === 'RESTART_TO_TITLE') {
    isGameActive = false;
    isPaused = false;
    audioEngine.stopAll();
    audioEngine.playTitleBgm();
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

      // Pause toggle (Enter / KeyP / Escape)
      if (inputEngine.isJustPressed('PAUSE')) {
        isPaused = !isPaused;
        audioEngine.playPause();
        if (isPaused) {
          audioEngine.pauseBgm();
        } else {
          audioEngine.resumeBgm();
        }
        emitSessionState({ state: 'PLAYING', isPaused });
        return;
      }

      if (isPaused) {
        return;
      }

      // Exact 1-second real clock accumulator (TIME = 200 down to 0)
      timerAccumulatorMs += fixedDeltaMs;
      while (timerAccumulatorMs >= 1000) {
        timerAccumulatorMs -= 1000;
        if (stageTimeRemaining > 0) {
          stageTimeRemaining -= 1;
          emitHudUpdate({ time: stageTimeRemaining });

          // TIME = 0:00: Clock stops at 0, Bomberman remains alive, spawns 12 Pontans
          if (stageTimeRemaining === 0 && !timeOutTriggered) {
            timeOutTriggered = true;
            enemiesEngine.spawnTimeOutHorde(stageGrid, player.centerTile);
          }
        }
      }

      // Plant Bomb on Space / KeyX
      if (inputEngine.isJustPressed('BOMB')) {
        const center = player.centerTile;
        const bomb = ordinanceEngine.placeBomb(center.x, center.y, player, stageGrid);
        if (bomb) {
          audioEngine.playPlaceBomb();
        }
      }

      // Manual Detonator Trigger on KeyZ (when player has detonator powerup)
      if (inputEngine.isJustPressed('DETONATE') && player.stats.hasDetonator) {
        const prevExp = ordinanceEngine.activeExplosions.length;
        ordinanceEngine.detonateOldestBomb(stageGrid, player);
        if (ordinanceEngine.activeExplosions.length > prevExp) {
          audioEngine.playExplosion();
        }
      }

      // Resolve primary and secondary direction (NES zero-diagonal + corridor turning)
      const directions = inputEngine.getDirections();

      // Advance player physics with corner-sliding, anti-tunneling snap, and solid bomb collision
      const prevPlayerX = player.x;
      const prevPlayerY = player.y;
      player.update(fixedDeltaMs, directions, stageGrid, null, ordinanceEngine);
      const deltaMoved = Math.abs(player.x - prevPlayerX) + Math.abs(player.y - prevPlayerY);
      if (player.isMoving && player.state === 'ALIVE') {
        stepDistancePx += deltaMoved;
        if (stepDistancePx >= 10) {
          stepDistancePx -= 10;
          audioEngine.playStep();
        }
      } else {
        stepDistancePx = 0;
      }

      // Advance ordinance (walk-off grace, fuse timers, explosions, and flame lethality)
      const prevExplosions = ordinanceEngine.activeExplosions.length;
      ordinanceEngine.update(fixedDeltaMs, player, stageGrid);
      if (ordinanceEngine.activeExplosions.length > prevExplosions) {
        audioEngine.playExplosion();
      }

      // Check if bomb flames struck DOOR_REVEALED or POWERUP_REVEALED (tile punishment spawn)
      const pendingTileSpawns = ordinanceEngine.consumePendingTileSpawns();
      for (const spawn of pendingTileSpawns) {
        enemiesEngine.spawnTrapWave(currentStage, spawn.tx, spawn.ty);
      }
      if (pendingTileSpawns.length === 0 && ordinanceEngine.consumePendingPunishmentWaves() > 0) {
        enemiesEngine.spawnPunishmentWave(stageGrid, player);
      }

      // Advance stage timers (480ms soft block disintegration)
      stageGrid.update(fixedDeltaMs);

      // Check if exit door was revealed by burning block completion
      if (!doorRevealedSoundPlayed && stageGrid.doorIndex >= 0) {
        const doorCoord = stageGrid.indexToCoord(stageGrid.doorIndex);
        if (stageGrid.getTile(doorCoord.x, doorCoord.y) === TileType.DOOR_REVEALED) {
          audioEngine.playDoorRevealed();
          doorRevealedSoundPlayed = true;
        }
      }

      // Advance mystery power-up invulnerability timer
      powerupEngine.update(fixedDeltaMs, player);

      // Check power-up collection on current tile
      const collectedPowerup = powerupEngine.checkPowerupPickup(player, stageGrid);
      if (collectedPowerup) {
        emitHudUpdate({ score: player.stats.score });
        audioEngine.playPowerup();
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

      // Check if all enemies were cleared in the stage
      if (enemiesEngine.aliveCount > 0) {
        enemiesClearedSoundPlayed = false;
      } else if (
        !enemiesClearedSoundPlayed &&
        enemiesEngine.aliveCount === 0 &&
        enemiesEngine.activeEnemies.length > 0
      ) {
        audioEngine.playAllEnemiesCleared();
        enemiesClearedSoundPlayed = true;
      }

      // Check enemy lethality against Bomberman
      enemiesEngine.checkPlayerLethality(player);
      if (player.state === 'DYING' && !playerDeathSoundPlayed) {
        audioEngine.stopBgm();
        audioEngine.playPlayerDeath();
        playerDeathSoundPlayed = true;
      }

      // Check Stage Clear via Exit Door (requires aliveCount === 0)
      const enemiesRemaining = enemiesEngine.getAliveCount();
      const doorResult = powerupEngine.checkDoorEntry(player, stageGrid, enemiesRemaining);
      if (doorResult && doorResult.type === 'STAGE_CLEARED') {
        isGameActive = false;
        audioEngine.playStageClear();

        // Authentic NES Bomberman: +1 Life upon clearing each stage
        player.stats.lives += 1;

        // Stage 50 completion: Trigger Victory screen
        if (currentStage >= 50) {
          emitHudUpdate({ score: player.stats.score, lives: player.stats.lives });
          emitSessionState({ state: 'VICTORY' });
          return;
        }

        currentStage = powerupEngine.advanceStage();

        // Save persistent progression to localStorage for CONTINUE
        try {
          const continueData = {
            stage: currentStage,
            maxBombs: player.stats.maxBombs,
            flameRange: player.stats.flameRange,
            hasSpeedUp: player.stats.hasSpeedUp,
            score: player.stats.score,
          };
          localStorage.setItem('nes_bomberman_continue', JSON.stringify(continueData));
          localStorage.setItem('nes_bomberman_stage', String(currentStage));
        } catch {
          // Safe fallback
        }

        doorRevealedSoundPlayed = false;
        enemiesClearedSoundPlayed = false;
        playerDeathSoundPlayed = false;

        // Trigger NES Stage Intro curtain
        emitSessionState({ state: 'STAGE_INTRO', stage: currentStage });
        audioEngine.playStageIntro();

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
          lives: player.stats.lives,
          time: stageTimeRemaining,
        });
        return;
      }

      // Handle Player Death cycle
      if (player.state === 'DEAD') {
        isGameActive = false;

        doorRevealedSoundPlayed = false;
        enemiesClearedSoundPlayed = false;
        playerDeathSoundPlayed = false;

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
          audioEngine.playStageIntro();
        } else {
          // No lives remaining: Game Over
          emitSessionState({ state: 'GAME_OVER', score: player.stats.score });
          audioEngine.playGameOver();
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
    audioEngine.stopAll();
  };
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <HudShell onCanvasReady={handleCanvasMount} />
  </React.StrictMode>
);
