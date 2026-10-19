# Specification: Ordinance & Explosion System (`src/features/ordinance/`)

## 1. Architectural Scope & Decoupling
The `src/features/ordinance/` domain manages the lifecycle, physics, collision pass-through, cross-raycast propagation, chain reactions, and lethality of bombs and explosions for NES Bomberman (1985).
It is written in **pure TypeScript**, completely decoupled from React and DOM rendering. It interfaces with `stage-grid` for tile mutation/queries and with `bomberman` for plant triggers and lethality evaluation.

---

## 2. Bomb Placement & Lifecycle

### 2.1 Coordinate Calculation
A bomb is always aligned to the discrete tile grid $(tx, ty)$ based on the center of the entity that planted it:
$$tx = \lfloor (x + 8.0) / 16 \rfloor, \quad ty = \lfloor (y + 8.0) / 16 \rfloor$$
The bomb's world AABB bounding box is:
$$\text{AABB}_{\text{bomb}} = \{ \text{minX}: tx \times 16, \; \text{minY}: ty \times 16, \; \text{maxX}: tx \times 16 + 16, \; \text{maxY}: ty \times 16 + 16 \}$$

### 2.2 Planting Preconditions
A bomb can be successfully planted at $(tx, ty)$ if and only if all the following conditions are met:
1. **Bomb Capacity:** The planter's active bombs count is less than capacity:
   $$\text{activeBombs} < \text{player.stats.maxBombs}$$
2. **Tile Vacancy:** No active bomb currently occupies $(tx, ty)$:
   $$\forall b \in \text{activeBombs}, \quad \neg (b.tx = tx \land b.ty = ty)$$
3. **Walkable/Empty Ground:** The tile $(tx, ty)$ is not a `HARD_WALL`, `SOFT_BLOCK*`, or `BURNING_BLOCK`.

### 2.3 Fuse Durations & State Machine
- **Standard Fuse Duration ($\text{FUSE\_DURATION\_MS}$):** Exactly **$3000\text{ ms}$** (~180 frames at 60 Hz).
- **Bomb State Machine:**
  $$\text{PLANTED} \xrightarrow[\text{or Detonator / Chain Reaction}]{\Delta t \ge 3000\text{ms}} \text{DETONATING} \to \text{CLEARED}$$
- While in `PLANTED`:
  - `elapsedMs` advances by tick `deltaMs`.
  - Visual pulse animation cycles every $250\text{ms}$ (red, black, pulsating size).
  - If `player.stats.hasDetonator === true`, manual trigger instantly detonates the oldest active bomb.
  - If struck by an explosion flame from another bomb, instantly triggers a **Chain Reaction** on the same tick.

---

## 3. The "Walk-Off Grace" Invariant (Non-Trap Guarantee)

In classic Bomberman, planting a bomb directly underneath yourself must not instantly trap you inside the bomb's solid collision box.

### 3.1 Mechanics & State Invariant
1. When instantiated, the bomb is flagged with:
   $$\text{ownerPassThrough} = \text{true}$$
2. While $\text{ownerPassThrough} === \text{true}$:
   - The collision engine ignores this specific bomb when evaluating movement for its planter (Bomberman).
   - Bomberman can walk freely off the tile.
3. In each engine update tick, the engine tests 2D AABB intersection between Bomberman ($B_{\text{player}} = [x, y, x+16, y+16]$) and the bomb ($B_{\text{bomb}} = [tx \times 16, ty \times 16, tx \times 16 + 16, ty \times 16 + 16]$):
   $$\text{intersectsAABB}(B_{\text{player}}, B_{\text{bomb}}) \iff (\text{player.x} < B_{\text{bomb}}.\text{maxX}) \land (\text{player.x} + 16 > B_{\text{bomb}}.\text{minX}) \land (\text{player.y} < B_{\text{bomb}}.\text{maxY}) \land (\text{player.y} + 16 > B_{\text{bomb}}.\text{minY})$$
4. On the **very first tick** where $\neg \text{intersectsAABB}(B_{\text{player}}, B_{\text{bomb}})$:
   $$\text{ownerPassThrough} \leftarrow \text{false} \quad (\text{Permanent state mutation})$$
5. Once $\text{ownerPassThrough} === \text{false}$:
   - The bomb becomes a solid obstacle.
   - Bomberman cannot walk back onto tile $(tx, ty)$ unless `player.stats.bombpass === true`.

---

## 4. Cross Explosion Propagation (4-Way Discrete Raycasting)

When a bomb detonates at $(bx, by)$ with flame range $R = \text{player.stats.flameRange}$:

### 4.1 Propagation Algorithm
1. Instantiate central explosion core at $(bx, by)$ with segment type `CENTER`.
2. For each cardinal direction $D \in \{ \text{UP}, \text{DOWN}, \text{LEFT}, \text{RIGHT} \}$:
   - For step $s = 1$ to $R$:
     - Compute ray coordinate:
       - `UP`: $(rx, ry) = (bx, by - s)$
       - `DOWN`: $(rx, ry) = (bx, by + s)$
       - `LEFT`: $(rx, ry) = (bx - s, by)$
       - `RIGHT`: $(rx, ry) = (bx + s, by)$
     - Evaluate tile at $(rx, ry)$ against the **Raycast Collision Matrix**:

### 4.2 Raycast Collision Matrix
| Tile / Entity at $(rx, ry)$ | Ray Behavior | Flame Segment Generated? | Side Effect |
| :--- | :--- | :--- | :--- |
| **`HARD_WALL`** / Out of Bounds | `break` (Ray stops) | No | Wall completely immune. |
| **`SOFT_BLOCK*`** (Any brick) | `break` (Ray stops) | No | Calls `grid.detonateTile(rx, ry)` $\to$ begins $480\text{ms}$ decay. **Does not penetrate**. |
| **`BURNING_BLOCK`** | `break` (Ray stops) | No | Ray absorbed. Burning timer not restarted. |
| **Active Bomb** | `break` (Ray stops) | No | **Chain Reaction:** forces target bomb to detonate immediately. |
| **`DOOR_REVEALED`** | `break` (Ray stops) | Yes (Segment placed) | Calls `grid.detonateTile(rx, ry)` $\to$ spawns punishment enemies. |
| **`POWERUP_REVEALED`** | `break` (Ray stops) | Yes (Segment placed) | Calls `grid.detonateTile(rx, ry)` $\to$ incinerates powerup + spawns enemies. |
| **`EMPTY`** | Continue ray | Yes | Segment added (`BODY` if $s < R$, `END` if $s = R$). |

### 4.3 Flame Segment Types
- `CENTER`: Core tile $(bx, by)$.
- `HORIZONTAL_BODY`: Non-terminal segment along `LEFT` or `RIGHT`.
- `VERTICAL_BODY`: Non-terminal segment along `UP` or `DOWN`.
- `TOP_END`: Terminal flame tip pointing North.
- `BOTTOM_END`: Terminal flame tip pointing South.
- `LEFT_END`: Terminal flame tip pointing West.
- `RIGHT_END`: Terminal flame tip pointing East.

---

## 5. Flame Duration & Lethality

### 5.1 Active Duration
- **Duration ($\text{EXPLOSION\_DURATION\_MS}$):** Exactly **$480\text{ ms}$** (~30 frames at 60 Hz).
- Synchronized exactly with the $480\text{ms}$ disintegration of `BURNING_BLOCK`.
- Animates through 4 visual flame oscillation phases of $120\text{ms}$ each:
  - Phase 0 ($0\text{-}120\text{ms}$): Expanding orange/yellow blast.
  - Phase 1 ($120\text{-}240\text{ms}$): Maximum white/orange intensity.
  - Phase 2 ($240\text{-}360\text{ms}$): Oscillating red/yellow flames.
  - Phase 3 ($360\text{-}480\text{ms}$): Dissolving smoke sparks.

### 5.2 Lethality Collision
- Any entity intersecting an active flame segment tile during its $480\text{ms}$ window takes lethal damage.
- For Bomberman:
  - Tested against Bomberman's inner damage hitbox: $[x+2, y+2, x+14, y+14]$ ($12 \times 12\text{px}$).
  - If intersecting active flame and `player.stats.flamepass === false`:
    $$\text{player.kill}() \to \text{Transitions to DYING}$$
  - If `player.stats.flamepass === true`:
    Player is completely immune to bomb flames.
