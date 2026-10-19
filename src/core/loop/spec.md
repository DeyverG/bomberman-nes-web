# Specification: Fixed Timestep Engine (`src/core/loop/`)

## 1. Architectural Role & Decoupling
The `src/core/loop/` module provides a deterministic, monitor-Hz-independent time accumulator game loop. 
It operates strictly in pure TypeScript, with **ZERO React dependencies**, **ZERO DOM rendering logic**, and **ZERO game rules**. It acts as the heartbeat for the pure TS engine.

---

## 2. Mathematical Model & Fixed Timestep

### 2.1 Constants & Time Budget
- **Target Frequency ($f$):** $60.0\text{ Hz}$
- **Fixed Timestep ($\Delta t_{\text{fixed}}$):**
  $$\Delta t_{\text{fixed}} = \frac{1000\text{ ms}}{60} = 16.666666666666668\text{ ms}$$
- **Maximum Accumulated Delta ($\Delta t_{\text{max}}$):** $100.0\text{ ms}$ (Clamps "Spiral of Death" to at most 6 sub-ticks per RAF).

### 2.2 Time Accumulator Mechanics
Let $t_n$ be the current wall-clock timestamp (via `performance.now()`), and $t_{n-1}$ be the previous frame timestamp.
1. **Raw Delta Calculation:**
   $$\Delta t = t_n - t_{n-1}$$
2. **Spiral of Death Clamp:**
   $$\Delta t_{\text{clamped}} = \min(\Delta t, \Delta t_{\text{max}})$$
3. **Accumulator Integration:**
   $$\text{accumulator}_{n} = \text{accumulator}_{n-1} + \Delta t_{\text{clamped}}$$
4. **Simulation Step Loop:**
   While $\text{accumulator} \ge \Delta t_{\text{fixed}}$:
   - Execute `onUpdate(16.666666666666668)`
   - $\text{accumulator} \leftarrow \text{accumulator} - \Delta t_{\text{fixed}}$
5. **Alpha Calculation (Sub-frame Interpolation):**
   $$\alpha = \frac{\text{accumulator}}{\Delta t_{\text{fixed}}} \quad (0.0 \le \alpha < 1.0)$$
   - Execute `onRender(\alpha)`

### 2.3 Monitor Frequency Invariance
| Display Refresh Rate | RAF Interval (Avg) | Updates Per Frame | Accumulator Drift / Behavior |
| :--- | :--- | :--- | :--- |
| **60 Hz** | $16.67\text{ ms}$ | Exactly 1 | Accumulator hovers near 0ms |
| **120 Hz** | $8.33\text{ ms}$ | 0 or 1 (alternating) | Exactly 60 updates per second |
| **144 Hz** | $6.94\text{ ms}$ | 0 or 1 | Exactly 60 updates per second |
| **240 Hz** | $4.17\text{ ms}$ | 0 or 1 (fires every ~4 RAFs) | Exactly 60 updates per second |
| **Lag Spike (e.g. 2500ms)** | $2500\text{ ms}$ | Clamped to 6 | Prevents UI lockup / freezes |

---

## 3. State Machine & Transitions

```text
       [start()]
  +----------------+
  |    STOPPED     | <-------------------+
  +----------------+                     |
         |                               |
         v                               | [stop()]
  +----------------+                     |
  |    RUNNING     | --------------------+
  +----------------+                     |
    |            ^                       |
    | [pause()]  | [resume()]            |
    v            |                       |
  +----------------+                     |
  |     PAUSED     | --------------------+
  +----------------+
```

### Transition Invariants
- `start()`:
  - Valid from: `STOPPED`.
  - Action: Sets state to `RUNNING`, records initial $t_0$, initializes `accumulator = 0`, requests next animation frame.
- `pause()`:
  - Valid from: `RUNNING`.
  - Action: Sets state to `PAUSED`, cancels active RAF.
- `resume()`:
  - Valid from: `PAUSED`.
  - Action: Sets state to `RUNNING`, **resets $t_{n-1} = \text{performance.now()}$** without accumulating paused elapsed time (avoids huge jump catch-up), requests next animation frame.
- `stop()`:
  - Valid from: `RUNNING` or `PAUSED`.
  - Action: Sets state to `STOPPED`, cancels active RAF, resets accumulator to 0.

---

## 4. Edge Cases & Safety Constraints
1. **Negative or Zero $\Delta t$:**
   If $t_n \le t_{n-1}$ (due to precision quirks or system clock adjustment), $\Delta t$ is treated as $0$. Accumulator does not change.
2. **Hidden / Background Tab:**
   When the browser tab loses focus, RAF is throttled or suspended. When resumed, $\Delta t$ will be large. The $\Delta t_{\text{max}} = 100\text{ ms}$ clamp ensures the engine never executes hundreds of consecutive ticks.
3. **Deterministic Testing:**
   The loop engine must support an injectable time provider `timeProvider?: () => number` so unit tests can step time deterministically without relying on real-world async delays.
