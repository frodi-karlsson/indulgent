import * as indulgent from 'indulgent/index.js';
import {
  type Logger,
  type LoggerLevel,
  createBaseLogger,
  getPath,
  isObject,
} from 'indulgent/util';
import { type ReadSignal, type WriteSignal, computed } from 'indulgent/signal';

const commonPropertyBindings: Record<string, string> = {
  inner_text: 'innerText',
  text_content: 'textContent',
  inner_html: 'innerHTML',
};

const inputBindings: Record<string, [string, (el: HTMLElement) => any]> = {
  value: ['input', (el) => (el as HTMLInputElement).value],
  checked: ['change', (el) => (el as HTMLInputElement).checked],
  selected: ['change', (el) => (el as HTMLOptionElement).selected],
  open: ['toggle', (el) => (el as HTMLDetailsElement).open],
};

function getComputedLogger(baseLogger: Logger | undefined): Logger | undefined {
  if (!baseLogger) {
    return undefined;
  }

  function logger(severity: LoggerLevel, message: string, ...args: any[]) {
    baseLogger?.(severity, message, ...args);
  }

  return Object.assign(logger, { context: `${baseLogger.context}->COMPUTED` });
}

/**
 * Creates and removes signals for each element of the given array signal, based on the current value of the array.
 *
 * Signals are added to the given context object with keys in the format `__indulgent_for_${name}_${index}`.
 */
function manageArraySignals(
  ctx: Record<string, ReadSignal<any> | WriteSignal<any>>,
  name: string,
  signal: ReadSignal<any[]>,
  path: string | undefined,
  logger: Logger | undefined,
) {
  // oxlint-disable-next-line func-style
  const update = () => {
    const array = signal.get();
    if (!Array.isArray(array)) {
      logger?.('warn', `Signal ${name} is not an array`, array);
      return;
    }
    // clean up any old signals that are no longer needed
    Object.keys(ctx).forEach((key) => {
      const match = key.match(new RegExp(`^__indulgent_for_${name}_(\\d+)$`));
      if (match) {
        const index = parseInt(match[1], 10);
        if (index >= array.length) {
          delete ctx[key];
        }
      }
    });
    array.forEach((item, index) => {
      const key = `__indulgent_for_${name}_${index}`;
      if (!(key in ctx)) {
        ctx[key] = computed(
          () => {
            const arr = signal.get();
            return arr[index];
          },
          { logger: getComputedLogger(logger) },
        );
        return;
      }

      let reference = item;
      if (path) {
        reference = getPath(item, path);
        if (reference === undefined) {
          logger?.('warn', `Tracker path "${path}" not found on item`, item);
          reference = item;
        }
      }
      const existingSignal = ctx[key];
      if (!isReadSignal(existingSignal)) {
        logger?.('warn', `Signal ${key} is not a read signal`);
        return;
      }

      const existingSignalValue = existingSignal.get();
      let existingSignalRef = existingSignalValue;
      if (path) {
        existingSignalRef = getPath(existingSignalValue, path);
      }

      if (existingSignalRef !== reference) {
        existingSignal.unregisterAllDependents();
        delete ctx[key];
        ctx[key] = computed(
          () => {
            const arr = signal.get();
            return arr[index];
          },
          { logger: getComputedLogger(logger) },
        );
      }
    });
  };
  signal.registerDependent(update);
  update();
}

function replaceSignalNameInBindings(
  el: HTMLElement,
  oldName: string,
  newName: string,
): void {
  // oxlint-disable-next-line prefer-spread
  const elements = [el, ...Array.from(el.children)];
  elements.forEach((el) => {
    const attributeArr = getBindingAttrs(el);
    const bindings = attributeArr.filter((attr) =>
      ['ibind', 'obind', 'iobind'].some((prefix) =>
        attr.startsWith(`${prefix}:`),
      ),
    );
    bindings.forEach((binding) => {
      const signalName = el.getAttribute(binding);
      if (!signalName) {
        return;
      }
      const parts = signalName.split('.');
      if (parts[0] === oldName) {
        parts[0] = newName;
        const newSignalName = parts.join('.');
        el.removeAttribute(binding);
        el.setAttribute(binding, newSignalName);
      }
    });
  });
}

function validateForAttr(
  ctx: Record<string, ReadSignal<any> | WriteSignal<any>>,
  forAttr: string,
  logger: Logger | undefined,
):
  | {
      itemName: string;
      signalName: string;
      trackerPath?: string;
      signal: ReadSignal<any[]>;
    }
  | undefined {
  const match = forAttr.match(
    // item of items by item.id
    /^\s*(\w+)\s+of\s+(\w+)(?:\s+by\s+([\w.]+))?\s*$/,
  );
  if (!match) {
    logger?.(
      'error',
      `Invalid syntax for bind:for attribute: "${forAttr}". Expected format "item of items" or "item of items by item.id"`,
    );
    return;
  }

  const [, itemName, signalName, trackerPath] = match;
  const signal = validateSignal(ctx, signalName, logger);
  if (!signal) {
    return;
  }
  if (!isArrayReadSignal(signal)) {
    logger?.(
      'error',
      `Signal "${signalName}" is not an array, cannot use it in bind:for`,
    );
    return;
  }
  return { itemName, signalName, trackerPath, signal };
}

function handleForBindings(
  forBoundElements: HTMLElement[],
  ctx: Record<string, ReadSignal<any> | WriteSignal<any>>,
  root: HTMLElement,
  logger: Logger | undefined,
) {
  forBoundElements.forEach((el) => {
    const forAttr = el.getAttribute('bind:for');
    if (!forAttr) {
      return;
    }

    const validated = validateForAttr(ctx, forAttr, logger);
    if (!validated) {
      return;
    }
    const { itemName, signalName, trackerPath, signal } = validated;

    const parent = el.parentElement;
    if (!parent) {
      logger?.('error', `Element with bind:for must have a parent element`, el);
      return;
    }

    const placeholder = root.ownerDocument.createComment(`for ${forAttr}`);
    el.replaceWith(placeholder);

    // oxlint-disable-next-line func-style
    const update = () => {
      const signal = validateSignal(ctx, signalName, logger);
      if (!isArrayReadSignal(signal)) {
        logger?.('warn', `Signal ${signalName} is not an array`);
        return;
      }
      const array = signal.get();
      manageArraySignals(ctx, signalName, signal, trackerPath, logger);

      const existingElements: HTMLElement[] = [];
      let { nextSibling } = placeholder;
      while (
        nextSibling &&
        nextSibling instanceof HTMLElement &&
        nextSibling.hasAttribute('data-indulgent-for') &&
        nextSibling.getAttribute('data-indulgent-for') === forAttr
      ) {
        existingElements.push(nextSibling);
        ({ nextSibling } = nextSibling);
      }

      const expectedElements: HTMLElement[] = [];
      array.forEach((_, index) => {
        const key = `__indulgent_for_${signalName}_${index}`;
        const newElement = el.cloneNode(true) as HTMLElement;
        newElement.removeAttribute('bind:for');
        newElement.setAttribute('data-indulgent-for', forAttr);
        expectedElements.push(newElement);
        if (index < existingElements.length) {
          existingElements[index].replaceWith(newElement);
        } else {
          nextSibling?.before(newElement);
        }

        newElement.setAttribute('data-indulgent-for-key', key);
      });

      // remove any excess existing elements
      existingElements.forEach((el) => {
        if (!expectedElements.includes(el)) {
          el.remove();
        }
      });

      // reorder elements to match expected order
      expectedElements.forEach((el, idx) => {
        if (el !== parent.children[idx]) {
          parent.children[idx]?.before(el);
        }
      });

      // set up bindings on the new elements, using a mock context that includes the item signals
      expectedElements.forEach((element, index) => {
        const key = `__indulgent_for_${signalName}_${index}`;

        replaceSignalNameInBindings(element, itemName, key);
        // oxlint-disable-next-line prefer-spread
        createBindings([element, ...Array.from(element.children)], ctx, logger);
      });
    };
    signal.registerDependent(update);
    update();
  });
}

function toProperty(bindingName: string): string {
  const commonBinding = commonPropertyBindings[bindingName.toLowerCase()];
  if (commonBinding) {
    return commonBinding;
  }

  const parts = bindingName.split('_');

  if (parts.length === 1) {
    return parts[0].toLowerCase();
  }

  return parts
    .map((part, index) => {
      if (index === 0) {
        return part.toLowerCase();
      }
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join('');
}

function validateSignal(
  ctx: Record<string, ReadSignal<any> | WriteSignal<any>>,
  name: string,
  logger: Logger | undefined,
): ReadSignal<any> | WriteSignal<any> | undefined {
  const signal = ctx[name];
  if (!isReadSignal(signal) && !isWriteSignal(signal)) {
    logger?.('warn', `"${name}" is not a signal`);
    return;
  }
  return signal;
}

function isWriteSignal<T>(signal: any): signal is WriteSignal<T> {
  return (
    signal &&
    isObject(signal) &&
    '_writeSignal' in signal &&
    (signal as any)._writeSignal === true &&
    'update' in signal &&
    typeof signal.update === 'function' &&
    'set' in signal &&
    typeof signal.set === 'function'
  );
}

function isReadSignal<T>(signal: any): signal is ReadSignal<T> {
  return (
    signal &&
    isObject(signal) &&
    '_readSignal' in signal &&
    (signal as any)._readSignal === true &&
    'get' in signal &&
    typeof signal.get === 'function'
  );
}

function isArrayReadSignal(signal: any): signal is ReadSignal<any[]> {
  if (!isReadSignal(signal)) {
    return false;
  }
  const value = signal.get();
  return Array.isArray(value);
}

function setOutBinding(el: Element, property: string, signal: ReadSignal<any>) {
  // oxlint-disable-next-line func-style
  const modifyProperty = (value: any) => {
    if (property in el) {
      (el as any)[property] = value;
    } else {
      el.setAttribute(property, value);
    }
  };

  modifyProperty(signal.get());

  signal.registerDependent(modifyProperty);
}

function setInBinding(
  el: Element,
  property: string,
  signal: WriteSignal<any>,
  logger: Logger | undefined,
) {
  const handler = inputBindings[property];

  if (!handler) {
    logger?.(
      'warn',
      `Input binding for property "${property}" is not supported out of the box. Please set up a custom event listener to update the signal.`,
    );
    return;
  }

  const [eventName, inputGetter] = handler;
  el.addEventListener(eventName, (e) => {
    const target = e.target as HTMLInputElement;
    const value = inputGetter(target);
    signal.set(value);
  });
}

function getBindingAttrs(el: Element): string[] {
  const attributeArr: string[] = [];
  // oxlint-disable-next-line prefer-for-of
  for (let i = 0; i < el.attributes.length; i++) {
    attributeArr.push(el.attributes[i].name);
  }
  return attributeArr.filter((attr) =>
    ['ibind', 'obind', 'iobind'].some((prefix) =>
      attr.startsWith(`${prefix}:`),
    ),
  );
}

// Also handles object paths like signalName.property.subproperty in bindings, creating
// computed signals as necessary.
function getSignal(
  ctx: Record<string, ReadSignal<any> | WriteSignal<any>>,
  signalName: string,
  logger: Logger | undefined,
): ReadSignal<any> | WriteSignal<any> | undefined {
  if (signalName in ctx) {
    return validateSignal(ctx, signalName, logger);
  }

  const parts = signalName.split('.');
  if (parts.length < 2) {
    logger?.(
      'warn',
      `Signal not found in context and not a path: "${signalName}"`,
    );
    return undefined;
  }

  const [baseName] = parts;
  const baseSignal = ctx[baseName];
  if (!isReadSignal(baseSignal)) {
    logger?.(
      'warn',
      `Base signal "${baseName}" not found or not readable for path "${signalName}"`,
    );
    return undefined;
  }
  return computed(
    () => {
      let current = baseSignal.get();
      let partIndex = 1;
      while (partIndex < parts.length) {
        if (current === undefined || current === null) {
          return undefined;
        }
        current = getPath(current, parts[partIndex]);
        partIndex++;
      }
      return current;
    },
    { logger: getComputedLogger(logger) },
  );
}

/**
 * Sets up bindings for the given elements based on their `bind:*` and `iobind:*` attributes.
 * Uses the provided context to resolve signal names to Signal instances.
 * Marks elements as processed by adding a `data-indulgent-id` attribute to avoid duplicate bindings.
 */
function createBindings(
  elements: Element[],
  ctx: Record<string, ReadSignal<any> | WriteSignal<any>>,
  logger: Logger | undefined,
) {
  elements.forEach((el) => {
    if (el.hasAttribute('data-indulgent-id')) {
      return;
    }

    const bindings = getBindingAttrs(el);
    let didAddBinding = false;
    bindings.forEach((binding) => {
      const [bindingType, unparsedProperty] = binding.split(':');
      const property = toProperty(unparsedProperty);
      const signalName = el.getAttribute(binding);
      if (!signalName) {
        logger?.(
          'warn',
          `Element has empty binding for property "${property}"`,
        );
        return;
      }

      const signal = getSignal(ctx, signalName, logger);
      if (!signal) {
        logger?.(
          'warn',
          `Signal "${signalName}" not found in context for property "${property}"`,
          el.outerHTML,
        );
        return;
      }

      if (['iobind', 'obind'].includes(bindingType)) {
        logger?.(
          'info',
          `Setting up output binding for property "${property}" and signal "${signalName}"`,
        );
        if (!isReadSignal(signal)) {
          logger?.(
            'warn',
            `Signal "${signalName}" is not readable, cannot set up output binding for property "${property}"`,
          );
          return;
        }
        setOutBinding(el, property, signal);
        didAddBinding = true;
      }
      if (['iobind', 'ibind'].includes(bindingType)) {
        logger?.(
          'info',
          `Setting up input binding for property "${property}" and signal "${signalName}"`,
        );
        if (!isWriteSignal(signal)) {
          logger?.(
            'warn',
            `Signal "${signalName}" is not writable, cannot set up input binding for property "${property}"`,
          );
          return;
        }
        setInBinding(el, property, signal, logger);
      }
      didAddBinding = true;
    });

    if (!didAddBinding) {
      return;
    }

    const id = ++globalThis.__indulgentData.currentId;
    el.setAttribute('data-indulgent-id', id.toString());
  });
}

const globalCtx: Record<string, ReadSignal<any>> = {};
const roots = new Set<HTMLElement>();

/**
 * Initializes Indulgent DOM bindings.
 * Scans the document for elements with `bind:*` or `iobind:*` attributes and sets up reactive bindings.
 * Also observes the DOM for dynamically added elements and applies bindings to them.
 *
 * `globalThis.indulgent` is defined by including this file. It will contain all indulgent exports, as well as this `init` function.
 * This is the easiest way to use Indulgent in a browser environment, as you can simply include this script via a `<script>` tag from a CDN.
 *
 * It's also perfectly fine to import this file as a module, in which case you can call `initIndulgent` directly.
 *
 * - `obind:*` creates a one-way binding where changes to the signal update the element property.
 * - `ibind:*` creates a one-way binding where changes to the element property update the signal.
 * - `iobind:*` creates a two-way binding between the signal and the element property.
 * - 'bind:for' sets up a loop that repeats the element for each item in an array signal.
 *
 * @example
 * ```html
 * <script src="path/to/indulgent-dom.js"></script>
 * <script>
 *  const count = indulgent.signal(0);
 *  indulgent.init({
 *   count,
 *  });
 *
 *  indulgent.effect(() => {
 *   console.log('Count changed:', count.get());
 *  });
 * </script>
 * <button onclick="count.set(count.get() + 1)">Increment</button>
 * <p obind:textContent="count"></p>
 * ```
 *
 * @example
 * ```html
 * <div bind:for="item in items">
 *   <p obind:textContent="item.name"></p>
 * </div>
 * ```
 */
export function initIndulgent(
  /**
   * A context object mapping signal names to their corresponding Signal instances.
   */
  ctx: Record<string, ReadSignal<any>>,
  opts?: { debug?: boolean; root?: HTMLElement },
): void {
  const { root = document.body, debug = false } = opts || {};
  let logger: Logger | undefined = undefined;
  if (debug) {
    logger = createBaseLogger('IndulgentDOM');
  }
  Object.assign(globalCtx, ctx);

  const didFirstInit = roots.has(root);
  if (!didFirstInit) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          // oxlint-disable-next-line prefer-spread
          const asArr = Array.from(mutation.addedNodes).filter(
            (node): node is HTMLElement =>
              node instanceof HTMLElement &&
              !node.hasAttribute('data-indulgent-id'),
          );
          const forBoundElements = asArr.filter((el) =>
            el.hasAttribute('bind:for'),
          );
          if (forBoundElements.length) {
            handleForBindings(forBoundElements, globalCtx, root, logger);
          }
          createBindings(asArr, globalCtx, logger);
        }
      });
    });

    observer.observe(root, { childList: true, subtree: true });
    roots.add(root);
  }

  const nodeList = root.querySelectorAll<HTMLElement>('*');
  // oxlint-disable-next-line prefer-spread
  const nodeArray = Array.from(nodeList);
  const initialElements = nodeArray.filter(
    (el) => !el.hasAttribute('data-indulgent-id'),
  );
  const forBoundElements = initialElements.filter((el) =>
    el.hasAttribute('bind:for'),
  );
  handleForBindings(forBoundElements, globalCtx, root, logger);
  createBindings(initialElements, globalCtx, logger);
}

if (typeof globalThis !== 'undefined') {
  // For cases where we directly include this script in a browser via a <script> tag instead of bundling it.
  try {
    globalThis.__indulgentData ||= { currentId: 0, globalCtx };
    globalThis.indulgent = indulgent;
    Object.assign(globalThis.indulgent, { init: initIndulgent });
  } catch {}
}
