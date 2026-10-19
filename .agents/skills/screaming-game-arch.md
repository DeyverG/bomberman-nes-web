---
name: screaming-game-arch
description: Enforces Screaming Architecture (Feature-sliced domain structure) and strict decoupling between the pure TypeScript Game Engine and the React UI shell.
---

# Architectural Law: Domain First, Framework Last
The directory structure MUST scream "NES Bomberman" at the top level. Grouping files at the root by technical layer (`components/`, `hooks/`, `utils/`) is STRICTLY FORBIDDEN.

# Required Directory Structure
```text
src/
├── core/                      # Engine primitives (Zero game rules, Zero React)
│   ├── loop/                  # requestAnimationFrame ticker & delta-time math
│   ├── input/                 # Keyboard/Gamepad polling state
│   ├── audio/                 # Web Audio API 8-bit synthesizer/player
│   └── events/                # Lightweight Pub/Sub bus (Engine <-> React bridge)
├── features/                  # DOMAIN MODULES (Screaming Architecture)
│   ├── stage-grid/            # 13x15 tile matrix, hard walls, soft blocks, exit door
│   ├── bomberman/             # Player entity, movement physics, corner-sliding, lives
│   ├── ordinance/             # Bombs, fuse timers, cross-raycast explosion propagation
│   ├── enemies/               # AI behaviors (Ballom, Oneal, etc.), pathfinding
│   ├── powerups/              # Bomb-Up, Fire-Up, Speed-Up, Wallpass logic
│   └── hud-shell/             # ONLY place where React/Tailwind lives (Score, Timer, Menus)
└── shared/                    # Constants (TILE_SIZE = 16), pure math helpers, global types