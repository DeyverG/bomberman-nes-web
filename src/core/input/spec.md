# Specification: Deterministic Input Polling Engine (`src/core/input/`)

## 1. Architectural Scope & Decoupling
The `src/core/input/` module provides a deterministic, zero-allocation input polling manager for NES Bomberman.
It is written in **pure TypeScript**, completely decoupled from React and DOM rendering. It translates low-level keyboard/gamepad events into normalized game actions, tracked per fixed timestep tick (60 FPS).

---

## 2. Key Mapping & Actions

### 2.1 Action Enum & Supported Key Codes
| InputAction | Primary Key | Secondary Key | Action Type | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `UP` | `ArrowUp` | `KeyW` | Level-triggered (Continuous) | Moves Bomberman North |
| `DOWN` | `ArrowDown` | `KeyS` | Level-triggered (Continuous) | Moves Bomberman South |
| `LEFT` | `ArrowLeft` | `KeyA` | Level-triggered (Continuous) | Moves Bomberman West |
| `RIGHT` | `ArrowRight` | `KeyD` | Level-triggered (Continuous) | Moves Bomberman East |
| `BOMB` | `KeyX` | `Space` / `KeyJ` | Edge-triggered (`justPressed`) | Plants a bomb on current tile |
| `DETONATE`| `KeyZ` | `KeyK` | Edge-triggered (`justPressed`) | Triggers remote detonator powerup |
| `PAUSE` | `Enter` | `KeyP` / `Escape` | Edge-triggered (`justPressed`) | Toggles game pause |

---

## 3. Polling Model & Edge Detection

### 3.1 Tick Cycle & State Calculation
The input manager is updated synchronously once per fixed tick ($\Delta t = 16.666\text{ms}$) via `input.update()`:
Let $A_t$ be the set of active inputs at tick $t$, and $A_{t-1}$ be the active set from tick $t-1$:
1. **Level State (`isDown`):**
   $$\text{isDown}(a) \iff a \in A_t$$
2. **Rising Edge (`isJustPressed`):**
   $$\text{isJustPressed}(a) \iff a \in A_t \land a \notin A_{t-1}$$
   *Crucial for bombs and pause: prevents rapid-firing multiple bombs in successive ticks when holding the button.*
3. **Falling Edge (`isJustReleased`):**
   $$\text{isJustReleased}(a) \iff a \notin A_t \land a \in A_{t-1}$$

---

## 4. Directional Resolution & NES Diagonal Ban

### 4.1 Opposite Direction Cancellation
In NES hardware, the D-pad physically prevents pressing opposite directions simultaneously. On keyboards, pressing both is possible:
- If `LEFT` and `RIGHT` are held concurrently:
  $$dx = 0$$
- If `UP` and `DOWN` are held concurrently:
  $$dy = 0$$

### 4.2 Strict Cardinal Movement (Zero Diagonal Movement)
NES Bomberman cannot move diagonally under any circumstances.
When both a horizontal input and a vertical input are held concurrently (e.g. `UP` + `RIGHT`):
- **Resolution Rule:** The axis with the **most recent rising edge** (latest `pressTimestamp`) takes precedence.
- If both directions were initiated simultaneously on the exact same frame:
  $$\text{Priority: Vertical} > \text{Horizontal} \quad (\text{Deterministic tie-breaker})$$
- Output `getDirection()` returns strictly one of: `'UP'`, `'DOWN'`, `'LEFT'`, `'RIGHT'`, or `null`.

---

## 5. Inversion of Control for Testing
To ensure 100% deterministic Vitest test execution without relying on browser `window` or real DOM events:
- The engine implements `setKeyState(action: InputAction, isDown: boolean): void` or accepts a mock event source.
- Allows unit tests to advance frames and assert exact edge triggers deterministically.
