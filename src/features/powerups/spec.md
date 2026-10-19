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

| Stage | Power-Up | Stage | Power-Up | Stage | Power-Up | Stage | Power-Up | Stage | Power-Up |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | `FIRE_UP` | **11** | `BOMB_UP` | **21** | `BOMB_UP` | **31** | `WALLPASS` | **41** | `BOMB_UP` |
| **2** | `BOMB_UP` | **12** | `BOMB_UP` | **22** | `DETONATOR` | **32** | `BOMB_UP` | **42** | `FIRE_UP` |
| **3** | `DETONATOR`| **13** | `DETONATOR`| **23** | `BOMB_UP` | **33** | `DETONATOR`| **43** | `DETONATOR`|
| **4** | `SPEED_UP` | **14** | `BOMB_UP` | **24** | `FIRE_UP` | **34** | `FIRE_UP` | **44** | `BOMB_UP` |
| **5** | `BOMB_UP` | **15** | `FIRE_UP` | **25** | `BOMB_UP` | **35** | `BOMB_UP` | **45** | `FIRE_UP` |
| **6** | `BOMB_UP` | **16** | `MYSTERY` | **26** | `MYSTERY` | **36** | `MYSTERY` | **46** | `MYSTERY` |
| **7** | `FIRE_UP` | **17** | `BOMB_UP` | **27** | `FIRE_UP` | **37** | `FIRE_UP` | **47** | `BOMB_UP` |
| **8** | `DETONATOR`| **18** | `BOMBPASS` | **28** | `BOMB_UP` | **38** | `BOMB_UP` | **48** | `FIRE_UP` |
| **9** | `BOMBPASS` | **19** | `BOMB_UP` | **29** | `DETONATOR`| **39** | `DETONATOR`| **49** | `DETONATOR`|
| **10**| `WALLPASS` | **20** | `WALLPASS` | **30** | `FLAMEPASS`| **40** | `WALLPASS` | **50** | `MYSTERY` |

*For stages $> 50$, the progression loops through the 50-stage cycle (`(stage - 1) % 50 + 1`).*

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

## 6. Exit Door Mechanics (`DOOR_REVEALED`), +1 Life, & Stage 50 Victory

The Stage Exit Door is concealed under a destructible brick and revealed when the brick is incinerated by an explosion.

### 6.1 Stage Clear Condition & Rewards
The stage is cleared and the player advances to the next stage if and only if:
1. The door is uncovered: `grid.getTile(doorTx, doorTy) === TileType.DOOR_REVEALED`.
2. All enemies on the stage have been eliminated:
   $$\text{enemiesRemaining} === 0$$
3. Bomberman's threshold alignment with the door tile is within $\le 3\text{px}$:
   $$|player.x - doorTx \times 16| \le 3 \land |player.y - doorTy \times 16| \le 3$$

Upon clearing the stage:
- **+1 Life Rule:** Awards $+1\text{ Life}$ (`player.stats.lives += 1`).
- **Stage 50 Victory:** If the cleared stage is Stage 50 (`currentStage >= 50`), the game triggers the `'VICTORY'` session state with the classic NES victory screen:
  `CONGRATULATIONS - YOU HAVE COMPLETED BOMBERMAN`.
- Otherwise: Dispatches `{ type: 'STAGE_CLEARED', nextStage: currentStage + 1 }`.

### 6.2 Behavior When Enemies Still Alive
If Bomberman steps onto `DOOR_REVEALED` while $\text{enemiesRemaining} > 0$:
- The stage is **NOT cleared**.
- The door remains completely inert and walkable. It does **NOT** spawn penalty enemies upon walking over it.
- Returns `null`.

*(Note: The punishment wave of enemies `DOOR_HIT_BY_FLAME` occurs strictly if a bomb explosion flame ray impacts a revealed door or revealed powerup, triggering `enemiesEngine.spawnTrapWave(currentStage, tx, ty)`).*
