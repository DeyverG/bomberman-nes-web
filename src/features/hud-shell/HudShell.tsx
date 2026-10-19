import React, { useRef, useEffect, useState } from 'react';
import type { HudShellProps } from './types';

export const NES_LOGICAL_WIDTH = 256;
export const NES_LOGICAL_CANVAS_HEIGHT = 208; // Exact playfield height (13 rows * 16px)
export const NES_LOGICAL_HUD_HEIGHT = 32;     // HUD logical height (2 rows * 16px)
export const NES_LOGICAL_TOTAL_HEIGHT = 240;  // 32px HUD + 208px Playfield = 240px (16:15 ratio)

export type ScaleMode = 'fit' | '2x' | '3x' | '4x';

export function emitHudUpdate(update: Partial<{ time: number; score: number; lives: number }>): void {
  window.dispatchEvent(new CustomEvent('nes-bomberman:hud', { detail: update }));
}

export const HudShell: React.FC<HudShellProps> = ({
  initialState = { time: 200, score: 0, lives: 2 },
  onCanvasReady,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [scaleMode, setScaleMode] = useState<ScaleMode>('fit');
  const [hudState, setHudState] = useState({
    time: initialState.time ?? 200,
    score: initialState.score ?? 0,
    lives: initialState.lives ?? 2,
  });

  useEffect(() => {
    const handleHudUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<Partial<{ time: number; score: number; lives: number }>>;
      if (customEvent.detail) {
        setHudState((prev) => ({ ...prev, ...customEvent.detail }));
      }
    };
    window.addEventListener('nes-bomberman:hud', handleHudUpdate);
    return () => window.removeEventListener('nes-bomberman:hud', handleHudUpdate);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Hard guarantee: Force nearest-neighbor filtering on 2D context
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = false;
    }

    if (onCanvasReady) {
      onCanvasReady(canvas);
    }
  }, [onCanvasReady]);

  const formattedScore = String(hudState.score).padStart(6, '0');
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
        className={`flex flex-col items-center overflow-hidden rounded-md border-4 border-neutral-800 bg-[var(--color-nes-black)] shadow-[0_0_50px_rgba(0,0,0,0.9)] transition-all duration-150 ${getScaleClass()}`}
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
        </div>
      </main>
    </div>
  );
};
