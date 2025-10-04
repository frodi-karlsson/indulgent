import { NextMicroTaskEmitter, type ValueArgs } from './eventEmitter.js';

interface SignalOptions<T> {
  equalsFn?: (a: T, b: T) => boolean;
  logger?: (message: string) => void;
}

/**
 * Describes a signal that can be read from.
 *
 * The important part to understand is `signal.get()`. The rest are intended
 * to be called by library code, although you can call them if you want to.
 */
export interface ReadSignal<T> {
  /**
   * A marker property to identify this as a signal-like object.
   */
  _readSignal: true;
  /**
   * Get the current value of the signal.
   * If done inside a reactive context (computed signal or effect),
   * the signal will be tracked as a dependency.
   *
   * @example
   * ```ts
   * const count = signal(0);
   * console.log(count.get()); // 0
   * count.set(5);
   * console.log(count.get()); // 5
   * ```
   */
  get(): T;
  /**
   * Register a listener that will be called when the signal's value changes.
   */
  registerDependent(listener: (value: T) => void): void;
  /**
   * Unregister a listener that was previously registered.
   */
  unregisterDependent(listener: (value: T) => void): boolean;
  /**
   * Unregister all listeners that were previously registered.
   */
  unregisterAllDependents(): void;
}

/**
 * Describes a signal that can be written to.
 */
export interface WriteSignal<T> {
  /**
   * A marker property to identify this as a signal-like object.
   */
  _writeSignal: true;
  /**
   * Queues setting a new value for the signal to the next microtask.
   * If the new value is different from the current value (based on the equality function),
   * all registered dependents will be notified of the new value.
   */
  set(newValue: T): void;
  /**
   * Queues updating the signal's value based on its current value to the next microtask.
   * If the new value is different from the current value (based on the equality function),
   * all registered dependents will be notified of the new value.
   */
  update(cb: (oldValue: T) => T): void;
}

export type Signal<T> = ReadSignal<T> & WriteSignal<T>;

class SignalImplementation<T> implements Signal<T> {
  _readSignal = true as const;
  _writeSignal = true as const;
  private value: T;
  private equalsFn: (a: T, b: T) => boolean;
  private emitter: NextMicroTaskEmitter<T>;
  private dependents = new Set<(value: T) => void>();
  private logger?: (message: string) => void;

  constructor(initialValue: T, options?: SignalOptions<T>) {
    this.value = initialValue;
    this.equalsFn =
      options?.equalsFn ?? ((a, b) => JSON.stringify(a) === JSON.stringify(b));
    this.logger = options?.logger;
    this.emitter = new NextMicroTaskEmitter<T>((msg) => {
      this.logger?.(`Emitter: ${msg}`);
    });
  }

  get(): T {
    this.logger?.(`Signal get: ${this.value}`);
    reaction?.(this);
    return this.value;
  }

  set(newValue: T): void {
    this.logger?.(`Signal set: ${newValue}`);
    if (!this.equalsFn(this.value, newValue)) {
      this.value = newValue;
      this.emitter.emit(newValue as ValueArgs<T>);
    }
  }

  update(cb: (oldValue: T) => T): void {
    this.logger?.(`Signal update`);
    const newValue = cb(this.value);
    this.set(newValue);
  }

  registerDependent(listener: (value: T) => void): void {
    this.logger?.(`Registering dependent for signal`);
    const previousSize = this.dependents.size;
    this.dependents.add(listener);
    if (this.dependents.size > previousSize) {
      this.emitter.on(listener);
    }
  }

  unregisterDependent(listener: (value: T) => void): boolean {
    this.logger?.(`Unregistering dependent for signal`);
    const found = this.dependents.delete(listener);
    if (found) {
      this.emitter.off(listener);
    }
    return found;
  }

  unregisterAllDependents(): void {
    this.logger?.(`Unregistering all dependents for signal`);
    for (const listener of this.dependents) {
      this.emitter.off(listener);
    }
    this.dependents.clear();
  }
}

export function signal<T extends undefined>(): Signal<T>;
export function signal<T>(
  initialValue: T,
  options?: SignalOptions<T>,
): Signal<T>;
export function signal<T>(
  initialValue?: T,
  options?: SignalOptions<T>,
): Signal<T> {
  return new SignalImplementation(initialValue as T, options);
}

export function storeSignal<T extends undefined>(key: string): Signal<T>;
export function storeSignal<T>(
  key: string,
  initialValue: T,
  options?: SignalOptions<T> & { storage?: Storage },
): Signal<T>;
export function storeSignal<T>(
  key: string,
  initialValue?: T,
  options?: SignalOptions<T> & { storage?: Storage },
): Signal<T> {
  const storage = options?.storage ?? localStorage;
  const storedValue = storage.getItem(key);
  let parsedValue: T;
  if (storedValue !== null) {
    try {
      parsedValue = JSON.parse(storedValue) as T;
    } catch (error) {
      throw new SignalError(
        `Failed to parse stored value for key "${key}": ${error}`,
      );
    }
  } else {
    parsedValue = initialValue as T;
    storage.setItem(key, JSON.stringify(parsedValue));
  }
  const signalInstance = signal<T>(parsedValue, options);
  signalInstance.registerDependent((newValue) => {
    storage.setItem(key, JSON.stringify(newValue));
  });
  return signalInstance;
}

// not concurrency-safe
let reaction: ((signal: ReadSignal<any>) => void) | null = null;

function track<T>(callback: () => T): ReadSignal<any>[] {
  const prevReaction = reaction;
  const signals: ReadSignal<any>[] = [];
  reaction = (signal: ReadSignal<any>) => {
    signals.push(signal);
  };
  try {
    callback();
  } finally {
    reaction = prevReaction;
  }
  return signals;
}

export class ComputedSignalImplementation<T> implements ReadSignal<T> {
  _readSignal = true as const;
  private computeFn: () => T;
  private signal: SignalImplementation<T>;
  private dependencies = new Set<ReadSignal<any>>();
  private logger?: (message: string) => void;

  constructor(computeFn: () => T, options?: SignalOptions<T>) {
    this.computeFn = computeFn;
    this.signal = new SignalImplementation(undefined as T, {
      logger: (msg) => {
        options?.logger?.(`Internal: ${msg}`);
      },
    });
    this.logger = options?.logger;
    this.track();
  }

  private dependencyFn = () => {
    this.logger?.(`Computed signal dependency changed`);
    this.track();
  };

  private track(): void {
    let value: T | undefined;
    const dependencies = track(() => {
      value = this.computeFn();
      this.logger?.(`Computed value updated to ${value}`);
    });
    this.signal.set(value as T);
    this.dependencies.forEach((dep) => {
      if (dependencies.includes(dep)) {
        return;
      } else {
        this.logger?.(`Dependency no longer needed, unregistering`);
        const found = dep.unregisterDependent(this.dependencyFn);
        if (found) {
          this.logger?.(`Unregistered dependency from computed signal`);
        } else {
          this.logger?.(`Dependency was not found in computed signal`);
        }
      }
    });
    for (const dep of dependencies) {
      if (this.dependencies.has(dep)) {
        continue;
      } else {
        this.logger?.(`New dependency found, registering`);
        dep.registerDependent(this.dependencyFn);
        this.logger?.(`Registered dependency for computed signal`);
      }
      this.dependencies.add(dep);
    }
    this.logger?.(
      `Computed signal tracking ${dependencies.length} dependencies`,
    );
  }

  get() {
    this.logger?.(`Getting computed signal value`);
    return this.signal.get();
  }

  registerDependent(listener: (value: T) => void) {
    this.logger?.(`Registering dependent for computed signal`);
    this.signal.registerDependent(listener);
  }

  unregisterDependent(listener: (value: T) => void) {
    this.logger?.(`Unregistering dependent for computed signal`);
    return this.signal.unregisterDependent(listener);
  }

  unregisterAllDependents() {
    this.logger?.(`Unregistering all dependents for computed signal`);
    this.signal.unregisterAllDependents();
  }
}

export function computed<T>(
  computeFn: () => T,
  options?: SignalOptions<T>,
): ComputedSignalImplementation<T> {
  return new ComputedSignalImplementation(computeFn, options);
}

export class Effect {
  private effectFn: () => void;
  private dependencies = new Set<ReadSignal<any>>();

  constructor(effectFn: () => void) {
    this.effectFn = effectFn;
    this.track();
  }

  private track() {
    const signals = track(() => {
      this.effectFn();
    });
    for (const dep of this.dependencies) {
      if (signals.includes(dep)) {
        continue;
      } else {
        dep.unregisterDependent(this.track.bind(this));
        this.dependencies.delete(dep);
      }
    }
    for (const signal of signals) {
      if (this.dependencies.has(signal)) {
        continue;
      } else {
        signal.registerDependent(this.track.bind(this));
        this.dependencies.add(signal);
      }
    }
  }
}

export function effect(effectFn: () => void | (() => void)): void {
  const _ = new Effect(effectFn);
}

export class SignalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SignalError';
  }
}
