# Specification: 8-Bit Synthesized Audio Subsystem (`src/core/audio/`)

## 1. Architectural Scope & Decoupling
The `src/core/audio/` module is an authentic 8-bit sound synthesis engine that emulates the Ricoh 2A03 APU of the Nintendo Entertainment System (NES).
It generates all sound effects (SFX) and jingles procedurally using the **Web Audio API** (OscillatorNode, GainNode, BiquadFilterNode, and AudioBuffer white noise).

### Innegotiable Architectural Principles:
1. **Zero External Assets:** 100% synthesized in real time. Prohibited from bundling or loading MP3, OGG, WAV, or external audio files.
2. **Headless / SSR / Test Safety:** Graceful fallback to no-op when `AudioContext` is absent (such as in Node.js, Vitest, or unsupported environments). Must NEVER throw an uncaught exception on headless environments.
3. **Autoplay Policy Compliance:** `AudioContext` is created/resumed on explicit user interaction (e.g. keyboard event or click on title screen).
4. **Decoupled Architecture:** Pure TypeScript, zero React dependencies. Triggered purely via deterministic engine orchestrations or domain events.

---

## 2. APU 2A03 Emulated Channel Architecture

The NES APU comprises five sound channels. This subsystem synthesizes audio using equivalent Web Audio nodes:

| Emulated Channel | Web Audio Node Configuration | Target Sound Effects |
| :--- | :--- | :--- |
| **Pulse 1 & 2 (Square)** | `OscillatorNode` with `type: 'square'` | Walking step pulse, bomb placement sweep, power-up arpeggios, death chromatic descent, stage fanfares, pause chime |
| **Triangle** | `OscillatorNode` with `type: 'triangle'` | Bass foundation for footsteps and stage melodies |
| **White Noise** | `AudioBufferSourceNode` filled with uniform pseudo-random noise `Math.random() * 2 - 1` | Bomb explosion bursts, crumbling disintegrations |

---

## 3. Synthesized Sound Effects Catalog

### 3.1 `playStep()`
- **Acoustic Profile:** Ultra-short low pulse alternating between two pitch registers (e.g. 110Hz and 130Hz) simulating Bomberman's boots.
- **Duration:** Exactly $30\text{ ms}$.
- **Throttling Cooldown:** Enforces a minimum interval of **$140\text{ ms}$** between step triggers to prevent auditory saturation during continuous corridor running.

### 3.2 `playPlaceBomb()`
- **Acoustic Profile:** Square wave with rapid upward pitch sweep.
- **Frequency Modulation:** Exponential sweep from $200\text{ Hz}$ to $580\text{ Hz}$ over $90\text{ ms}$.
- **Gain Envelope:** Linear decay from $0.20$ to $0$ over $90\text{ ms}$.

### 3.3 `playExplosion()`
- **Acoustic Profile:** Procedural white noise filtered through a dynamic low-pass sweep.
- **Filter Envelope:** `BiquadFilterNode` (`type: 'lowpass'`), cutoff frequency sweeping from $900\text{ Hz}$ down to $80\text{ Hz}$ over $480\text{ ms}$.
- **Gain Envelope:** Peak gain $0.35$ decaying exponentially to $0.001$ over $480\text{ ms}$ (synchronized with the $480\text{ ms}$ flame duration).

### 3.4 `playPowerup()`
- **Acoustic Profile:** Fast 4-note ascending major arpeggio in bright square wave.
- **Musical Frequencies:** C5 ($523.25\text{ Hz}$), E5 ($659.25\text{ Hz}$), G5 ($783.99\text{ Hz}$), C6 ($1046.50\text{ Hz}$).
- **Timing:** $65\text{ ms}$ per note, total duration $\approx 260\text{ ms}$.

### 3.5 `playDoorRevealed()` / `playAllEnemiesCleared()`
- **Acoustic Profile:** Crisp confirmation chime when the exit door is uncovered or the final enemy is eliminated.
- **Frequencies:** Ascending major third (G5 $784\text{ Hz} \to$ B5 $988\text{ Hz} \to$ E6 $1318\text{ Hz}$).

### 3.6 `playPlayerDeath()`
- **Acoustic Profile:** Downward chromatic slide and pitch drop upon entering `DYING`.
- **Modulation:** Linear frequency slide from $620\text{ Hz}$ to $110\text{ Hz}$ over $750\text{ ms}$ with fast tremolo vibrato.

### 3.7 `playStageIntro()` & `playStageClear()`
- **Stage Intro Fanfare:** 8-bit opening motif ($\approx 1200\text{ ms}$) accompanying the black `STAGE X` curtain.
- **Stage Clear Fanfare:** 8-bit victory melody ($\approx 1600\text{ ms}$) upon crossing the exit door threshold.

### 3.8 `playPause()`
- **Acoustic Profile:** Classic two-tone NES pause chirping sound ($880\text{ Hz}$ for $40\text{ ms} \to$ $1760\text{ Hz}$ for $80\text{ ms}$).

---

## 4. Volume Control & Mute Policy
- Master volume gain node routes all channels to `destination`.
- **`toggleMute()` / `setMuted(boolean)`:**
  - When `isMuted === true`: Master gain is set to $0.0$.
  - When `isMuted === false`: Master gain is restored to default nominal level ($0.30$).
  - Hotkey: Pressing `KeyM` toggles mute globally.
  - State persisted in `localStorage.getItem('nes_bomberman_muted')`.
