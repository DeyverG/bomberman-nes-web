/**
 * Normalized game actions
 */
export type InputAction =
  | 'UP'
  | 'DOWN'
  | 'LEFT'
  | 'RIGHT'
  | 'BOMB'
  | 'DETONATE'
  | 'PAUSE';

/**
 * Cardinal directions for entity movement (Diagonal movement is forbidden in NES Bomberman)
 */
export type CardinalDirection = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

/**
 * Snapshot of active input states for the current frame
 */
export interface InputStateSnapshot {
  readonly down: ReadonlySet<InputAction>;
  readonly justPressed: ReadonlySet<InputAction>;
  readonly justReleased: ReadonlySet<InputAction>;
  readonly direction: CardinalDirection | null;
}

/**
 * Key mapping configuration dictionary
 */
export type KeyMapping = Record<InputAction, readonly string[]>;

/**
 * Public interface for Deterministic Input Polling Engine
 */
export interface IInputEngine {
  /**
   * Updates edge-detection state. Must be called once per fixed game loop tick (60 FPS).
   */
  update(): void;

  /**
   * Returns true if the action is currently held down.
   */
  isDown(action: InputAction): boolean;

  /**
   * Returns true only on the first frame the action was pressed.
   */
  isJustPressed(action: InputAction): boolean;

  /**
   * Returns true only on the frame the action was released.
   */
  isJustReleased(action: InputAction): boolean;

  /**
   * Returns the resolved active cardinal direction, or null if idle or cancelled.
   * Strictly enforces NES zero-diagonal law with latest-press precedence.
   */
  getDirection(): CardinalDirection | null;

  /**
   * Returns both primary (latest-press) and secondary cardinal directions when multiple axes are held.
   * Enables turning into perpendicular corridors the exact tick they become available.
   */
  getDirections(): {
    primary: CardinalDirection | null;
    secondary: CardinalDirection | null;
  };

  /**
   * Inversion of Control method for headless unit testing and synthetic input injection.
   */
  setVirtualKeyState(action: InputAction, isDown: boolean): void;

  /**
   * Resets all held and edge states to idle.
   */
  reset(): void;

  /**
   * Attaches DOM event listeners to a target (e.g. window).
   */
  attach(target?: EventTarget): void;

  /**
   * Detaches DOM event listeners to prevent memory leaks.
   */
  detach(): void;
}
