import { describe, it, expect, vi } from 'vitest';
import { GameLoopEngine, DEFAULT_FIXED_DELTA_MS } from './loop.engine';

describe('Fixed Timestep Loop Engine (Unit Test Verification)', () => {
  describe('State Machine & Transitions', () => {
    it('initializes in STOPPED state with zero accumulated time', () => {
      const updateFn = vi.fn();
      const loop = new GameLoopEngine(updateFn);
      expect(loop.state).toBe('STOPPED');
    });

    it('transitions from STOPPED to RUNNING when start() is called', () => {
      const updateFn = vi.fn();
      const loop = new GameLoopEngine(updateFn);
      loop.start();
      expect(loop.state).toBe('RUNNING');
      loop.stop();
    });

    it('transitions from RUNNING to PAUSED when pause() is called', () => {
      const updateFn = vi.fn();
      const loop = new GameLoopEngine(updateFn);
      loop.start();
      loop.pause();
      expect(loop.state).toBe('PAUSED');
    });

    it('transitions from PAUSED to RUNNING when resume() is called', () => {
      const updateFn = vi.fn();
      const loop = new GameLoopEngine(updateFn);
      loop.start();
      loop.pause();
      loop.resume();
      expect(loop.state).toBe('RUNNING');
      loop.stop();
    });

    it('transitions from RUNNING or PAUSED to STOPPED when stop() is called', () => {
      const updateFn = vi.fn();
      const loop = new GameLoopEngine(updateFn);
      loop.start();
      loop.stop();
      expect(loop.state).toBe('STOPPED');

      loop.start();
      loop.pause();
      loop.stop();
      expect(loop.state).toBe('STOPPED');
    });

    it('ignores duplicate start() calls when already RUNNING', () => {
      const updateFn = vi.fn();
      const loop = new GameLoopEngine(updateFn);
      loop.start();
      expect(loop.state).toBe('RUNNING');
      loop.start();
      expect(loop.state).toBe('RUNNING');
      loop.stop();
    });

    it('ignores resume() calls when state is not PAUSED', () => {
      const updateFn = vi.fn();
      const loop = new GameLoopEngine(updateFn);
      loop.resume();
      expect(loop.state).toBe('STOPPED');
    });
  });

  describe('Mathematical Fixed Timestep & Accumulator', () => {
    it('calls update with exactly 16.666666666666668 ms fixed delta', () => {
      const updateFn = vi.fn();
      let virtualTime = 1000;
      const loop = new GameLoopEngine(updateFn, undefined, {
        timeProvider: () => virtualTime,
      });

      loop.start();
      virtualTime += 16.666666666666668;
      loop.tick(virtualTime);

      expect(updateFn).toHaveBeenCalledTimes(1);
      expect(updateFn).toHaveBeenCalledWith(DEFAULT_FIXED_DELTA_MS);
      loop.stop();
    });

    it('executes exactly 60 updates when virtual time advances by 1000ms in 16.67ms steps', () => {
      const updateFn = vi.fn();
      let virtualTime = 0;
      const loop = new GameLoopEngine(updateFn, undefined, {
        timeProvider: () => virtualTime,
      });

      loop.start();
      const step = 1000 / 60;
      for (let i = 0; i < 60; i++) {
        virtualTime += step;
        loop.tick(virtualTime);
      }

      expect(updateFn).toHaveBeenCalledTimes(60);
      loop.stop();
    });

    it('does not fire update if elapsed time is less than fixedDeltaMs', () => {
      const updateFn = vi.fn();
      let virtualTime = 0;
      const loop = new GameLoopEngine(updateFn, undefined, {
        timeProvider: () => virtualTime,
      });

      loop.start();
      virtualTime += 10; // Less than 16.666ms
      loop.tick(virtualTime);

      expect(updateFn).not.toHaveBeenCalled();
      loop.stop();
    });

    it('fires multiple consecutive updates if elapsed delta spans multiple 16.67ms steps', () => {
      const updateFn = vi.fn();
      let virtualTime = 0;
      const loop = new GameLoopEngine(updateFn, undefined, {
        timeProvider: () => virtualTime,
      });

      loop.start();
      virtualTime += 50; // 50 / 16.6666 = 3 sub-ticks with 0.0002 remainder
      loop.tick(virtualTime);

      expect(updateFn).toHaveBeenCalledTimes(3);
      loop.stop();
    });

    it('calculates correct alpha value between [0.0, 1.0) for frame interpolation', () => {
      const updateFn = vi.fn();
      const renderFn = vi.fn();
      let virtualTime = 0;
      const loop = new GameLoopEngine(updateFn, renderFn, {
        timeProvider: () => virtualTime,
      });

      loop.start();
      virtualTime += 25; // 25ms = 1 update (16.666ms) + 8.333ms remainder (alpha ~ 0.5)
      loop.tick(virtualTime);

      expect(renderFn).toHaveBeenCalled();
      const lastAlpha = renderFn.mock.calls[0][0];
      expect(lastAlpha).toBeGreaterThanOrEqual(0);
      expect(lastAlpha).toBeLessThan(1.0);
      expect(lastAlpha).toBeCloseTo(0.5, 1);
      loop.stop();
    });
  });

  describe('Monitor Frequency Invariance (Hz Independence)', () => {
    it('produces exactly 60 updates over 1000ms under 60Hz display emulation (~16.67ms interval)', () => {
      const updateFn = vi.fn();
      let virtualTime = 0;
      const loop = new GameLoopEngine(updateFn, undefined, { timeProvider: () => virtualTime });
      loop.start();

      const step = 1000 / 60;
      for (let t = 0; t < 60; t++) {
        virtualTime += step;
        loop.tick(virtualTime);
      }
      expect(updateFn).toHaveBeenCalledTimes(60);
      loop.stop();
    });

    it('produces exactly 60 updates over 1000ms under 120Hz display emulation (~8.33ms interval)', () => {
      const updateFn = vi.fn();
      let virtualTime = 0;
      const loop = new GameLoopEngine(updateFn, undefined, { timeProvider: () => virtualTime });
      loop.start();

      const step = 1000 / 120;
      for (let t = 0; t < 120; t++) {
        virtualTime += step;
        loop.tick(virtualTime);
      }
      expect(updateFn).toHaveBeenCalledTimes(60);
      loop.stop();
    });

    it('produces exactly 60 updates over 1000ms under 144Hz display emulation (~6.94ms interval)', () => {
      const updateFn = vi.fn();
      let virtualTime = 0;
      const loop = new GameLoopEngine(updateFn, undefined, { timeProvider: () => virtualTime });
      loop.start();

      const step = 1000 / 144;
      for (let t = 0; t < 144; t++) {
        virtualTime += step;
        loop.tick(virtualTime);
      }
      expect(updateFn).toHaveBeenCalledTimes(60);
      loop.stop();
    });

    it('produces exactly 60 updates over 1000ms under 240Hz display emulation (~4.17ms interval)', () => {
      const updateFn = vi.fn();
      let virtualTime = 0;
      const loop = new GameLoopEngine(updateFn, undefined, { timeProvider: () => virtualTime });
      loop.start();

      const step = 1000 / 240;
      for (let t = 0; t < 240; t++) {
        virtualTime += step;
        loop.tick(virtualTime);
      }
      expect(updateFn).toHaveBeenCalledTimes(60);
      loop.stop();
    });

    it('produces exactly 60 updates over 1000ms under 30Hz display emulation (~33.33ms interval)', () => {
      const updateFn = vi.fn();
      let virtualTime = 0;
      const loop = new GameLoopEngine(updateFn, undefined, { timeProvider: () => virtualTime });
      loop.start();

      const step = 1000 / 30;
      for (let t = 0; t < 30; t++) {
        virtualTime += step;
        loop.tick(virtualTime);
      }
      expect(updateFn).toHaveBeenCalledTimes(60);
      loop.stop();
    });
  });

  describe('Lag Spike & Spiral of Death Prevention', () => {
    it('clamps elapsed delta to maxAccumulatorMs (100ms) when a large lag spike occurs (e.g. 2500ms)', () => {
      const updateFn = vi.fn();
      let virtualTime = 0;
      const loop = new GameLoopEngine(updateFn, undefined, {
        timeProvider: () => virtualTime,
        maxAccumulatorMs: 100,
      });

      loop.start();
      virtualTime += 2500; // Simulated lag spike
      loop.tick(virtualTime);

      // Clamped to 100ms -> floor(100 / 16.6666) = 6 updates
      expect(updateFn).toHaveBeenCalledTimes(6);
      loop.stop();
    });

    it('discards wall-clock time elapsed while in PAUSED state upon resume()', () => {
      const updateFn = vi.fn();
      let virtualTime = 0;
      const loop = new GameLoopEngine(updateFn, undefined, {
        timeProvider: () => virtualTime,
      });

      loop.start();
      virtualTime += 16.67;
      loop.tick(virtualTime);
      expect(updateFn).toHaveBeenCalledTimes(1);

      loop.pause();
      virtualTime += 10000; // 10 seconds pass while paused
      loop.resume();

      // First tick after resume with 1 normal frame step (16.67ms)
      virtualTime += 16.67;
      loop.tick(virtualTime);

      // Should only execute 1 update, NOT 600 updates
      expect(updateFn).toHaveBeenCalledTimes(2);
      loop.stop();
    });
  });

  describe('Edge Cases', () => {
    it('handles negative or backward timestamps gracefully without updating', () => {
      const updateFn = vi.fn();
      let virtualTime = 1000;
      const loop = new GameLoopEngine(updateFn, undefined, {
        timeProvider: () => virtualTime,
      });

      loop.start();
      virtualTime = 900; // Backward time
      loop.tick(virtualTime);

      expect(updateFn).not.toHaveBeenCalled();
      loop.stop();
    });

    it('stops invoking update and render callbacks immediately after stop()', () => {
      const updateFn = vi.fn();
      const renderFn = vi.fn();
      let virtualTime = 0;
      const loop = new GameLoopEngine(updateFn, renderFn, {
        timeProvider: () => virtualTime,
      });

      loop.start();
      loop.stop();

      virtualTime += 50;
      loop.tick(virtualTime);

      expect(updateFn).not.toHaveBeenCalled();
      expect(renderFn).not.toHaveBeenCalled();
    });
  });
});
