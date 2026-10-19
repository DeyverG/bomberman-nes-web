---
name: stack-vite-tw4-canvas
description: Technical constraints for Vite, TypeScript, Tailwind CSS v4, and HTML5 Canvas pixel-art rendering.
---

# Stack Constraints

## 1. Build & Environment (Vite)
- Use standard Vite with `@vitejs/plugin-react` and `@tailwindcss/vite`.
- Environment files follow `.env.dev`, `.env.qa`, and `.env.prod` convention if environment flags (like debug hitboxes) are needed.

## 2. Tailwind CSS v4 Strict Rules
- **NO `tailwind.config.js`:** Use CSS-first configuration exclusively inside the main stylesheet via `@import "tailwindcss";` and `@theme { ... }`.
- Define NES palette tokens and pixel fonts inside `@theme`:
  - `--font-nes: 'Press Start 2P', monospace;`
  - `--color-nes-gray: #bcbcbc;`
  - `--color-nes-green: #00a800;`
- Use Tailwind ONLY for the outer cabinet layout, HUD bar, and overlay menus (`hud-shell`).

## 3. HTML5 Canvas & NES Resolution Rules
- **Native NES Logical Resolution:** `256x240` pixels (16x15 tiles of 16x16px). Calculate all game physics in native logical pixels, then scale via CSS or Canvas context transform.
- **Crisp Pixel Art:** Always apply `image-rendering: pixelated;` on the `<canvas>` element and set `ctx.imageSmoothingEnabled = false;` in the 2D context.

## 4. TypeScript Discipline
- `any` is strictly banned.
- Prefer discriminated unions for entity states and flat TypedArrays (`Uint8Array`) for the 2D stage collision matrix to maximize cache locality and 60 FPS performance.