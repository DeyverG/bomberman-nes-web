# Specification: Enemy Subsystem & Artificial Intelligence (`src/features/enemies/`)

## 1. Architectural Scope & Decoupling
The `src/features/enemies/` module governs the catalog of 8 canonical NES Bomberman (1985) enemies, their spawn exclusion geometry, deterministic grid-aligned movement, AI pathfinding, simultaneous bomb kill combo scoring, death decay animations, and lethality against Bomberman.

In strict compliance with:
- **`screaming-game-arch`**: Module lives exclusively in `src/features/enemies/` with explicit domain contracts (`types.ts`, `spec.md`, `enemies.test.ts`).
- **`sdd-game-protocol`**: Phase 1 (Spec) and Phase 2 (Types & Unit Tests) ONLY. Phase 3 implementation is gated pending human architectural audit.
- **The React/Canvas Wall**: Pure TypeScript, zero React dependencies, zero DOM manipulation. All state updates operate at 60 FPS deterministic fixed ticks.

---

## 2. Canonical Enemy Catalog (NES Bomberman 1985)

| Enemy Type | Sprite / Appearance | Base Points | Speed (px/tick at 60Hz) | Wallpass (Soft Blocks)? | AI Archetype & Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`BALLOM`** | Orange spherical balloon | 100 | `0.375 px/tick` (22.5 px/s) | **NO** | Pure random walk. Low intelligence. Changes direction at open intersections randomly. |
| **`ONEAL`** | Blue onion-shaped creature | 200 | `0.5 px/tick` (30 px/s) / `0.75` burst | **NO** | Medium intelligence. Wanders randomly, but tracks player and accelerates to `0.75` when within $\le 4$ tiles Manhattan distance. |
| **`DAHL`** | Red spinning barrel | 400 | `0.625 px/tick` (37.5 px/s) | **NO** | Erratic movement. Frequently alternates perpendicular directions, bouncing off obstacles. |
| **`MINVO`** | Green aggressive face | 800 | `0.75 px/tick` (45 px/s) | **NO** | High intelligence. Direct path chase toward player. Turns immediately when player crosses corridor. |
| **`KONDORIA`** | Blue floating amoeba | 1000 | `0.25 px/tick` (15 px/s) | **YES** | Very slow, relentless ghost chaser. Ignores soft blocks, always paths toward player along the shortest Manhattan vector. |
| **`OVAPE`** | Purple ghost with eyes | 2000 | `0.375 px/tick` (22.5 px/s) | **YES** | Ghost phase. Freely traverses destructible soft blocks (`SOFT_BLOCK`, `SOFT_BLOCK_WITH_DOOR`, `SOFT_BLOCK_WITH_POWERUP`, `BURNING_BLOCK`). Blocked only by `HARD_WALL`. |
| **`PASS`** | Orange/yellow lion face | 4000 | `1.0 px/tick` (60 px/s) | **NO** | Ultra-fast aggressive predator. Chases player through open corridors without crossing soft blocks. |
| **`PONTAN`** | Orange spinning disc/sun | 8000 | `1.125 px/tick` (67.5 px/s) | **YES** | Super-fast ghost chaser. High lethality, rapid turn rate, phases through soft blocks. |

---

## 3. Spawn Exclusion Geometry & Candidate Pool

### 3.1 Player Safe Spawn Zone & Line-of-Sight Corridor
Bomberman spawns at tile $(1, 1)$, world coordinates $(16, 16)$.
To reproduce the authentic safe opening feeling of NES Bomberman:
1. **Initial Distance Threshold:** Enemies spawned at the start of a stage must maintain a Manhattan distance $\ge 8$ tiles from $(1, 1)$:
   $$\text{ManhattanDist}((tx, ty), (1, 1)) = |tx - 1| + |ty - 1| \ge 8$$
   *(Fallback to $\ge 5$ is permitted only if the qualifying tile pool has fewer candidates than the stage roster).*
2. **Line-of-Sight Exclusion Corridor:** No enemy may spawn on row $ty = 1$ with $tx < 8$, nor on column $tx = 1$ with $ty < 7$, preventing immediate horizontal or vertical line-of-sight rushes at $(1, 1)$.
3. **Mid-Stage Spawns (Penalties / Traps):** Minimum Manhattan distance $\ge 5$ tiles from Bomberman's current center tile.

### 3.2 Canonical NES 50-Stage Enemy Rosters (`STAGE_ENEMY_ROSTERS`)

| Stage | Enemy Roster | Total |
| :--- | :--- | :--- |
| **Stage 1** | `6 BALLOM` *(Strictly Balloms only)* | 6 |
| **Stage 2** | `3 BALLOM, 3 ONEAL` | 6 |
| **Stage 3** | `2 BALLOM, 2 ONEAL, 2 DAHL` | 6 |
| **Stage 4** | `1 BALLOM, 1 ONEAL, 2 DAHL, 2 MINVO` | 6 |
| **Stage 5** | `4 ONEAL, 3 DAHL` | 7 |
| **Stage 6** | `2 ONEAL, 2 DAHL, 2 MINVO, 1 KONDORIA` | 7 |
| **Stage 7** | `2 ONEAL, 3 DAHL, 2 KONDORIA` | 7 |
| **Stage 8** | `1 ONEAL, 2 DAHL, 4 MINVO` | 7 |
| **Stage 9** | `1 ONEAL, 1 DAHL, 4 MINVO, 1 KONDORIA` | 7 |
| **Stage 10** | `1 ONEAL, 1 DAHL, 1 MINVO, 3 KONDORIA, 1 OVAPE` | 7 |
| **Stage 11** | `1 ONEAL, 2 DAHL, 3 MINVO, 1 KONDORIA, 1 OVAPE` | 8 |
| **Stage 12** | `1 ONEAL, 1 DAHL, 1 MINVO, 4 KONDORIA, 1 OVAPE` | 8 |
| **Stage 13** | `3 DAHL, 3 MINVO, 2 KONDORIA` | 8 |
| **Stage 14** | `7 OVAPE, 1 PASS` | 8 |
| **Stages 15–49** | Progressively escalated compositions of `DAHL`, `MINVO`, `KONDORIA`, `OVAPE`, `PASS`, and `PONTAN`. | 8 |
| **Stage 50** | `4 PASS, 4 PONTAN` | 8 |

### 3.3 Canonical NES Punishment Mechanics: TIME = 0:00 (Pontan Horde) & Door/Powerup Trap

#### 3.3.1 Reloj en TIME = 0:00 (Horda Masiva de Pontans y Farming de Puntos)
- Cuando el temporizador de la fase (`stageTimeRemaining`) desciende a `0`, el reloj se detiene en `0` y Bomberman **NO muere automáticamente** (`player.state === 'ALIVE'`).
- Se activa la bandera `timeOutTriggered = true` (exactamente una sola vez por intento de nivel) y se invoca `enemies.spawnTimeOutHorde(grid, playerPos)`:
  - Genera una horda masiva de **12 enemigos `PONTAN`** (monedas rotatorias de 8000 puntos base, con `wallpass: true` y velocidad `1.125 px/tick`).
  - Aparecen distribuidos en coordenadas válidas del mapa (incluyendo la casilla de la puerta si ha sido revelada y los bordes del mapa), respetando estrictamente una distancia Manhattan $\ge 5$ respecto a la posición actual de Bomberman (`playerPos`) para garantizar margen de reacción táctica.
  - El jugador puede maniobrar, esquivar y detonar bombas para destruir a los `PONTAN`, obteniendo 8000 puntos base por cada uno más los multiplicadores de combo simultáneo ($1\times, 2\times, 4\times, 8\times$).
  - Una vez que todos los enemigos son derrotados (`enemies.getAliveCount() === 0`), Bomberman puede ingresar libremente a la puerta de salida para ganar la fase (`STAGE_CLEARED`).

#### 3.3.2 Trampa de la Puerta (`DOOR_REVEALED`) y del Power-Up (`POWERUP_REVEALED`)
- Cuando la llama de una explosión alcanza la casilla de una puerta revelada (`DOOR_REVEALED`):
  - La puerta **NO se destruye**.
  - Invoca `enemies.spawnTrapWave(stage, doorTx, doorTy)` -> `enemies.spawnFromTile(doorTx, doorTy, 8, enemyType)`.
  - Nacen **desde la misma coordenada exacta $(tx, ty)$** exactamente **8 enemigos escalados según el Stage**:
    - **Stage 1:** `8 ONEAL`
    - **Stage 2:** `8 DAHL`
    - **Stage 3:** `8 MINVO`
    - **Stage 4:** `8 KONDORIA`
    - **Stages 5–6:** `8 OVAPE`
    - **Stages 7–9:** `8 PASS`
    - **Stages 10+:** `8 PONTAN`
  - Los nuevos enemigos incrementan inmediatamente `aliveCount`, bloqueando la puerta de salida hasta que el jugador vuelva a eliminarlos a todos.
- Cuando la llama alcanza un potenciador revelado (`POWERUP_REVEALED`):
  - El ítem se calcina y desaparece, transformando la casilla en `TileType.EMPTY`.
  - También invoca `enemies.spawnTrapWave(stage, tx, ty)`, naciendo 8 enemigos escalados desde dicha coordenada $(tx, ty)$.

#### 3.3.3 Inmunidad de Nacimiento en Trampas (`spawnImmunityMs = 520`)
- Para evitar el exploit de que la misma explosión de $480\text{ ms}$ que detonó la trampa de la puerta o del power-up destruya instantáneamente a los 8 enemigos recién invocados en el mismo fotograma:
  - Todo enemigo instanciado vía `spawnFromTile` nace con `spawnImmunityMs = 520`.
  - Mientras `spawnImmunityMs > 0`, el enemigo no puede ser dañado ni destruido por ninguna flama (`checkFlameCollisions` lo ignora).
  - El contador se reduce con cada tick (`deltaMs`) hasta llegar a 0, garantizando que sobrevivan a la flama originaria y requieran combate activo.

### 3.4 Tile Qualification
- **Standard Enemies (`BALLOM`, `ONEAL`, `DAHL`, `MINVO`, `PASS`):**
  Must spawn on tiles that are `TileType.EMPTY` (walkable ground, no hard walls, no soft blocks).
- **Ghost Enemies (`KONDORIA`, `OVAPE`, `PONTAN`):**
  May spawn on `TileType.EMPTY` or inside `TileType.SOFT_BLOCK` tiles outside the exclusion zone.
- Coordinates at spawn are snapped exactly to tile pixel origin:
  $$x = tx \times 16.0, \quad y = ty \times 16.0$$

---

## 4. Grid-Aligned Movement & Intersection Turn Decision Algorithm

### 4.1 Strict Intersection Decisions
Enemies operate on a 16x16 grid coordinate system.
- An enemy evaluates direction changes **ONLY** when its pixel position is strictly aligned to the tile grid:
  $$(x \pmod{16} === 0) \land (y \pmod{16} === 0)$$
- Between intersections (e.g. $x \pmod{16} \neq 0$ or $y \pmod{16} \neq 0$), the enemy **MUST** continue moving along its current axis and direction vector at its assigned speed.
- Turn decisions are prohibited mid-tile.

### 4.2 Fractional Speeds & Anti-Tunneling Snap
Enemies with fractional speeds (e.g., $0.5$, $0.75$, $0.25$, $1.5$) must never overshoot an intersection:
- In each step with speed $s$:
  - If advancing by $s$ would cross a $16\text{px}$ boundary (e.g., $(pos + s) \ge (tile + 1) \times 16$ or $(pos - s) \le tile \times 16$), the movement snaps exactly to $tile \times 16$, and the intersection decision logic is executed.

### 4.3 Obstacle Collision & Direction Fallback
A tile $(tx, ty)$ is impassable for an enemy if:
1. `!grid.isInBounds(tx, ty)` $\implies$ Blocked.
2. `grid.getTile(tx, ty) === TileType.HARD_WALL` $\implies$ Blocked.
3. `grid.getTile(tx, ty)` is a soft block or burning block AND `enemy.hasWallpass === false` $\implies$ Blocked.
4. An active solid bomb occupies tile $(tx, ty)$ $\implies$ Blocked.

If an enemy faces an obstacle ahead at an intersection:
- It eliminates the blocked direction from its candidate list.
- If all forward and perpendicular directions are blocked, it reverses direction ($180^\circ$ turn).

### 4.4 Immediate Bomb Rebound (Enclosure Mechanic)
When a bomb is newly placed in front of an enemy moving towards tile $(targetTx, targetTy)$ (even mid-tile):
- The enemy **CANNOT enter the bomb tile**.
- It immediately snaps to the border of its current tile and reverses direction $180^\circ$ on that exact tick.
- This allows the player to trap enemies between two bombs or between a bomb and a wall.

### 4.5 AI State Tracking Counters (`EnemyEntity` & `EnemySnapshot`)
To reproduce authentic NES corridor sweeping without chaotic erratic turning:
1. `tilesWalkedInCurrentDir: number`:
   - Increments by $+1$ each time the enemy snaps to a new tile intersection along its current direction vector.
   - Resets strictly to $0$ whenever the enemy changes direction (including $180^\circ$ turnaround or perpendicular turns).
2. `reversalQuota: number`:
   - An integer quota assigned upon spawning and refreshed whenever direction changes.
   - For `DAHL`: randomly drawn in $[2, 4]$.
   - For `OVAPE`: randomly drawn in $[3, 6]$.
   - For all other archetypes: randomly drawn in $[2, 6]$.

### 4.6 Initial Spawn Axis Selection (`chooseInitialDirection`)
Upon spawning at $(tx, ty)$:
- Inspects which cardinal directions are passable (`UP`, `DOWN`, `LEFT`, `RIGHT`).
- When both horizontal (`LEFT`/`RIGHT`) and vertical (`UP`/`DOWN`) directions are available, chooses between the horizontal and vertical axis with equal 50/50 probability (`rng < 0.5`).
- Guarantees natural dispersion across horizontal and vertical corridors from the start of the level.

### 4.7 Canonical 8-Enemy Corridor Sweeping Decision Rules (NES 1985)

#### 1. `BALLOM` (Orange Balloon — $0.375\text{ px/tick}$, `wallpass: false`)
- **Corridor Inertia:** `BALLOM` **NEVER reverses ($180^\circ$) mid-corridor** while the tile ahead is open.
- **Crossing Check:** If the forward tile is open, it continues straight. Only when `tilesWalkedInCurrentDir >= 3` and passing through an intersection with open perpendiculars does it evaluate a modest **20% probability** of turning perpendicular (80% maintains forward momentum).
- **Obstacle Collision (End of Corridor):** If forward is blocked, splits **50% perpendicular** and **50% reverse ($180^\circ$)** when perpendiculars are available. In a dead-end, reverses 100%.

#### 2. `ONEAL` (Blue Onion — $0.5\text{ px/tick}$ base / $0.65\text{ px/tick}$ alert, `wallpass: false`)
- **Line-of-Sight Chasing (LOS):** If Bomberman is in the same row or column within $\le 8$ tiles without intervening obstacles or bombs, `ONEAL` accelerates to `ONEAL_BURST_SPEED = 0.65 px/tick` and steers directly toward the player.
- **Corridor Sweeping & Mid-Corridor Reversals:** In an open corridor, once `tilesWalkedInCurrentDir >= reversalQuota`:
  - With **45% probability**, reverses $180^\circ$ mid-corridor (or takes a perpendicular branch if closer to Bomberman).
  - With 55% probability, continues straight until hitting an obstacle.
- **Proximity Steering:** When within $\le 7$ tiles Manhattan distance of Bomberman, has a **65% probability** of picking an open axis that minimizes distance to the player.

#### 3. `DAHL` (Red Barrel — $0.625\text{ px/tick}$, `wallpass: false`)
- **Hyperkinetic Axis Alternation:** Rapidly sweeps corridors, constantly bouncing off walls.
- Upon colliding with an obstacle or reaching its quota of $2$ to $4$ tiles:
  - **70% probability** of turning into an open perpendicular corridor (alternating horizontal/vertical).
  - **25% probability** of reversing $180^\circ$.
  - **5% probability** of continuing straight if open.

#### 4. `MINVO` (Agile Green Face — $0.75\text{ px/tick}$, `wallpass: false`)
- **Relentless Corridor Chase:**
  - If moving away from Bomberman along the current axis and `tilesWalkedInCurrentDir >= 2`, evaluates a **75% probability of immediately reversing ($180^\circ$)** to reorient toward the player.
  - At any fork or intersection with an open branch approaching Bomberman, turns toward the player **80% of the time** (20% forward inertia).

#### 5. `KONDORIA` (Slow Ghost Amoeba — $0.25\text{ px/tick}$, `wallpass: true`)
- **Phasing Pathfinding:** Traverses `SOFT_BLOCK` freely, blocked strictly by `HARD_WALL` and active bombs.
- At odd grid intersections $(tx \pmod 2 \neq 0 \land ty \pmod 2 \neq 0)$ or every $2$ to $4$ tiles:
  - Evaluates Manhattan distance to Bomberman across all 4 cardinal directions.
  - With **85% probability**, steers along the vector that minimizes Manhattan distance to the player.

#### 6. `OVAPE` (Wandering Ghost — $0.375\text{ px/tick}$, `wallpass: true`)
- **Soft Block Patrolling:** Moves straight through `SOFT_BLOCK` tiles.
- Upon completing its quota of $3$ to $6$ tiles:
  - **30% probability** of reversing $180^\circ$.
  - **35% probability** of turning perpendicular (through blocks or open ground).
  - **35% probability** of continuing straight.
- At map perimeter or `HARD_WALL`: 50% turns perpendicular, 50% reverses.

#### 7 & 8. `PASS` ($1.0\text{ px/tick}$, `wallpass: false`) & `PONTAN` ($1.125\text{ px/tick}$, `wallpass: true`)
- **Elite Hunters with Instant Rear Detection:**
  - If Bomberman is behind the entity (reverse direction decreases Manhattan distance) and reverse is open:
    - Evaluates an immediate **90% probability of reversing ($180^\circ$) on the very next tile**.
  - At every fork or intersection:
    - Chooses the direction minimizing Manhattan distance to Bomberman with **90% accuracy** (10% momentum).
- `PASS` is bounded by `SOFT_BLOCK`, while `PONTAN` phases through `SOFT_BLOCK` along the direct line of sight.

---

## 5. Simultaneous Bomb Combo Kill Multipliers

In NES Bomberman (1985), incinerating multiple enemies with a single bomb explosion yields escalating combo multipliers:

$$\text{Multiplier}(k) = \begin{cases} 
1\times & \text{for } k = 1 \text{ (1st enemy)} \\
2\times & \text{for } k = 2 \text{ (2nd enemy)} \\
4\times & \text{for } k = 3 \text{ (3rd enemy)} \\
8\times & \text{for } k \ge 4 \text{ (4th+ enemy)} 
\end{cases}$$

$$\text{Points Awarded}(k) = \text{basePoints} \times \text{Multiplier}(k)$$

### Combo Reset Rule:
- Each bomb explosion event tracks its own kill count.
- The combo counter resets to 1 for distinct bomb detonations.
- Simultaneous kills occurring across overlapping flame segments in the same tick share the combo sequence.

---

## 6. Enemy Death Sequence (`DYING` State)

When an enemy's bounding box intersects an active explosion flame segment:
1. **State Transition:** The enemy immediately transitions from `'ALIVE'` to `'DYING'`.
2. **Speed Halting:** Movement is frozen ($\text{speed} = 0$, velocity $= (0, 0)$).
3. **Timer:** `deathTimerMs` runs for exactly **$600\text{ ms}$**.
4. **Visual Presentation:** Displays a dying animation and the awarded score value.
5. **Decay:** Upon reaching $600\text{ ms}$, the enemy transitions to `'DEAD'` and is removed from the active enemy collection.
6. **Immunity during Death:** Dying enemies cannot damage Bomberman and cannot be re-killed.

---

## 7. Lethality Against Bomberman

### 7.1 Hitbox Intersection Contract: Core 8x8 Hurtbox
- **Caja Física de Terreno ($16 \times 16\text{ px}$):**
  $[x, y, 16, 16]$ se utiliza exclusivamente para colisión física contra muros y bombas sólidas.
- **Hurtbox Letal Centrada ($8 \times 8\text{ px}$):**
  Tanto Bomberman como cada enemigo poseen un núcleo letal de $8\times 8\text{ px}$ centrado en su sprite:
  $$\text{Hurtbox}_{player} = [player.x + 4, player.x + 12] \times [player.y + 4, player.y + 12]$$
  $$\text{Hurtbox}_{enemy} = [enemy.x + 4, enemy.x + 12] \times [enemy.y + 4, enemy.y + 12]$$

### 7.2 Lethality Trigger
An enemy kills Bomberman if and only if:
1. `enemy.state === 'ALIVE'`.
2. `player.state === 'ALIVE'`.
3. `!player.isInvulnerable` (i.e. not in `SPAWNING`, not `DYING`, not `DEAD`, and `player.stats.invincibleTimerMs === 0`).
4. $\text{AABB}(\text{Hurtbox}_{enemy}, \text{Hurtbox}_{player}) \text{ is true}$, lo que equivale matemáticamente a:
   $$|player.x - enemy.x| < 8 \land |player.y - enemy.y| < 8$$

When all conditions are met:
- Triggers `player.kill()`.
- Emits player death sequence.
