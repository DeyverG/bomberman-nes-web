export type SessionState = 'TITLE_SCREEN' | 'STAGE_INTRO' | 'PLAYING' | 'GAME_OVER';

export interface HudState {
  time: number;
  score: number;
  lives: number;
}

export interface SessionData {
  state: SessionState;
  stage?: number;
  score?: number;
  time?: number;
  lives?: number;
  isPaused?: boolean;
}

export interface ContinueStats {
  maxBombs: number;
  flameRange: number;
  hasSpeedUp: boolean;
  score: number;
}

export interface GameActionEvent {
  action: 'START_GAME' | 'STAGE_READY' | 'RESTART_TO_TITLE' | 'TOGGLE_MUTE' | 'TOGGLE_PAUSE';
  stage?: number;
  continueStats?: ContinueStats;
}

export interface HudShellProps {
  initialState?: Partial<HudState>;
  onCanvasReady?: (canvas: HTMLCanvasElement) => (() => void) | void;
}
