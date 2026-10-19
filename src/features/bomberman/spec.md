# Specification: Bomberman Player Entity & Corner-Sliding (`src/features/bomberman/`)

## 1. Architectural Scope & Decoupling
The `src/features/bomberman/` module governs the player entity, lifecycle state machine, sub-pixel physics, collision handling, and the authentic NES corner-sliding steering algorithm.
It operates in **pure TypeScript**, completely decoupled from React and DOM rendering. It interfaces with `stage-grid` exclusively through tile queries.

---

## 2. Coordinate System & World Bounds

### 2.1 Coordinate Convention
- **Bounding Box Size:** Exactly $16 \times 16\text{ pixels}$.
- **Position Vector $(x, y)$:**
  Represents the **top-left corner** of the entity's $16 \times 16\text{ px}$ bounding box in world space.
- **Center Vector:**
  $$\text{center} = (x + 8.0, \; y + 8.0)$$
- **Discrete Tile Occupancy:**
  The tile coordinate where Bomberman is centered (used for bomb placement, door exit, and power-up pickup) is:
  $$tx = \lfloor (x + 8) / 16 \rfloor, \quad ty = \lfloor (y + 8) / 16 \rfloor$$

### 2.2 Spawn Point & World Boundaries
- **Canonical Spawn Point:** Tile $(1, 1)$, corresponding to top-left coordinate:
  $$x_{\text{spawn}} = 16.0, \quad y_{\text{spawn}} = 16.0 \quad (\text{center at } 24.0, 24.0)$$
- **World Boundary Clamping:**
  Playfield spans columns $1$ to $29$ ($x \in [16, 464]$) and rows $1$ to $11$ ($y \in [16, 176]$).

---

## 3. Movement Physics & Speed Constants

### 3.1 Speed Values
- **Base Speed ($\text{BASE\_SPEED}$):**
  $$v_{\text{base}} = 1.0\text{ px/tick at 60 Hz} \quad (60.0\text{ px/second})$$
- **Speed-Up Speed ($\text{SPEED\_UP\_SPEED}$):**
  $$v_{\text{speedup}} = 1.5\text{ px/tick at 60 Hz} \quad (90.0\text{ px/second})$$
- Positions are stored as double-precision floating-point values ($x, y$). Render coordinates are truncated via $\lfloor x \rfloor, \lfloor y \rfloor$ to preserve pixel-perfect rasterization.

---

## 4. Tile Passability Predicate (`isTilePassableForPlayer`)

Rather than querying raw walkability directly, the engine evaluates passability through the player-aware predicate:
$$\text{isTilePassableForPlayer}(tx, ty, \text{grid}, \text{stats}): \text{boolean}$$
1. If $(tx, ty)$ is out of bounds $\implies \text{false}$.
2. If tile is `HARD_WALL` $\implies \text{false}$ (indestructible pillars and borders can never be traversed).
3. If tile is `SOFT_BLOCK`, `SOFT_BLOCK_WITH_DOOR`, `SOFT_BLOCK_WITH_POWERUP`, or `BURNING_BLOCK`:
   - If $\text{stats.wallpass} = \text{true} \implies \text{true}$.
   - Else $\implies \text{false}$.
4. If tile is `EMPTY`, `DOOR_REVEALED`, or `POWERUP_REVEALED` $\implies \text{true}$.

---

## 5. Leading Edge Collision Math & Snap-to-Tile (Anti-Tunneling at `1.5 px/tick`)

When moving at non-integer or fractional speeds like $\text{speed} = 1.5\text{ px/tick}$, halting when a wall is detected leaves Bomberman at a fractional distance (e.g., $0.5\text{px}$ or $1.0\text{px}$) from the wall. This breaks modulo-16 grid alignment ($x \pmod{16} \ne 0$) and impedes turning into perpendicular corridors.

To solve this, the engine calculates the **leading edge** and performs **exact tile snapping**:

### 5.1 Moving `UP`
- Target position: $\text{nextY} = y - s$.
- Target row: $ty_{\text{target}} = \lfloor \text{nextY} / 16 \rfloor$.
- If target tiles are blocked and no corner-slide occurs:
  $$\text{Snap: } y \leftarrow (ty_{\text{target}} + 1) \times 16$$
  *(Flushes top edge flush against the bottom edge of the row above).*

### 5.2 Moving `DOWN`
- Target position: $\text{nextY} = y + s$.
- Leading bottom edge: $\text{bottomY} = \text{nextY} + 16 - 0.0001$.
- Target row: $ty_{\text{target}} = \lfloor \text{bottomY} / 16 \rfloor$.
- If target tiles are blocked and no corner-slide occurs:
  $$\text{Snap: } y \leftarrow (ty_{\text{target}} - 1) \times 16$$
  *(Flushes bottom edge flush against the top edge of the row below).*

### 5.3 Moving `LEFT`
- Target position: $\text{nextX} = x - s$.
- Target column: $tx_{\text{target}} = \lfloor \text{nextX} / 16 \rfloor$.
- If target tiles are blocked and no corner-slide occurs:
  $$\text{Snap: } x \leftarrow (tx_{\text{target}} + 1) \times 16$$
  *(Flushes left edge flush against the right edge of the column to the left).*

### 5.4 Moving `RIGHT`
- Target position: $\text{nextX} = x + s$.
- Leading right edge: $\text{rightX} = \text{nextX} + 16 - 0.0001$.
- Target column: $tx_{\text{target}} = \lfloor \text{rightX} / 16 \rfloor$.
- If target tiles are blocked and no corner-slide occurs:
  $$\text{Snap: } x \leftarrow (tx_{\text{target}} - 1) \times 16$$
  *(Flushes right edge flush against the left edge of the column to the right).*

---

## 6. The Mathematical Corner-Sliding Algorithm

When the player moves in a cardinal direction towards a corridor between pillars, imperfect human alignment frequently results in clipping the edge of an adjacent pillar ($HARD\_WALL$). 
The original NES Bomberman implements **Corner-Sliding** (turn assistance): if the entity overlaps a pillar by less than or equal to a threshold, the engine automatically slides the player laterally into the open corridor instead of blocking them.

### 6.1 Tolerance Constant
$$\text{SLIDE\_THRESHOLD} = 6\text{ pixels}$$
Given tile width $16\text{px}$:
- An overlap of $\le 6\text{px}$ activates automatic corner sliding.
- An overlap of $> 6\text{px}$ (e.g. $8\text{px}$ head-on collision) blocks movement completely.

### 6.2 Vertical Movement (Moving UP or DOWN)
Let $x$ be the current horizontal position and $r_x = x \pmod{16}$ ($0 \le r_x < 16$):
1. **Perfect Alignment ($r_x = 0$):**
   The player occupies a single column $tx = x / 16$.
   If target tile $(tx, ty_{\text{target}})$ is passable, move vertically by speed $s$. If blocked, snap-to-tile.
2. **Imperfect Alignment ($r_x > 0$):**
   The player spans two columns: $tx_1 = \lfloor x / 16 \rfloor$ and $tx_2 = tx_1 + 1$.
   Let $T_1 = \text{isTilePassableForPlayer}(tx_1, ty_{\text{target}})$ and $T_2 = \text{isTilePassableForPlayer}(tx_2, ty_{\text{target}})$.
   - **Sub-case A: $T_1$ is Passable and $T_2$ is Blocked (Clipping right pillar):**
     Right-side overlap with pillar is $r_x$ pixels.
     - If $r_x \le \text{SLIDE\_THRESHOLD} = 6$:
       **Slide LEFT:** $x \leftarrow \max(tx_1 \times 16, x - s)$.
     - If $r_x > 6$: Head-on collision. Snap-to-tile vertically.
   - **Sub-case B: $T_1$ is Blocked and $T_2$ is Passable (Clipping left pillar):**
     Left-side overlap with pillar is $16 - r_x$ pixels ($r_x \ge 16 - 6 = 10$).
     - If $r_x \ge 10$:
       **Slide RIGHT:** $x \leftarrow \min(tx_2 \times 16, x + s)$.
     - If $r_x < 10$: Head-on collision. Snap-to-tile vertically.
   - **Sub-case C: Both $T_1$ and $T_2$ are Blocked:**
     Solid wall ahead. Snap-to-tile vertically.
   - **Sub-case D: Both $T_1$ and $T_2$ are Passable:**
     Clear passage. Move vertically by speed $s$.

### 6.3 Horizontal Movement (Moving LEFT or RIGHT)
Let $y$ be the current vertical position and $r_y = y \pmod{16}$ ($0 \le r_y < 16$):
1. **Perfect Alignment ($r_y = 0$):**
   The player occupies a single row $ty = y / 16$.
   If target tile $(tx_{\text{target}}, ty)$ is passable, move horizontally by speed $s$. If blocked, snap-to-tile.
2. **Imperfect Alignment ($r_y > 0$):**
   The player spans two rows: $ty_1 = \lfloor y / 16 \rfloor$ and $ty_2 = ty_1 + 1$.
   Let $T_1 = \text{isTilePassableForPlayer}(tx_{\text{target}}, ty_1)$ and $T_2 = \text{isTilePassableForPlayer}(tx_{\text{target}}, ty_2)$.
   - **Sub-case A: $T_1$ is Passable and $T_2$ is Blocked (Clipping bottom pillar):**
     Bottom overlap with pillar is $r_y$ pixels.
     - If $r_y \le \text{SLIDE\_THRESHOLD} = 6$:
       **Slide UP:** $y \leftarrow \max(ty_1 \times 16, y - s)$.
     - If $r_y > 6$: Head-on collision. Snap-to-tile horizontally.
   - **Sub-case B: $T_1$ is Blocked and $T_2$ is Passable (Clipping top pillar):**
     Top overlap with pillar is $16 - r_y$ pixels ($r_y \ge 10$).
     - If $r_y \ge 10$:
       **Slide DOWN:** $y \leftarrow \min(ty_2 \times 16, y + s)$.
     - If $r_y < 10$: Head-on collision. Snap-to-tile horizontally.
   - **Sub-case C: Both $T_1$ and $T_2$ are Blocked:**
     Solid wall ahead. Snap-to-tile horizontally.
   - **Sub-case D: Both $T_1$ and $T_2$ are Passable:**
     Clear passage. Move horizontally by speed $s$.

---

## 7. Dual-Axis Input Resolution & Corner Turning

Bomberman never moves diagonally at $\sqrt{2} \times \text{speed}$.
When the player holds both a horizontal and a vertical input concurrently:
1. The engine attempts to move along the **primary direction** (the direction with the latest press, or primary axis).
2. If the displacement along the primary direction is $0$ (blocked by a wall without sliding):
   The engine immediately evaluates movement along the **secondary direction** within the exact same tick.
3. This guarantees the player can hold `RIGHT + DOWN` against a wall, and Bomberman will instantly turn downward the exact tick a corridor becomes available.

---

## 8. Player State Machine & Lifecycle

```text
       [Init / Stage Start]
                |
                v
        +---------------+
        |   SPAWNING    | (Duration: 500ms, invulnerable)
        +---------------+
                |
                v (timer >= 500ms)
        +---------------+
        |     ALIVE     | <----------------+
        +---------------+                  |
                |                          | (lives > 0, respawn)
                | [hit by enemy / flame]   |
                v                          |
        +---------------+                  |
        |     DYING     | (1000ms spin)    |
        +---------------+                  |
                |                          |
                v (timer >= 1000ms)        |
        +---------------+                  |
        |     DEAD      | -----------------+
        +---------------+
```

### Transition Invariants
- `SPAWNING`:
  - Starts at $(x_{\text{spawn}}, y_{\text{spawn}}) = (16.0, 16.0)$.
  - Invulnerable to enemy touch and flame rays for $500\text{ms}$.
  - Automatically transitions to `ALIVE` upon timer expiration.
- `ALIVE`:
  - Fully controllable via input manager.
  - Can be killed if intersecting an enemy hitbox or explosion flame (unless `flamepass` powerup is active).
- `DYING`:
  - Input velocity forced to zero ($dx = 0, dy = 0$).
  - Lasts exactly **$1000\text{ ms}$** (death spin animation).
  - Invulnerable to further damage while in death sequence.
- `DEAD`:
  - Reached after $1000\text{ms}$ in `DYING`.
  - Decrements life counter: `lives = Math.max(0, lives - 1)`.
  - Emits `PLAYER_DIED` event with `remainingLives`.

---

## 9. Player Stats Data Structure
```typescript
interface PlayerStats {
  lives: number;           // Initial: 3
  score: number;           // Initial: 0
  maxBombs: number;        // Initial: 1
  activeBombs: number;     // Currently placed on stage
  flameRange: number;      // Initial: 1 (in tiles)
  speed: number;           // Initial: 1.0 (BASE_SPEED)
  hasSpeedUp: boolean;     // Initial: false
  hasDetonator: boolean;   // Initial: false
  wallpass: boolean;       // Can walk through soft blocks (Initial: false)
  flamepass: boolean;      // Immune to bomb flame (Initial: false)
  bombpass: boolean;       // Can walk through planted bombs (Initial: false)
}
```
