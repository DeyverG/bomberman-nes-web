# Specification: Enemy Subsystem & Artificial Intelligence (`src/features/enemies/`)

## 1. Architectural Scope & Decoupling
The `src/features/enemies/` module governs the catalog of 7 canonical NES Bomberman (1985) enemies, their spawn exclusion geometry, deterministic grid-aligned movement, AI pathfinding, simultaneous bomb kill combo scoring, death decay animations, and lethality against Bomberman.

In strict compliance with:
- **`screaming-game-arch`**: Module lives exclusively in `src/features/enemies/` with explicit domain contracts (`types.ts`, `spec.md`, `enemies.test.ts`).
- **`sdd-game-protocol`**: Phase 1 (Spec) and Phase 2 (Types & Unit Tests) ONLY. Phase 3 implementation is gated pending human architectural audit.
- **The React/Canvas Wall**: Pure TypeScript, zero React dependencies, zero DOM manipulation. All state updates operate at 60 FPS deterministic fixed ticks.

---

## 2. Canonical Enemy Catalog (NES Bomberman 1985)

| Enemy Type | Sprite / Appearance | Base Points | Speed (px/tick at 60Hz) | Wallpass (Soft Blocks)? | AI Archetype & Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`BALLOM`** | Orange spherical balloon | 100 | `0.375 px/tick` (22.5 px/s) | **NO** | Pure random walk. Low intelligence. Changes direction at open intersections randomly. |
| **`ONEAL`** | Blue onion-shaped creature | 200 | `0.5 px/tick` (30 px/s) / `0.75` burst | **NO** | Medium intelligence. Wanders randomly, but tracks player and accelerates to `0.75` when within 5 tiles Manhattan distance. |
| **`DAHL`** | Red spinning barrel | 400 | `0.5 px/tick` (30 px/s) | **NO** | Erratic movement. Frequently alternates perpendicular directions, bouncing off obstacles. |
| **`MINVO`** | Green aggressive face | 800 | `0.75 px/tick` (45 px/s) | **NO** | High intelligence. Direct path chase toward player. Turns immediately when player crosses corridor. |
| **`OVAPE`** | Purple ghost with eyes | 1000 | `0.375 px/tick` (22.5 px/s) | **YES** | Ghost phase. Freely traverses destructible soft blocks (`SOFT_BLOCK`, `SOFT_BLOCK_WITH_DOOR`, `SOFT_BLOCK_WITH_POWERUP`, `BURNING_BLOCK`). Blocked only by `HARD_WALL`. |
| **`KONDORIA`** | Blue floating amoeba | 2000 | `0.25 px/tick` (15 px/s) | **YES** | Very slow, relentless ghost chaser. Ignores soft blocks, always paths toward player along the shortest Manhattan vector. |
| **`PONTAN`** | Orange spinning disc/sun | 8000 | `1.125 px/tick` (67.5 px/s) | **YES** | Super-fast ghost chaser. High lethality, rapid turn rate, phases through soft blocks. |

---

## 3. Spawn Exclusion Geometry & Candidate Pool

### 3.1 Player Safe Spawn Zone
Bomberman spawns at tile $(1, 1)$, world coordinates $(16, 16)$.
To prevent unfair instant deaths upon level start or respawn, enemies MUST NEVER spawn within a Manhattan distance $< 5$ tiles from player spawn:
$$\text{ManhattanDist}((tx, ty), (1, 1)) = |tx - 1| + |ty - 1| \ge 5$$

Any tile where $|tx - 1| + |ty - 1| < 5$ is strictly forbidden for enemy spawning.

### 3.2 Stage Enemy Roster Distribution Table (`getStageEnemyRoster(stage)`)

| Stage | Enemy Roster | Total Enemies |
| :--- | :--- | :--- |
| **Stage 1** | `6 BALLOM` | 6 |
| **Stage 2** | `3 BALLOM, 3 ONEAL` | 6 |
| **Stage 3** | `2 BALLOM, 2 ONEAL, 2 DAHL` | 6 |
| **Stage 4** | `1 BALLOM, 1 ONEAL, 2 DAHL, 2 MINVO` | 6 |
| **Stage 5** | `1 BALLOM, 2 ONEAL, 3 DAHL, 1 MINVO, 1 OVAPE` | 8 |
| **Stage 6** | `1 BALLOM, 1 ONEAL, 3 DAHL, 2 MINVO, 1 OVAPE` | 8 |
| **Stage 7** | `2 ONEAL, 3 DAHL, 2 MINVO, 1 KONDORIA` | 8 |
| **Stage 8** | `1 ONEAL, 2 DAHL, 4 MINVO, 1 KONDORIA` | 8 |
| **Stage 9** | `1 ONEAL, 1 DAHL, 4 MINVO, 1 OVAPE, 1 KONDORIA` | 8 |
| **Stage 10** | `1 ONEAL, 1 DAHL, 1 MINVO, 1 OVAPE, 3 KONDORIA, 1 PONTAN` | 8 |
| **Stage 11+** | Cyclic scaled progression containing high-tier ghosts (`OVAPE`, `KONDORIA`, `PONTAN`) | 8 |

### 3.3 Canonical NES Punishment Mechanics: TIME = 0:00 (Pontan Horde & Farming) & Door/Powerup Trap

#### 3.3.1 Reloj en TIME = 0:00 (Horda Masiva de Pontans y Farming de Puntos)
- Cuando el temporizador de la fase (`stageTimeRemaining`) desciende a `0`, el reloj se detiene en `0` y Bomberman **NO muere automáticamente**. Bomberman permanece con vida (`player.state === 'ALIVE'`).
- Se activa la bandera `timeOutTriggered = true` (exactamente una sola vez por intento de nivel) y se invoca `enemies.spawnTimeOutHorde(grid, playerPos)`:
  - Genera una horda masiva de **12 enemigos `PONTAN`** (monedas rotatorias de 8000 puntos base, con `wallpass: true` y velocidad `1.125 px/tick`).
  - Aparecen distribuidos en coordenadas válidas del mapa (incluyendo la casilla de la puerta si ha sido revelada y los bordes del mapa), respetando estrictamente una distancia Manhattan $\ge 5$ respecto a la posición actual de Bomberman (`playerPos`) para garantizar margen de reacción táctica.
  - El jugador puede maniobrar, esquivar y detonar bombas para destruir a los `PONTAN`, obteniendo 8000 puntos base por cada uno más los multiplicadores de combo simultáneo ($1\times, 2\times, 4\times, 8\times$).
  - Una vez que todos los enemigos son derrotados (`enemies.getAliveCount() === 0` o `enemies.aliveCount === 0`), Bomberman puede ingresar libremente a la puerta de salida para ganar la fase (`STAGE_CLEARED`).

#### 3.3.2 Trampa de la Puerta (`DOOR_REVEALED`) y del Power-Up (`POWERUP_REVEALED`)
- Cuando la llama de una explosión alcanza la casilla de una puerta revelada (`DOOR_REVEALED`):
  - La puerta **NO se destruye**.
  - Invoca `enemies.spawnFromTile(doorTx, doorTy, count, type)`.
  - Nacen **desde la misma coordenada exacta de la puerta $(doorTx, doorTy)$** un grupo de **4 a 8 enemigos** (`ONEAL` / `MINVO` / `PONTAN`), dispersándose en las direcciones disponibles.
  - Los nuevos enemigos incrementan inmediatamente el conteo de enemigos vivos (`aliveCount`), bloqueando la salida de la puerta hasta que el jugador vuelva a eliminarlos a todos.
- Cuando la llama alcanza un potenciador revelado (`POWERUP_REVEALED`):
  - El ítem se calcina y desaparece, transformando la casilla en `TileType.EMPTY`.
  - También invoca `enemies.spawnFromTile(tx, ty, count, type)`, haciendo nacer de 4 a 8 enemigos desde dicha coordenada $(tx, ty)$.

### 3.4 Tile Qualification
- **Standard Enemies (`BALLOM`, `ONEAL`, `DAHL`, `MINVO`):**
  Must spawn on tiles that are `TileType.EMPTY` (walkable ground, no hard walls, no soft blocks).
- **Ghost Enemies (`OVAPE`, `KONDORIA`, `PONTAN`):**
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

### 7.1 Hitbox Intersection Contract
- **Enemy Outer Bounding Box:**
  $$\text{Box}_{enemy} = [x, x + 16] \times [y, y + 16]$$
- **Bomberman Inner Vulnerability Hitbox ($12\times 12$ centered):**
  $$\text{Hitbox}_{player} = [player.x + 2, player.x + 14] \times [player.y + 2, player.y + 14]$$

### 7.2 Lethality Trigger
An enemy kills Bomberman if and only if:
1. `enemy.state === 'ALIVE'`.
2. `player.state === 'ALIVE'`.
3. `!player.isInvulnerable` (i.e. not in `SPAWNING`, not `DYING`, not `DEAD`, and `player.stats.invincibleTimerMs === 0`).
4. $\text{AABB}(\text{Box}_{enemy}, \text{Hitbox}_{player}) \text{ is true}$.

When all conditions are met:
- Triggers `player.kill()`.
- Emits player death sequence.
