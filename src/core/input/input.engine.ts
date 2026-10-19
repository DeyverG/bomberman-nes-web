import type {
  CardinalDirection,
  IInputEngine,
  InputAction,
  KeyMapping,
} from './types';

export const DEFAULT_KEY_MAPPING: KeyMapping = {
  UP: ['ArrowUp', 'KeyW'],
  DOWN: ['ArrowDown', 'KeyS'],
  LEFT: ['ArrowLeft', 'KeyA'],
  RIGHT: ['ArrowRight', 'KeyD'],
  BOMB: ['KeyX', 'Space', 'KeyJ'],
  DETONATE: ['KeyZ', 'KeyK'],
  PAUSE: ['Enter', 'KeyP', 'Escape'],
};

export class InputEngine implements IInputEngine {
  private readonly keyToActions: Map<string, InputAction> = new Map();
  private readonly heldKeys: Set<string> = new Set();

  private currentDown: Set<InputAction> = new Set();
  private previousDown: Set<InputAction> = new Set();
  private justPressed: Set<InputAction> = new Set();
  private justReleased: Set<InputAction> = new Set();

  // Timestamps (in ticks or ms) to resolve latest-press precedence
  private directionTimestamps: Map<CardinalDirection, number> = new Map();
  private tickCounter = 0;

  private target: EventTarget | null = null;
  private keydownListener: ((e: Event) => void) | null = null;
  private keyupListener: ((e: Event) => void) | null = null;

  constructor(keyMapping: KeyMapping = DEFAULT_KEY_MAPPING) {
    for (const [action, keys] of Object.entries(keyMapping) as [InputAction, readonly string[]][]) {
      for (const key of keys) {
        this.keyToActions.set(key, action);
      }
    }
  }

  public update(): void {
    this.tickCounter++;
    this.justPressed.clear();
    this.justReleased.clear();

    // Map raw physical held keys into logical actions
    const nextDown = new Set<InputAction>();
    for (const key of this.heldKeys) {
      const action = this.keyToActions.get(key);
      if (action) {
        nextDown.add(action);
      }
    }

    // Edge transitions
    for (const action of nextDown) {
      if (!this.previousDown.has(action)) {
        this.justPressed.add(action);
        if (this.isCardinal(action)) {
          this.directionTimestamps.set(action, this.tickCounter);
        }
      }
    }

    for (const action of this.previousDown) {
      if (!nextDown.has(action)) {
        this.justReleased.add(action);
        if (this.isCardinal(action)) {
          this.directionTimestamps.delete(action);
        }
      }
    }

    this.currentDown = nextDown;
    this.previousDown = new Set(nextDown);
  }

  public isDown(action: InputAction): boolean {
    return this.currentDown.has(action);
  }

  public isJustPressed(action: InputAction): boolean {
    return this.justPressed.has(action);
  }

  public isJustReleased(action: InputAction): boolean {
    return this.justReleased.has(action);
  }

  public getDirection(): CardinalDirection | null {
    return this.getDirections().primary;
  }

  public getDirections(): {
    primary: CardinalDirection | null;
    secondary: CardinalDirection | null;
  } {
    // 1. Check active directions with opposite cancellation
    const up = this.isDown('UP');
    const down = this.isDown('DOWN');
    const left = this.isDown('LEFT');
    const right = this.isDown('RIGHT');

    let vertical: CardinalDirection | null = null;
    if (up && !down) vertical = 'UP';
    else if (down && !up) vertical = 'DOWN';

    let horizontal: CardinalDirection | null = null;
    if (left && !right) horizontal = 'LEFT';
    else if (right && !left) horizontal = 'RIGHT';

    // 2. Resolve cases
    if (!vertical && !horizontal) {
      return { primary: null, secondary: null };
    }
    if (vertical && !horizontal) {
      return { primary: vertical, secondary: null };
    }
    if (horizontal && !vertical) {
      return { primary: horizontal, secondary: null };
    }

    // Both vertical and horizontal are active: latest pressed takes precedence
    const vTime = this.directionTimestamps.get(vertical!) ?? 0;
    const hTime = this.directionTimestamps.get(horizontal!) ?? 0;

    if (vTime > hTime) {
      return { primary: vertical, secondary: horizontal };
    } else if (hTime > vTime) {
      return { primary: horizontal, secondary: vertical };
    } else {
      // Deterministic tie-breaker: Vertical > Horizontal
      return { primary: vertical, secondary: horizontal };
    }
  }

  public setVirtualKeyState(action: InputAction, isDown: boolean): void {
    // Pick the canonical key for this action
    let canonicalKey = '';
    for (const [key, act] of this.keyToActions) {
      if (act === action) {
        canonicalKey = key;
        break;
      }
    }
    if (!canonicalKey) canonicalKey = action;

    if (isDown) {
      this.heldKeys.add(canonicalKey);
    } else {
      this.heldKeys.delete(canonicalKey);
    }
  }

  public reset(): void {
    this.heldKeys.clear();
    this.currentDown.clear();
    this.previousDown.clear();
    this.justPressed.clear();
    this.justReleased.clear();
    this.directionTimestamps.clear();
  }

  public attach(target: EventTarget = window): void {
    this.detach();
    this.target = target;

    this.keydownListener = (e: Event) => {
      const keyboardEvent = e as KeyboardEvent;
      if (this.keyToActions.has(keyboardEvent.code)) {
        this.heldKeys.add(keyboardEvent.code);
        // Prevent browser page scrolling from arrow keys / space
        if (
          keyboardEvent.code.startsWith('Arrow') ||
          keyboardEvent.code === 'Space'
        ) {
          keyboardEvent.preventDefault?.();
        }
      }
    };

    this.keyupListener = (e: Event) => {
      const keyboardEvent = e as KeyboardEvent;
      if (this.keyToActions.has(keyboardEvent.code)) {
        this.heldKeys.delete(keyboardEvent.code);
      }
    };

    this.target.addEventListener('keydown', this.keydownListener);
    this.target.addEventListener('keyup', this.keyupListener);
  }

  public detach(): void {
    if (this.target) {
      if (this.keydownListener) {
        this.target.removeEventListener('keydown', this.keydownListener);
        this.keydownListener = null;
      }
      if (this.keyupListener) {
        this.target.removeEventListener('keyup', this.keyupListener);
        this.keyupListener = null;
      }
      this.target = null;
    }
    this.reset();
  }

  private isCardinal(action: InputAction): action is CardinalDirection {
    return action === 'UP' || action === 'DOWN' || action === 'LEFT' || action === 'RIGHT';
  }
}

/**
 * Factory helper for creating an input engine instance.
 */
export function createInputEngine(keyMapping?: KeyMapping): IInputEngine {
  return new InputEngine(keyMapping);
}
