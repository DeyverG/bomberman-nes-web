import React, { useRef, useEffect, useState } from 'react';
import type { HudShellProps, SessionData, SessionState } from './types';

export const NES_LOGICAL_WIDTH = 256;
export const NES_LOGICAL_CANVAS_HEIGHT = 208; // Exact playfield height (13 rows * 16px)
export const NES_LOGICAL_HUD_HEIGHT = 32;     // HUD logical height (2 rows * 16px)
export const NES_LOGICAL_TOTAL_HEIGHT = 240;  // 32px HUD + 208px Playfield = 240px (16:15 ratio)

export type ScaleMode = 'fit' | '2x' | '3x' | '4x';

export function emitHudUpdate(update: Partial<{ time: number; score: number; lives: number }>): void {
  window.dispatchEvent(new CustomEvent('nes-bomberman:hud', { detail: update }));
}

export function emitSessionState(data: SessionData): void {
  window.dispatchEvent(new CustomEvent('nes-bomberman:session', { detail: data }));
}

export function emitGameAction(
  action: 'START_GAME' | 'STAGE_READY' | 'RESTART_TO_TITLE',
  payload?: { stage?: number }
): void {
  window.dispatchEvent(new CustomEvent('nes-bomberman:action', { detail: { action, ...payload } }));
}

export const HudShell: React.FC<HudShellProps> = ({
  initialState = { time: 200, score: 0, lives: 2 },
  onCanvasReady,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [scaleMode, setScaleMode] = useState<ScaleMode>('fit');
  const [sessionState, setSessionState] = useState<SessionState>('TITLE_SCREEN');
  const [currentStage, setCurrentStage] = useState<number>(1);
  const [titleSelection, setTitleSelection] = useState<'START' | 'CONTINUE'>('START');
  const [topScore, setTopScore] = useState<number>(() => {
    const saved = localStorage.getItem('nes_bomberman_top_score');
    return saved ? parseInt(saved, 10) || 0 : 0;
  });

  const [hudState, setHudState] = useState({
    time: initialState.time ?? 200,
    score: initialState.score ?? 0,
    lives: initialState.lives ?? 2,
  });

  // Listen for decoupled HUD updates from TypeScript engine
  useEffect(() => {
    const handleHudUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<Partial<{ time: number; score: number; lives: number }>>;
      if (customEvent.detail) {
        setHudState((prev) => {
          const nextScore = customEvent.detail.score ?? prev.score;
          if (nextScore > topScore) {
            setTopScore(nextScore);
            localStorage.setItem('nes_bomberman_top_score', String(nextScore));
          }
          return { ...prev, ...customEvent.detail };
        });
      }
    };
    window.addEventListener('nes-bomberman:hud', handleHudUpdate);
    return () => window.removeEventListener('nes-bomberman:hud', handleHudUpdate);
  }, [topScore]);

  // Listen for session state changes triggered by engine (STAGE_INTRO, GAME_OVER, etc.)
  useEffect(() => {
    const handleSessionChange = (e: Event) => {
      const customEvent = e as CustomEvent<SessionData>;
      if (customEvent.detail) {
        const { state, stage, score } = customEvent.detail;
        if (typeof stage === 'number') {
          setCurrentStage(stage);
          localStorage.setItem('nes_bomberman_stage', String(stage));
        }
        if (typeof score === 'number' && score > topScore) {
          setTopScore(score);
          localStorage.setItem('nes_bomberman_top_score', String(score));
        }
        setSessionState(state);
      }
    };
    window.addEventListener('nes-bomberman:session', handleSessionChange);
    return () => window.removeEventListener('nes-bomberman:session', handleSessionChange);
  }, [topScore]);

  // 2200ms STAGE_INTRO Timer
  useEffect(() => {
    if (sessionState !== 'STAGE_INTRO') return;

    const timer = setTimeout(() => {
      setSessionState('PLAYING');
      emitGameAction('STAGE_READY', { stage: currentStage });
    }, 2200);

    return () => clearTimeout(timer);
  }, [sessionState, currentStage]);

  // Keyboard navigation for TITLE_SCREEN and GAME_OVER
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (sessionState === 'TITLE_SCREEN') {
        if (e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'KeyW' || e.code === 'KeyS') {
          setTitleSelection((prev) => (prev === 'START' ? 'CONTINUE' : 'START'));
          e.preventDefault();
        } else if (e.code === 'Enter' || e.code === 'Space') {
          let stageToStart = 1;
          if (titleSelection === 'CONTINUE') {
            const savedStage = parseInt(localStorage.getItem('nes_bomberman_stage') || '1', 10);
            stageToStart = savedStage > 0 ? savedStage : 1;
          }
          setCurrentStage(stageToStart);
          setSessionState('STAGE_INTRO');
          emitGameAction('START_GAME', { stage: stageToStart });
          e.preventDefault();
        }
      } else if (sessionState === 'GAME_OVER') {
        if (e.code === 'Enter' || e.code === 'Space') {
          setSessionState('TITLE_SCREEN');
          emitGameAction('RESTART_TO_TITLE');
          e.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sessionState, titleSelection]);

  // Mount canvas and forward context to engine with StrictMode cleanup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Hard guarantee: Force nearest-neighbor filtering on 2D context
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = false;
    }

    let cleanup: (() => void) | void;
    if (onCanvasReady) {
      cleanup = onCanvasReady(canvas);
    }

    return () => {
      if (typeof cleanup === 'function') {
        cleanup();
      }
    };
  }, [onCanvasReady]);

  const formattedScore = String(hudState.score).padStart(6, '0');
  const formattedTopScore = String(topScore).padStart(6, '0');
  const formattedTime = String(hudState.time);
  const formattedLives = String(hudState.lives);

  // Dynamic scale classes
  const getScaleClass = () => {
    switch (scaleMode) {
      case '2x':
        return 'w-[512px] h-[480px]';
      case '3x':
        return 'w-[768px] h-[720px]';
      case '4x':
        return 'w-[1024px] h-[960px]';
      case 'fit':
      default:
        return 'h-[min(92vh,960px)] aspect-[16/15] w-auto';
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-neutral-950 p-2 sm:p-4 select-none">
      {/* Scale Selector (Discrete UI outside playfield) */}
      <nav
        aria-label="Scale selector"
        className="absolute top-3 right-4 z-20 flex items-center space-x-1.5 rounded bg-neutral-900/90 px-2 py-1 text-[10px] font-mono text-neutral-400 border border-neutral-800 shadow-md backdrop-blur-sm"
      >
        <span className="text-neutral-500 mr-1 hidden sm:inline">SCALE:</span>
        {(['fit', '2x', '3x', '4x'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setScaleMode(mode)}
            className={`rounded px-1.5 py-0.5 uppercase transition-colors ${
              scaleMode === mode
                ? 'bg-neutral-700 text-white font-bold'
                : 'hover:text-neutral-200'
            }`}
          >
            {mode}
          </button>
        ))}
      </nav>

      {/* Unified NES Arcade Cabinet Container (Aspect Ratio 256:240 = 16:15) */}
      <main
        className={`relative flex flex-col items-center overflow-hidden rounded-md border-4 border-neutral-800 bg-[var(--color-nes-black)] shadow-[0_0_50px_rgba(0,0,0,0.9)] transition-all duration-150 ${getScaleClass()}`}
      >
        {/* NES Top HUD Bar (Logical height 32px -> Exactly 13.333% of 240px total height) */}
        <header
          className="flex h-[13.333%] w-full items-center justify-between px-4 sm:px-6 bg-[var(--color-nes-gray)] text-[var(--color-nes-black)] font-[family-name:var(--font-nes)] text-xs sm:text-sm md:text-base tracking-wider border-b-2 border-black"
          role="banner"
          aria-label="NES Bomberman HUD"
        >
          <div className="flex items-center space-x-2">
            <span className="font-bold">TIME</span>
            <span className="font-bold">{formattedTime}</span>
          </div>
          <div className="flex items-center">
            <span className="font-bold tracking-widest">{formattedScore}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="font-bold">LEFT</span>
            <span className="font-bold">{formattedLives}</span>
          </div>
        </header>

        {/* NES Viewport Canvas Mount (Logical height 208px -> Exactly 86.666% of 240px total height) */}
        <div className="relative flex h-[86.666%] w-full items-center justify-center bg-[var(--color-nes-black)]">
          <canvas
            ref={canvasRef}
            width={NES_LOGICAL_WIDTH}
            height={NES_LOGICAL_CANVAS_HEIGHT}
            className="block h-full w-full [image-rendering:pixelated] [image-rendering:crisp-edges]"
            style={{
              imageRendering: 'pixelated',
            }}
          />

          {/* OVERLAY 1: TITLE SCREEN (Classic NES Title Screen) */}
          {sessionState === 'TITLE_SCREEN' && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-between bg-black text-white p-4 font-[family-name:var(--font-nes)] tracking-wider">
              {/* Top High Score */}
              <div className="flex items-center space-x-3 text-xs sm:text-sm text-neutral-300 mt-2">
                <span className="text-[#f83800]">TOP</span>
                <span className="text-white tracking-widest">{formattedTopScore}</span>
              </div>

              {/* Pixel-Art BOMBERMAN Title Banner */}
              <div className="flex flex-col items-center my-auto">
                <div className="relative px-6 py-2 border-4 border-white bg-[#f83800] text-white shadow-[4px_4px_0px_#7c0800]">
                  <span className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-widest text-[#fcb088] drop-shadow-[2px_2px_0px_#000000]">
                    BOMBERMAN
                  </span>
                </div>
                <div className="mt-3 text-[10px] sm:text-xs text-[#00a800] tracking-widest">
                  ★ NES 1985 CLONE ★
                </div>
              </div>

              {/* Menu Options: START / CONTINUE */}
              <div className="flex flex-col space-y-2 text-xs sm:text-sm mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentStage(1);
                    setSessionState('STAGE_INTRO');
                    emitGameAction('START_GAME', { stage: 1 });
                  }}
                  className="flex items-center space-x-2 text-left cursor-pointer hover:text-yellow-400 focus:outline-none"
                >
                  <span className={titleSelection === 'START' ? 'text-white' : 'opacity-0'}>►</span>
                  <span className={titleSelection === 'START' ? 'text-yellow-300 font-bold' : 'text-neutral-400'}>
                    START
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const saved = parseInt(localStorage.getItem('nes_bomberman_stage') || '1', 10);
                    const stg = saved > 0 ? saved : 1;
                    setCurrentStage(stg);
                    setSessionState('STAGE_INTRO');
                    emitGameAction('START_GAME', { stage: stg });
                  }}
                  className="flex items-center space-x-2 text-left cursor-pointer hover:text-yellow-400 focus:outline-none"
                >
                  <span className={titleSelection === 'CONTINUE' ? 'text-white' : 'opacity-0'}>►</span>
                  <span className={titleSelection === 'CONTINUE' ? 'text-yellow-300 font-bold' : 'text-neutral-400'}>
                    CONTINUE
                  </span>
                </button>
              </div>

              {/* Copyright */}
              <div className="text-[9px] sm:text-[10px] text-neutral-400 mb-1">
                © 1985 HUDSON SOFT
              </div>
            </div>
          )}

          {/* OVERLAY 2: STAGE INTRO (2200ms black screen between stages) */}
          {sessionState === 'STAGE_INTRO' && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black font-[family-name:var(--font-nes)]">
              <span className="text-sm sm:text-base md:text-lg font-bold tracking-widest text-white animate-pulse">
                STAGE &nbsp;{currentStage}
              </span>
            </div>
          )}

          {/* OVERLAY 3: GAME OVER (NES Game Over curtain) */}
          {sessionState === 'GAME_OVER' && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black font-[family-name:var(--font-nes)] text-white p-4">
              <span className="text-lg sm:text-xl md:text-2xl font-bold tracking-widest text-[#f83800] mb-4 drop-shadow-[2px_2px_0px_#7c0800]">
                GAME OVER
              </span>
              <span className="text-[10px] sm:text-xs text-neutral-400 tracking-wider">
                PRESS ENTER TO CONTINUE
              </span>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
