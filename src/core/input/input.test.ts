import { describe, it, expect } from 'vitest';
import { InputEngine } from './input.engine';

describe('Deterministic Input Polling Engine (Unit Test Verification)', () => {
  describe('Edge Detection Mechanics (Level vs Rising/Falling Edge)', () => {
    it('reports isJustPressed as true ONLY on the first tick an action is pressed', () => {
      const input = new InputEngine();
      input.setVirtualKeyState('BOMB', true);
      input.update();

      expect(input.isJustPressed('BOMB')).toBe(true);
      expect(input.isDown('BOMB')).toBe(true);

      // Next tick with key still held
      input.update();
      expect(input.isJustPressed('BOMB')).toBe(false);
      expect(input.isDown('BOMB')).toBe(true);
    });

    it('reports isDown as true continuously for every tick the action is held', () => {
      const input = new InputEngine();
      input.setVirtualKeyState('UP', true);

      for (let i = 0; i < 5; i++) {
        input.update();
        expect(input.isDown('UP')).toBe(true);
      }
    });

    it('reports isJustReleased as true ONLY on the tick immediately following action release', () => {
      const input = new InputEngine();
      input.setVirtualKeyState('BOMB', true);
      input.update(); // Press

      input.setVirtualKeyState('BOMB', false);
      input.update(); // Release tick

      expect(input.isJustReleased('BOMB')).toBe(true);
      expect(input.isDown('BOMB')).toBe(false);

      input.update(); // Next tick
      expect(input.isJustReleased('BOMB')).toBe(false);
    });

    it('resets all edge and down states to false upon reset()', () => {
      const input = new InputEngine();
      input.setVirtualKeyState('BOMB', true);
      input.update();
      expect(input.isDown('BOMB')).toBe(true);

      input.reset();
      input.update();
      expect(input.isDown('BOMB')).toBe(false);
      expect(input.isJustPressed('BOMB')).toBe(false);
    });
  });

  describe('Opposite Direction Cancellation', () => {
    it('cancels horizontal movement when LEFT and RIGHT are held concurrently (returns null)', () => {
      const input = new InputEngine();
      input.setVirtualKeyState('LEFT', true);
      input.setVirtualKeyState('RIGHT', true);
      input.update();

      expect(input.getDirection()).toBeNull();
      expect(input.getDirections()).toEqual({ primary: null, secondary: null });
    });

    it('cancels vertical movement when UP and DOWN are held concurrently (returns null)', () => {
      const input = new InputEngine();
      input.setVirtualKeyState('UP', true);
      input.setVirtualKeyState('DOWN', true);
      input.update();

      expect(input.getDirection()).toBeNull();
      expect(input.getDirections()).toEqual({ primary: null, secondary: null });
    });

    it('resumes direction when one of the opposite keys is released', () => {
      const input = new InputEngine();
      input.setVirtualKeyState('LEFT', true);
      input.setVirtualKeyState('RIGHT', true);
      input.update();
      expect(input.getDirection()).toBeNull();

      input.setVirtualKeyState('LEFT', false);
      input.update();
      expect(input.getDirection()).toBe('RIGHT');
    });
  });

  describe('NES Diagonal Ban & Latest-Press Precedence', () => {
    it('gives precedence to the most recently pressed direction when holding perpendicular axes', () => {
      const input = new InputEngine();
      input.setVirtualKeyState('UP', true);
      input.update();
      expect(input.getDirection()).toBe('UP');

      // Now press RIGHT on next tick while UP is still held
      input.setVirtualKeyState('RIGHT', true);
      input.update();

      expect(input.getDirection()).toBe('RIGHT');
      expect(input.getDirections()).toEqual({ primary: 'RIGHT', secondary: 'UP' });
    });

    it('restores the previously held direction when the secondary direction is released', () => {
      const input = new InputEngine();
      input.setVirtualKeyState('UP', true);
      input.update();

      input.setVirtualKeyState('RIGHT', true);
      input.update();
      expect(input.getDirection()).toBe('RIGHT');

      // Release RIGHT
      input.setVirtualKeyState('RIGHT', false);
      input.update();
      expect(input.getDirection()).toBe('UP');
      expect(input.getDirections()).toEqual({ primary: 'UP', secondary: null });
    });

    it('resolves simultaneous same-tick perpendicular inputs deterministically to Vertical axis', () => {
      const input = new InputEngine();
      input.setVirtualKeyState('UP', true);
      input.setVirtualKeyState('RIGHT', true);
      input.update();

      expect(input.getDirection()).toBe('UP');
      expect(input.getDirections()).toEqual({ primary: 'UP', secondary: 'RIGHT' });
    });
  });

  describe('Bomb Planting Invariant', () => {
    it('triggers isJustPressed(BOMB) exactly once when held across multiple consecutive ticks', () => {
      const input = new InputEngine();
      input.setVirtualKeyState('BOMB', true);

      input.update();
      expect(input.isJustPressed('BOMB')).toBe(true);

      for (let i = 0; i < 10; i++) {
        input.update();
        expect(input.isJustPressed('BOMB')).toBe(false);
        expect(input.isDown('BOMB')).toBe(true);
      }
    });
  });
});
