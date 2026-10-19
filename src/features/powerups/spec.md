# Specification: Power-Up System & Stage Exit Door (`src/features/powerups/`)

## 1. Architectural Scope & Decoupling
The `src/features/powerups/` module governs the catalog, level distribution, collection triggers, upgrade application, death persistence policies, and the Stage Exit Door mechanics for NES Bomberman (1985).
It is written in **pure TypeScript**, completely decoupled from React and DOM rendering. It interfaces with `stage-grid` for tile states and with `bomberman` for stat mutations.

---

## 2. Official NES Bomberman Power-Up Catalog

| Power-Up Enum | Visual Icon | Immediate In-Game Effect | Statutory Cap | Persists on Death? |
| :--- | :--- | :--- | :--- | :--- |
| **`BOMB_UP`** | Black Bomb | `stats.maxBombs += 1` | Max 10 | **YES (Permanent)** |
| **`FIRE_UP`** | Golden Flame | `stats.flameRange += 1` | Max 5 | **YES (Permanent)** |
| **`SPEED_UP`** | Roller Skate | `stats.speed = 1.5`, `stats.hasSpeedUp = true` | 1.5 px/tick | **YES (Permanent)** |
| **`WALLPASS`** | Brick Silhouette | `stats.wallpass = true` (walk through soft blocks) | Binary | **NO (Lost)** |
| **`DETONATOR`** | Remote Radio | `stats.hasDetonator = true` (manual B/Z trigger) | Binary | **NO (Lost)** |
| **`BOMBPASS`** | Bomb with Legs | `stats.bombpass = true` (walk through planted bombs)| Binary | **NO (Lost)** |
| **`FLAMEPASS`** | Fireproof Vest | `stats.flamepass = true` (immune to bomb flame rays) | Binary | **NO (Lost)** |
| **`MYSTERY`** | Question Mark / Suit | Complete invulnerability for **$30000\text{ ms}$** (30s) | Binary (Timer)| **NO (Lost)** |

---

## 3. Stage Distribution Table (Deterministic Mapping)

In canonical NES Bomberman (1985), exactly ONE guaranteed power-up is concealed under a destructible brick on each stage:

| Stage Number | Concealed Power-Up | Stage Number | Concealed Power-Up |
| :--- | :--- | :--- | :--- |
| **Stage 1** | `FIRE_UP` | **Stage 6** | `BOMB_UP` |
| **Stage 2** | `BOMB_UP` | **Stage 7** | `FIRE_UP` |
| **Stage 3** | `DETONATOR` | **Stage 8** | `DETONATOR` |
| **Stage 4** | `SPEED_UP` | **Stage 9** | `BOMB_UP` |
| **Stage 5** | `BOMB_UP` | **Stage 10** | `WALLPASS` |

*For stages $> 10$, a deterministic table or modulo rotation continues the authentic progression (e.g., cycling between Flamepass, Bombpass, Wallpass, Mystery, and Bomb/Fire upgrades).*

---

## 4. Collection Mechanics & Scoring

### 4.1 Collection Trigger
A revealed power-up tile $(tx, ty)$ is collected when:
1. `grid.getTile(tx, ty) === TileType.POWERUP_REVEALED`.
2. Bomberman's discrete center tile aligns with the power-up tile:
   $$tx = \lfloor (player.x + 8.0) / 16 \rfloor \land ty = \lfloor (player.y + 8.0) / 16 \rfloor$$

### 4.2 Application Side Effects
When collected:
1. **Tile Transition:** `grid.setTile(tx, ty, TileType.EMPTY)`.
2. **Score Award:** Adds $+1000\text{ points}$ to `player.stats.score`.
3. **Stat Mutation:** The specific upgrade is applied to `player.stats`.
4. **Event Emitted:** Dispatches `{ type: 'POWERUP_COLLECTED', powerupType, scoreAwarded: 1000, tile: { tx, ty } }`.

---

## 5. Death Persistence Policy (What is Kept vs. Lost)

When Bomberman loses a life and transitions $\text{DYING} \to \text{DEAD}$:

### 5.1 Retained Upgrades (Permanent across Lives)
- `maxBombs`: Preserved (extra bomb capacity is never lost).
- `flameRange`: Preserved (extra explosion range is never lost).
- `hasSpeedUp` / `speed`: Preserved (skate speed upgrade is retained).

### 5.2 Stripped Upgrades (Reset to Defaults upon Death)
- `stats.hasDetonator = false`
- `stats.wallpass = false`
- `stats.bombpass = false`
- `stats.flamepass = false`
- `mysteryInvincibleTimer = 0`

---

## 6. Exit Door Mechanics (`DOOR_REVEALED`)

The Stage Exit Door is concealed under a destructible brick and revealed when the brick is incinerated by an explosion.

### 6.1 Stage Clear Condition
The stage is cleared and the player advances to the next stage if and only if:
1. The door is uncovered: `grid.getTile(doorTx, doorTy) === TileType.DOOR_REVEALED`.
2. All enemies on the stage have been eliminated:
   $$\text{enemiesRemaining} === 0$$
3. Bomberman's threshold alignment with the door tile is within $\le 3\text{px}$:
   $$|player.x - doorTx \times 16| \le 3 \land |player.y - doorTy \times 16| \le 3$$
- Dispatches: `{ type: 'STAGE_CLEARED', nextStage: currentStage + 1 }`.

### 6.2 Behavior When Enemies Still Alive
If Bomberman steps onto `DOOR_REVEALED` while $\text{enemiesRemaining} > 0$:
- The stage is **NOT cleared**.
- The door remains completely inert and walkable. It does **NOT** spawn penalty enemies upon walking over it.
- Returns `null`.

*(Note: The punishment wave of enemies `DOOR_HIT_BY_FLAME` occurs strictly if a bomb explosion flame ray impacts a revealed door or revealed powerup).*
