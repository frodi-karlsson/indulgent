import { NextMicroTaskEmitter, SingleEventEmitter } from './eventEmitter.js';
import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest';

describe('singleEventEmitter', () => {
  test('should notify all listeners when an event is emitted', () => {
    const emitter = new SingleEventEmitter<number>();
    const mockListener1 = vi.fn();
    const mockListener2 = vi.fn();

    emitter.on(mockListener1);
    emitter.on(mockListener2);

    emitter.emit(42);

    expect(mockListener1).toHaveBeenCalledWith(42);
    expect(mockListener2).toHaveBeenCalledWith(42);
  });

  test('should not notify a listener after it has been removed', () => {
    const emitter = new SingleEventEmitter<number>();
    const mockListener = vi.fn();

    emitter.on(mockListener);
    emitter.emit(42);
    expect(mockListener).toHaveBeenCalledWith(42);

    emitter.off(mockListener);
    emitter.emit(100);
    expect(mockListener).toHaveBeenCalledTimes(1); // Should still be called only once
  });

  test('should handle multiple listeners and removals correctly', () => {
    const emitter = new SingleEventEmitter<void>();
    const mockListener1 = vi.fn();
    const mockListener2 = vi.fn();
    const mockListener3 = vi.fn();

    emitter.on(mockListener1);
    emitter.on(mockListener2);
    emitter.on(mockListener3);

    emitter.emit();
    expect(mockListener1).toHaveBeenCalled();
    expect(mockListener2).toHaveBeenCalled();
    expect(mockListener3).toHaveBeenCalled();

    emitter.off(mockListener2);
    emitter.emit();
    expect(mockListener1).toHaveBeenCalledTimes(2);
    expect(mockListener2).toHaveBeenCalledTimes(1);
    expect(mockListener3).toHaveBeenCalledTimes(2);
  });
});

describe('nextMicroTaskEmitter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  test('should not notify listeners right away', () => {
    const emitter = new NextMicroTaskEmitter<void>();
    const mockListener = vi.fn();

    emitter.on(mockListener);
    emitter.emit();

    expect(mockListener).not.toHaveBeenCalled();
  });

  test('should notify listeners in the next microtask', async () => {
    const emitter = new NextMicroTaskEmitter<void>();
    const mockListener = vi.fn();

    emitter.on(mockListener);
    emitter.emit();

    expect(mockListener).not.toHaveBeenCalled();

    await vi.runAllTimersAsync();

    expect(mockListener).toHaveBeenCalled();
  });

  test('should notify each listener only once per emit call', async () => {
    const emitter = new NextMicroTaskEmitter<void>();
    const mockListener = vi.fn();

    emitter.on(mockListener);
    emitter.emit();
    emitter.emit();
    emitter.emit();

    expect(mockListener).not.toHaveBeenCalled();

    await vi.runAllTimersAsync();

    expect(mockListener).toHaveBeenCalledTimes(1);
  });

  test('should not notify a listener after it has been removed', async () => {
    const emitter = new NextMicroTaskEmitter<void>();
    const mockListener = vi.fn();

    emitter.on(mockListener);
    emitter.emit();

    expect(mockListener).not.toHaveBeenCalled();

    await vi.runAllTimersAsync();

    expect(mockListener).toHaveBeenCalledTimes(1);

    emitter.off(mockListener);
    emitter.emit();

    await vi.runAllTimersAsync();

    expect(mockListener).toHaveBeenCalledTimes(1); // Should still be called only once
  });

  test('should only notify with the latest event if multiple emits happen before microtask', async () => {
    const emitter = new NextMicroTaskEmitter<number>();
    const mockListener = vi.fn();

    emitter.on(mockListener);
    emitter.emit(1);
    emitter.emit(2);
    emitter.emit(3);

    await vi.runAllTimersAsync();

    expect(mockListener).toHaveBeenCalledWith(3);
    expect(mockListener).toHaveBeenCalledTimes(1);
  });
});
