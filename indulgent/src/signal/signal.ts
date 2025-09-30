/**
 * A reactive signal that holds a value of type T and allows for dependency tracking and updates.
 */
export interface Signal<T> {
  /**
   * Optional cleanup function to be called when the signal is no longer needed.
   */
  cleanup?: CleanupFn;
  /**
   * Retrieves the current value of the signal.
   */
  get: () => T;
  /**
   * Updates the signal value using a callback that receives the old value and returns the new value.
   */
  update: (cb: (oldValue: T) => T) => void;
  /**
   * Sets the signal to a new value, updating all registered dependencies.
   */
  set: (newValue: T) => void;
  /**
   * Registers a dependency listener that will be called whenever the signal value changes.
   * Returns a function to unregister the listener.
   */
  registerDependency: (listener: (newValue: T) => void) => CleanupFn;
  /**
   * Unregisters all previously registered dependency listeners.
   */
  unregisterAllDependencies: () => void;
}

export interface ReadOnlySignal<T> extends Omit<Signal<T>, 'set' | 'update'> {}
type CleanupFn = () => void;

const signalUpdates = new Map<string, () => void>();
let allSignalListener: ((signal: Signal<any>) => void) | null = null;
let processQueued = false;

function processSignalUpdates() {
  processQueued = false;
  if (!signalUpdates.size) {
    return;
  }
  const updates = [...signalUpdates.values()];
  signalUpdates.clear();
  for (const update of updates) {
    update();
  }
}

export function createSignal<T>(): Signal<T | undefined>;
export function createSignal<T>(
  initialValue: T,
  options?: { equalsFn?: (a: T, b: T) => boolean },
): Signal<T>;
/**
 * Creates a new reactive signal with an optional initial value and equality function.
 */
export function createSignal<T>(
  initialValue?: T,
  options?: { equalsFn?: (a: T | undefined, b: T | undefined) => boolean },
): Signal<T | undefined> {
  const id = `signal_${Math.random().toString(36).substring(2, 15)}`;
  const listeners = new Set<(newValue: T | undefined) => void>();
  let { equalsFn } = options || {};
  equalsFn ||= (a: T | undefined, b: T | undefined) =>
    JSON.stringify(a) === JSON.stringify(b);
  let value = initialValue;
  const updates: ((oldValue: T | undefined) => T | undefined)[] = [];
  let cleanedUp = false;

  function processUpdates() {
    if (cleanedUp) {
      return;
    }
    if (!updates.length) {
      return;
    }
    let newValue = value;
    for (const update of updates) {
      newValue = update(newValue);
    }
    updates.splice(0, updates.length);
    if (!equalsFn!(value, newValue)) {
      value = newValue;
      // oxlint-disable-next-line no-useless-spread
      for (const listener of [...listeners]) {
        listener(value);
      }
    }
  }

  const signal: Signal<T | undefined> = {
    // @ts-expect-error --- Secret variable for internal use
    __isSignal: true,
    get: () => {
      allSignalListener?.(signal);
      return value;
    },
    update: (cb) => {
      updates.push(cb);
      if (!signalUpdates.has(id)) {
        signalUpdates.set(id, () => processUpdates());
      }
      if (processQueued) {
        return;
      }
      queueMicrotask(() => {
        processSignalUpdates();
      });
      processQueued = true;
    },
    set: (newValue) => {
      signal.update(() => newValue);
    },
    registerDependency: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    unregisterAllDependencies: () => {
      listeners.clear();
    },
    cleanup: () => {
      signal.unregisterAllDependencies();
      cleanedUp = true;
    },
  };

  processUpdates();

  return signal;
}

export function storeSignal<T>(key: string): Signal<T | undefined>;
export function storeSignal<T>(
  key: string,
  initialValue: T,
  options?: {
    equalsFn?: (a: T, b: T) => boolean;
    storage?: Storage;
  },
): Signal<T>;
/**
 * Creates a signal that persists its value in localStorage (or a custom storage) under the given key.
 */
export function storeSignal<T>(
  key: string,
  initialValue?: T,
  options?: {
    equalsFn?: (a: T | undefined, b: T | undefined) => boolean;
    /** Defaults to localStorage */
    storage?: Storage;
  },
): Signal<T | undefined> {
  let storage: Storage;
  if (options?.storage) {
    const { storage: providedStorage } = options;
    storage = providedStorage;
  } else {
    storage = localStorage;
  }
  const preExisting = storage.getItem(key);
  let internalInitialValue: T | undefined = undefined;
  if (preExisting !== null) {
    try {
      internalInitialValue = JSON.parse(preExisting);
    } catch {
      internalInitialValue = initialValue;
    }
  } else {
    internalInitialValue = initialValue;
  }

  const signal = createSignal<T | undefined>(internalInitialValue, {
    equalsFn: options?.equalsFn,
  });
  signal.registerDependency((newValue) => {
    storage.setItem(key, JSON.stringify(newValue));
  });
  return signal;
}

function createReaction(cb: () => void): CleanupFn {
  const deps = new Set<CleanupFn>();

  function listener() {
    react();
  }

  function react() {
    cleanup();
    allSignalListener = track;
    try {
      cb();
    } finally {
      allSignalListener = null;
    }
  }

  function track(signal: Signal<any>) {
    deps.add(signal.registerDependency(listener));
  }

  function cleanup() {
    for (const dep of deps) {
      dep();
    }
    deps.clear();
  }

  react();
  return cleanup;
}

/**
 * Creates a computed read-only signal that derives its value from other signals.
 */
export function computed<T>(cb: () => T): ReadOnlySignal<T> {
  const signal = createSignal<T>(cb());
  const disposeReaction = createReaction(() => {
    signal.set(cb());
  });

  const originalCleanup = signal.cleanup;
  const { set: _set, update: _update, ...rest } = signal;

  return {
    ...rest,
    unregisterAllDependencies: () => {
      disposeReaction();
      originalCleanup?.();
    },
  };
}

/**
 * Creates a side-effect that runs the provided callback whenever its dependencies change.
 */
export function effect(cb: () => void): CleanupFn {
  const disposeReaction = createReaction(cb);
  return disposeReaction;
}

/**
 * Verifies that the passed object is a signal.
 */
export function isSignal(obj: any): obj is Signal<any> {
  return obj && obj.__isSignal === true;
}
