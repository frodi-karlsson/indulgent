import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  computed,
  createSignal,
  effect,
  isSignal,
  storeSignal,
} from './signal.js';

beforeEach(() => {
  vi.useFakeTimers();
});

afterAll(() => {
  vi.useRealTimers();
});

describe('signal', () => {
  describe('setters and getters', () => {
    test('should return the initial value', () => {
      const signal = createSignal(42);
      expect(signal.get()).toBe(42);
    });

    test('should return undefined if no initial value is provided', () => {
      const signal = createSignal();
      expect(signal.get()).toBeUndefined();
    });

    test('should return the updated value after set', async () => {
      const signal = createSignal(42);
      signal.set(100);
      await vi.runAllTimersAsync();
      expect(signal.get()).toBe(100);
    });

    test('should return the updated value after update', async () => {
      const signal = createSignal(10);
      signal.update((oldValue) => (oldValue ?? 0) + 5);
      await vi.runAllTimersAsync();
      expect(signal.get()).toBe(15);
    });
  });

  describe('dependencies', () => {
    test('should call a registered dependency on set', async () => {
      const signal = createSignal(1);
      const mockListener = vi.fn();
      signal.registerDependency(mockListener);
      signal.set(2);
      await vi.runAllTimersAsync();
      expect(mockListener).toHaveBeenCalledWith(2);
    });

    test('should call a registered dependency on update', async () => {
      const signal = createSignal(1);
      const mockListener = vi.fn();
      signal.registerDependency(mockListener);
      signal.update((oldValue) => (oldValue ?? 0) + 3);
      await vi.runAllTimersAsync();
      expect(mockListener).toHaveBeenCalledWith(4);
    });

    test('should call multiple registered dependencies in order', async () => {
      const signal = createSignal(5);
      const mockListener1 = vi.fn();
      const mockListener2 = vi.fn();
      signal.registerDependency(mockListener1);
      signal.registerDependency(mockListener2);
      signal.set(10);
      await vi.runAllTimersAsync();
      expect(mockListener1).toHaveBeenCalledBefore(mockListener2);
      expect(mockListener1).toHaveBeenCalledWith(10);
      expect(mockListener2).toHaveBeenCalledWith(10);
    });

    test('should not call an unregistered dependency', async () => {
      const signal = createSignal(1);
      const mockListener = vi.fn();
      const cleanup = signal.registerDependency(mockListener);
      cleanup();
      signal.set(2);
      await vi.runAllTimersAsync();
      expect(mockListener).not.toHaveBeenCalled();
    });

    test('should not call dependencies after unregisterAllDependencies', async () => {
      const signal = createSignal(1);
      const mockListener = vi.fn();
      signal.registerDependency(mockListener);
      signal.unregisterAllDependencies();
      signal.set(2);
      await vi.runAllTimersAsync();
      expect(mockListener).not.toHaveBeenCalled();
    });
  });
});

describe('computed signals', () => {
  test('should compute initial value based on dependencies', () => {
    const signalA = createSignal(2);
    const signalB = createSignal(3);
    const computedSignal = createSignal(signalA.get() + signalB.get());
    expect(computedSignal.get()).toBe(5);
  });

  test('should update computed value when a dependency changes', async () => {
    const signalA = createSignal(2);
    const signalB = createSignal(3);
    const computedSignal = computed(() => signalA.get() + signalB.get());
    expect(computedSignal.get()).toBe(5);

    signalA.set(5);
    await vi.runAllTimersAsync();
    expect(computedSignal.get()).toBe(8);
  });

  test('should handle multiple dependencies changing', async () => {
    const signalA = createSignal(1);
    const signalB = createSignal(2);
    const signalC = createSignal(3);
    const computedSignal = computed(
      () => signalA.get() + signalB.get() + signalC.get(),
    );
    expect(computedSignal.get()).toBe(6);

    signalA.set(4);
    expect(computedSignal.get()).toBe(6);

    signalB.set(5);
    await vi.runAllTimersAsync();
    expect(computedSignal.get()).toBe(12);
  });

  test('should not update if dependency is unregistered', async () => {
    const signalA = createSignal(1);
    const signalB = createSignal(2);
    const computedSignal = computed(() => signalA.get() + signalB.get());
    expect(computedSignal.get()).toBe(3);

    signalA.set(3);
    await vi.runAllTimersAsync();
    expect(computedSignal.get()).toBe(5);

    computedSignal.unregisterAllDependencies();
    signalB.set(5);
    await vi.runAllTimersAsync();
    expect(computedSignal.get()).toBe(5);
  });
});

describe('storeSignal', () => {
  test('should return the initial value from localStorage, even if one is passed', () => {
    vi.spyOn(localStorage, 'getItem').mockReturnValue(JSON.stringify(99));
    const signal = storeSignal('my_unique_key', 42);
    expect(signal.get()).toBe(99);
  });

  test('should return the initial value if no localStorage value exists', () => {
    vi.spyOn(localStorage, 'getItem').mockReturnValue(null);
    const signal = storeSignal('my_unique_key', 42);
    expect(signal.get()).toBe(42);
  });

  test('should return undefined if no initial value is provided and no localStorage value exists', () => {
    vi.spyOn(localStorage, 'getItem').mockReturnValue(null);
    const signal = storeSignal('my_unique_key');
    expect(signal.get()).toBeUndefined();
  });

  test('should update localStorage when the signal value changes', async () => {
    vi.spyOn(localStorage, 'setItem');
    const signal = storeSignal('my_unique_key', 42);
    signal.set(99);
    await vi.runAllTimersAsync();
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'my_unique_key',
      JSON.stringify(99),
    );
  });

  test('should use custom equality function for localStorage signal', async () => {
    const signal = storeSignal('my_unique_key', 42, {
      equalsFn: (a, b) => a === b,
    });
    vi.spyOn(localStorage, 'setItem');
    signal.set(42);
    await vi.runAllTimersAsync();
    expect(localStorage.setItem).not.toHaveBeenCalled();
    signal.set(43);
    await vi.runAllTimersAsync();
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'my_unique_key',
      JSON.stringify(43),
    );
  });

  test('should call registered dependencies on value change', async () => {
    const signal = storeSignal('my_unique_key', 42);
    const mockListener = vi.fn();
    signal.registerDependency(mockListener);
    signal.set(43);
    await vi.runAllTimersAsync();
    expect(mockListener).toHaveBeenCalledWith(43);
  });

  test('should use custom storage if provided', async () => {
    const mockStorage = {
      getItem: vi.fn().mockReturnValue(JSON.stringify(50)),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    };
    const signal = storeSignal('custom_key', 42, { storage: mockStorage });
    expect(signal.get()).toBe(50);

    signal.set(60);
    await vi.runAllTimersAsync();
    expect(mockStorage.setItem).toHaveBeenCalledWith(
      'custom_key',
      JSON.stringify(60),
    );
  });
});

describe('effect', () => {
  test('should run the effect immediately', () => {
    const mockEffect = vi.fn();
    effect(mockEffect);
    expect(mockEffect).toHaveBeenCalledTimes(1);
  });

  test('should run the effect when a dependency changes', async () => {
    const signal = createSignal(1);
    const mockEffect = vi.fn(() => {
      signal.get();
    });
    effect(mockEffect);
    expect(mockEffect).toHaveBeenCalledTimes(1);

    signal.set(2);
    await vi.runAllTimersAsync();
    expect(mockEffect).toHaveBeenCalledTimes(2);
  });

  test('should not run the effect after cleanup', async () => {
    const signal = createSignal(1);
    const mockEffect = vi.fn(() => {
      signal.get();
    });
    const cleanup = effect(mockEffect);
    expect(mockEffect).toHaveBeenCalledTimes(1);

    cleanup();
    signal.set(2);
    await vi.runAllTimersAsync();
    expect(mockEffect).toHaveBeenCalledTimes(1);
  });

  test('should handle multiple dependencies', async () => {
    const signalA = createSignal(1);
    const signalB = createSignal(2);
    const mockEffect = vi.fn(() => {
      signalA.get();
      signalB.get();
    });
    effect(mockEffect);
    expect(mockEffect).toHaveBeenCalledTimes(1);
  });

  test('should work in tandem with sibling effect following same dependency', async () => {
    const signal = createSignal(1);
    const mockEffect1 = vi.fn(() => {
      signal.get();
    });
    const mockEffect2 = vi.fn(() => {
      signal.get();
    });
    effect(mockEffect1);
    effect(mockEffect2);

    expect(mockEffect1).toHaveBeenCalledTimes(1);
    expect(mockEffect2).toHaveBeenCalledTimes(1);

    signal.set(2);
    await vi.runAllTimersAsync();
    expect(mockEffect1).toHaveBeenCalledTimes(2);
    expect(mockEffect2).toHaveBeenCalledTimes(2);
  });
});

describe('isSignal', () => {
  test('should return true for a signal', () => {
    const signal = createSignal(1);
    expect(isSignal(signal)).toBe(true);
  });

  test('should return false for a non-signal object', () => {
    const notASignal = { get: () => 1, set: (_val: number) => {} };
    expect(isSignal(notASignal)).toBe(false);
  });
});
