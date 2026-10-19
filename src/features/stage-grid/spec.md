# Specification: Stage Grid Matrix Engine (`src/features/stage-grid/`)

## 1. Architectural Scope & Decoupling
The `stage-grid` domain manages the 2D collision matrix, spatial partitioning, tile buffer representation, procedural generation, camera scrolling, and destruction decay timers for NES Bomberman (1985).
It is written in **pure TypeScript**, completely decoupled from React, DOM, or Canvas rendering.

---

## 2. Grid Geometry & Coordinate Constraints

### 2.1 Dimensions & Constants
- **Base Tile Unit:** $16 \times 16\text{ pixels}$.
- **Stage Grid Dimensions (Canonical NES Bomberman 1985):**
  - Grid Columns ($\text{COLS}$): Exactly $31\text{ tiles}$ ($31 \times 16\text{ px} = 496\text{ px}$ world width).
  - Grid Rows ($\text{ROWS}$): Exactly $13\text{ tiles}$ ($13 \times 16\text{ px} = 208\text{ px}$ playfield height).
  - HUD Reservation: $32\text{ px}$ (top of the $256 \times 240\text{ px}$ native NES logical resolution: $32\text{ px (HUD)} + 208\text{ px (Playfield)} = 240\text{ px}$).
  - Logical Viewport: $256 \times 240\text{ px}$.
- **Total Tile Buffer Size:**
  $$N = 31 \times 13 = 403\text{ tiles}$$
- **Memory Representation (`Uint8Array`):**
  A contiguous flat `Uint8Array` of length $403\text{ bytes}$ representing the tile type of each coordinate. Fits directly into the CPU L1 cache.

### 2.2 Coordinate Transformations
1. **Tile Coordinate $(x, y)$ to 1D Buffer Index:**
   $$i = y \times \text{COLS} + x = y \times 31 + x \quad (0 \le x < 31, \; 0 \le y < 13)$$
2. **1D Buffer Index $i$ to Tile Coordinate $(x, y)$:**
   $$x = i \pmod{31}, \quad y = \lfloor i / 31 \rfloor$$
3. **World Pixel Coordinate $(p_x, p_y)$ to Tile Coordinate $(x, y)$:**
   $$x = \lfloor p_x / 16 \rfloor, \quad y = \lfloor p_y / 16 \rfloor$$
4. **Tile Coordinate to Pixel Bounding Box (AABB in World Space):**
   $$\text{AABB}(x, y) = \{ \text{x}: x \times 16, \; \text{y}: y \times 16, \; \text{width}: 16, \; \text{height}: 16 \}$$

### 2.3 Horizontal Viewport Camera Mathematics
Because the world is $496\text{ px}$ wide and the NES logical viewport is $256\text{ px}$ wide, the maximum camera scroll offset is:
$$\text{maxCameraX} = 496 - 256 = 240\text{ px}$$
The camera follows the player horizontally centered at $128\text{ px}$ (half of the $256\text{ px}$ viewport), clamped to world bounds:
$$\text{calculateCameraX}(p_x) = \text{clamp}(p_x - 128, 0, 240)$$
where:
$$\text{clamp}(v, \min, \max) = \max(\min, \min(\max, v))$$
- For $p_x \le 128$: $\text{cameraX} = 0$.
- For $p_x \ge 368$: $\text{cameraX} = 240$.
- For $128 < p_x < 368$: smoothly scrolls 1:1 with player movement.

---

## 3. Tile State Encodings

| Value | Identifier | Physical Nature | Walkable? | Flame Pass? | Destructible? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `0x00` | `EMPTY` | Air / Grass ground | Yes | Yes | No |
| `0x01` | `HARD_WALL` | Perimeter border or concrete pillar | No | No (stops ray) | No |
| `0x02` | `SOFT_BLOCK` | Destructible brick | No | No (absorbs ray) | Yes |
| `0x03` | `SOFT_BLOCK_WITH_DOOR` | Destructible brick concealing exit door | No | No (absorbs ray) | Yes |
| `0x04` | `SOFT_BLOCK_WITH_POWERUP` | Destructible brick concealing power-up | No | No (absorbs ray) | Yes |
| `0x05` | `DOOR_REVEALED` | Uncovered exit door | Yes | Yes | Immune (triggers enemy wave)|
| `0x06` | `POWERUP_REVEALED` | Uncovered power-up item | Yes | Yes | Yes (burns item + spawns enemy wave)|
| `0x07` | `BURNING_BLOCK` | Brick undergoing active disintegration | No | No (absorbing) | In decay |

---

## 4. Mathematical Laws & Generation Rules

### 4.1 Indestructible Perimeter Law
For any tile coordinate $(x, y)$:
$$\text{isBorder}(x, y) \iff (x = 0) \lor (x = 30) \lor (y = 0) \lor (y = 12)$$
Every boundary tile is unconditionally initialized as `HARD_WALL` (`0x01`). Total border tiles: $31 \times 2 + 11 \times 2 = 84\text{ tiles}$.

### 4.2 Mathematical Law of Fixed Pillars
For any interior tile ($1 \le x \le 29$ and $1 \le y \le 11$):
$$\text{isFixedPillar}(x, y) \iff (x \pmod 2 = 0) \land (y \pmod 2 = 0)$$
- Column indices with even numbers: $x \in \{2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28\}$ ($14$ columns).
- Row indices with even numbers: $y \in \{2, 4, 6, 8, 10\}$ ($5$ rows).
- Total fixed interior pillars:
  $$\text{Total Pillars} = 14 \times 5 = 70\text{ pillars}$$
Every pillar coordinate is strictly a `HARD_WALL` (`0x01`).

### 4.3 Bomberman Safe Spawn Invariant
Bomberman always spawns at tile $(1, 1)$.
The safe spawn zone is strictly defined as:
$$\mathcal{S}_{\text{spawn}} = \{ (1, 1), \; (1, 2), \; (2, 1) \}$$
**Invariant:**
$$\forall (x, y) \in \mathcal{S}_{\text{spawn}}, \quad \text{TileType}(x, y) = \text{EMPTY} \; (0x00)$$
*(Note: tile $(2, 2)$ is an even-even coordinate, hence naturally an indestructible pillar by Law 4.2. Leaving $(1, 1), (1, 2), (2, 1)$ empty guarantees Bomberman can move downward or rightward without entrapment).*

### 4.4 Soft Block Candidate Pool ($\mathcal{C}$) & Default Density
A tile $(x, y)$ is eligible to become a soft block if and only if:
1. $1 \le x \le 29$ and $1 \le y \le 11$ (inside perimeter)
2. $\neg \text{isFixedPillar}(x, y)$ (not a pillar)
3. $(x, y) \notin \mathcal{S}_{\text{spawn}}$ (outside safe spawn zone)

**Candidate Pool Exact Size Calculation:**
- Total interior tiles: $29 \times 11 = 319\text{ tiles}$.
- Fixed interior pillars: $70\text{ tiles}$.
- Safe spawn reserved tiles: $3\text{ tiles}$.
- **Eligible Candidate Pool Size ($|\mathcal{C}|$):**
  $$|\mathcal{C}| = 319 - 70 - 3 = 246\text{ tiles}$$

**Default Soft Blocks Count:**
$$\text{DEFAULT\_SOFT\_BLOCKS} = 60$$
Configurable in `StageGridConfig.softBlockCount` within $[2, 246]$.

---

## 5. Destruction Dynamics & Amnesia Bug Prevention

### 5.1 The Amnesia Bug & Solution
When `SOFT_BLOCK`, `SOFT_BLOCK_WITH_DOOR`, or `SOFT_BLOCK_WITH_POWERUP` is struck by flame, changing the buffer byte to `BURNING_BLOCK (0x07)` would erase what lies beneath if stored solely in the byte value.

**Architectural Solution:**
The stage engine maintains persistent metadata:
- `doorIndex: number` (1D buffer index of the door)
- `powerupIndex: number` (1D buffer index of the power-up)
- `activeBurningBlocks: Map<number, BurningBlockState>` tracking currently decaying blocks:
  ```typescript
  interface BurningBlockState {
    readonly tileIndex: number;
    readonly x: number;
    readonly y: number;
    elapsedMs: number;
    readonly totalDurationMs: number; // 480ms
    readonly targetType: TileType.EMPTY | TileType.DOOR_REVEALED | TileType.POWERUP_REVEALED;
  }
  ```
When detonate occurs at `(x, y)`:
1. `index = y * 31 + x`.
2. Target resolved via `doorIndex` and `powerupIndex`:
   - If `index === doorIndex`: `targetType = DOOR_REVEALED`.
   - Else if `index === powerupIndex`: `targetType = POWERUP_REVEALED`.
   - Else: `targetType = EMPTY`.
3. Tile byte set to `BURNING_BLOCK (0x07)`.
4. Burning block registered with `elapsedMs = 0` and `totalDurationMs = 480`.

### 5.2 Real Disintegration Duration & Visual Phases
In NES Bomberman (1985), brick disintegration lasts **$480\text{ ms}$** (~28-30 frames at 60 Hz).
It progresses through 4 distinct visual animation phases:
- **Phase 0:** $0\text{ ms} \le \text{elapsedMs} < 120\text{ ms}$
- **Phase 1:** $120\text{ ms} \le \text{elapsedMs} < 240\text{ ms}$
- **Phase 2:** $240\text{ ms} \le \text{elapsedMs} < 360\text{ ms}$
- **Phase 3:** $360\text{ ms} \le \text{elapsedMs} < 480\text{ ms}$
- **Resolution ($\ge 480\text{ ms}$):**
  Tile byte becomes `targetType` (`EMPTY`, `DOOR_REVEALED`, or `POWERUP_REVEALED`), and the entry is removed from active burning timers.

### 5.3 Explosion Impact on Revealed Special Tiles
1. **`DOOR_REVEALED` hit by explosion flame:**
   - Tile type **remains `DOOR_REVEALED`** (indestructible).
   - Engine emits detonation result `{ type: 'DOOR_HIT', spawnPunishmentEnemies: true, x, y }`.
2. **`POWERUP_REVEALED` hit by explosion flame:**
   - Tile transitions to `EMPTY` (item is destroyed).
   - Engine emits detonation result `{ type: 'POWERUP_DESTROYED', spawnPunishmentEnemies: true, x, y }`.
3. **`HARD_WALL` hit by explosion flame:**
   - Unaffected; flame ray halts.

---

## 6. Edge Cases & Boundary Safety
1. **Out-of-Bounds Protection:**
   `getTile(x, y)` returns `HARD_WALL` (`0x01`) for any $x < 0 \lor x \ge 31 \lor y < 0 \lor y \ge 13$.
2. **Deterministic PRNG:**
   Procedural distribution supports an optional seeded PRNG (`rng?: () => number`) for deterministic replay and testing.
