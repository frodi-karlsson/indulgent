import {
  SignalError,
  computed,
  effect,
  signal,
  storeSignal,
} from './signal.js';
import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest';

describe('signal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  describe('setters and getters', () => {
    test('should return the initial value', () => {
      const sig = signal(42);
      expect(sig.get()).toBe(42);
    });

    test('should return undefined if no initial value is provided', () => {
      const sig = signal();
      expect(sig.get()).toBeUndefined();
    });

    test('should return the updated value after set', async () => {
      const sig = signal(42);
      sig.set(100);
      await vi.runAllTimersAsync();
      expect(sig.get()).toBe(100);
    });

    test('should return the updated value after update', async () => {
      const sig = signal(10);
      sig.update((oldValue) => (oldValue ?? 0) + 5);
      await vi.runAllTimersAsync();
      expect(sig.get()).toBe(15);
    });
  });

  describe('dependencies', () => {
    test('should call a registered dependent on set', async () => {
      const sig = signal(1);
      const mockListener = vi.fn();
      sig.registerDependent(mockListener);
      sig.set(2);
      await vi.runAllTimersAsync();
      expect(mockListener).toHaveBeenCalledWith(2);
    });

    test('should call a registered dependent on update', async () => {
      const sig = signal(1);
      const mockListener = vi.fn();
      sig.registerDependent(mockListener);
      sig.update((oldValue) => (oldValue ?? 0) + 3);
      await vi.runAllTimersAsync();
      expect(mockListener).toHaveBeenCalledWith(4);
    });

    test('should not call unregistered dependencies', async () => {
      const sig = signal(1);
      const mockListener = vi.fn();
      sig.registerDependent(mockListener);
      sig.unregisterDependent(mockListener);
      sig.set(2);
      await vi.runAllTimersAsync();
      expect(mockListener).not.toHaveBeenCalled();
    });

    test('should not call dependencies after unregistering all', async () => {
      const sig = signal(1);
      const mockListener1 = vi.fn();
      const mockListener2 = vi.fn();
      sig.registerDependent(mockListener1);
      sig.registerDependent(mockListener2);
      sig.unregisterAllDependents();
      sig.set(2);
      await vi.runAllTimersAsync();
      expect(mockListener1).not.toHaveBeenCalled();
      expect(mockListener2).not.toHaveBeenCalled();
    });
  });
});

describe('computed', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  test('should compute initial value based on dependencies', () => {
    const sig1 = signal(2);
    const sig2 = signal(3);
    const comp = computed(() => sig1.get() + sig2.get());
    expect(comp.get()).toBe(5);
  });

  test('should update computed value when dependencies change', async () => {
    const sig1 = signal(2);
    const sig2 = signal(3);
    const comp = computed(() => sig1.get() + sig2.get());
    expect(comp.get()).toBe(5);
    sig1.set(5);
    await vi.runAllTimersAsync();
    expect(comp.get()).toBe(8);
    sig2.set(10);
    await vi.runAllTimersAsync();
    expect(comp.get()).toBe(15);
  });

  test('should update when computed dependencies change', async () => {
    const sig1 = signal(2);
    const sig2 = signal(3);
    const comp1 = computed(() => sig1.get() + sig2.get());
    const comp2 = computed(() => comp1.get() * 2);
    const comp3 = computed(() => comp2.get() + sig1.get());

    expect(comp3.get()).toBe(12); // (2 + 3) * 2 + 2

    sig1.set(5);
    await vi.runAllTimersAsync();
    expect(comp3.get()).toBe(21); // (5 + 3) * 2 + 5

    sig2.set(10);
    await vi.runAllTimersAsync();
    expect(comp3.get()).toBe(35); // (5 + 10) * 2 + 5
  });

  test('should not recompute if dependencies do not change', async () => {
    const sig1 = signal(2);
    const sig2 = signal(3);
    const mockCompute = vi.fn(() => sig1.get() + sig2.get());
    const comp = computed(mockCompute);
    expect(comp.get()).toBe(5);
    expect(mockCompute).toHaveBeenCalledTimes(1);

    sig1.set(2);
    await vi.runAllTimersAsync();
    expect(comp.get()).toBe(5);
    expect(mockCompute).toHaveBeenCalledTimes(1);

    sig2.set(4);
    await vi.runAllTimersAsync();
    expect(comp.get()).toBe(6);
    expect(mockCompute).toHaveBeenCalledTimes(2);
  });

  test('should only recompute once with multiple dependencies changing', async () => {
    const sig1 = signal(2);
    const sig2 = signal(3);
    const mockCompute = vi.fn(() => sig1.get() + sig2.get());
    const comp = computed(mockCompute);
    expect(comp.get()).toBe(5);
    expect(mockCompute).toHaveBeenCalledTimes(1);

    sig1.set(5);
    sig2.set(10);
    await vi.runAllTimersAsync();
    expect(comp.get()).toBe(15);
    expect(mockCompute).toHaveBeenCalledTimes(2);
  });
});

describe('effect', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  test('should run effect initially', () => {
    const mockEffect = vi.fn();
    effect(mockEffect);
    expect(mockEffect).toHaveBeenCalledTimes(1);
  });

  test('should rerun effect when dependencies change', async () => {
    const sig = signal(1);
    const mockEffect = vi.fn(() => {
      sig.get();
    });
    effect(mockEffect);
    expect(mockEffect).toHaveBeenCalledTimes(1);
    sig.set(2);
    await vi.runAllTimersAsync();
    expect(mockEffect).toHaveBeenCalledTimes(2);
    sig.set(3);
    await vi.runAllTimersAsync();
    expect(mockEffect).toHaveBeenCalledTimes(3);
  });

  test('should rerun when computed dependency changes', async () => {
    const sig = signal(1);
    const comp = computed(() => sig.get() * 2);
    const mockEffect = vi.fn(() => {
      comp.get();
    });
    effect(mockEffect);
    expect(mockEffect).toHaveBeenCalledTimes(1);
    sig.set(2);
    await vi.runAllTimersAsync();
    expect(mockEffect).toHaveBeenCalledTimes(2);
    sig.set(3);
    await vi.runAllTimersAsync();
    expect(mockEffect).toHaveBeenCalledTimes(3);
  });

  test('should only run once per update with consecutive changes', async () => {
    const sig = signal(1);
    const mockEffect = vi.fn(() => {
      sig.get();
    });
    effect(mockEffect);
    expect(mockEffect).toHaveBeenCalledTimes(1);
    sig.set(2);
    sig.set(3);
    sig.set(4);
    await vi.runAllTimersAsync();
    expect(mockEffect).toHaveBeenCalledTimes(2);
    sig.set(5);
    await vi.runAllTimersAsync();
    expect(mockEffect).toHaveBeenCalledTimes(3);
  });

  test('should only run once with multiple dependencies changing', async () => {
    const sig1 = signal(1);
    const sig2 = signal(10);
    const mockEffect = vi.fn(() => {
      sig1.get();
      sig2.get();
    });
    effect(mockEffect);
    expect(mockEffect).toHaveBeenCalledTimes(1);
    sig1.set(2);
    sig2.set(20);
    await vi.runAllTimersAsync();
    expect(mockEffect).toHaveBeenCalledTimes(2);
    sig1.set(3);
    await vi.runAllTimersAsync();
    expect(mockEffect).toHaveBeenCalledTimes(3);
  });
});

describe('storeSignal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterAll(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  test('should initialize with undefined if no initial value is provided and no stored value exists', () => {
    const sig = storeSignal('testKey1');
    expect(sig.get()).toBeUndefined();
  });

  test('should initialize with provided initial value if no stored value exists', () => {
    const sig = storeSignal('testKey2', 42);
    expect(sig.get()).toBe(42);
    expect(localStorage.getItem('testKey2')).toBe(JSON.stringify(42));
  });

  test('should initialize with stored value if it exists', () => {
    localStorage.setItem('testKey3', JSON.stringify(100));
    const sig = storeSignal('testKey3', 42);
    expect(sig.get()).toBe(100);
  });

  test('should update stored value when signal value changes', async () => {
    const sig = storeSignal('testKey4', 10);
    expect(localStorage.getItem('testKey4')).toBe(JSON.stringify(10));
    sig.set(20);
    await vi.runAllTimersAsync();
    expect(localStorage.getItem('testKey4')).toBe(JSON.stringify(20));
    sig.update((oldValue) => (oldValue ?? 0) + 5);
    await vi.runAllTimersAsync();
    expect(localStorage.getItem('testKey4')).toBe(JSON.stringify(25));
  });

  test('should throw an error if stored value is not valid JSON', () => {
    localStorage.setItem('testKey5', 'invalid JSON');
    expect(() => storeSignal('testKey5')).toThrow(SignalError);
  });

  test('should update dependents if value is not equal to stored value', async () => {
    const sig = storeSignal('testKey6', { a: 1 });
    const mockListener = vi.fn();
    sig.registerDependent(mockListener);
    const value = sig.get();
    value.a = 2;
    sig.set(value);
    await vi.runAllTimersAsync();
    expect(mockListener).toHaveBeenCalledWith({ a: 2 });
  });
});
