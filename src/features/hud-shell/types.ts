export interface HudState {
  time: number;
  score: number;
  lives: number;
}

export interface HudShellProps {
  initialState?: Partial<HudState>;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
}
