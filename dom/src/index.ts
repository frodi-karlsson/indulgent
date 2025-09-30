import * as indulgent from 'indulgent/index.js';
import { type Signal, effect, isSignal } from 'indulgent/signal';

const logFns = ['log', 'warn', 'error', 'info', 'debug'] as const;

const commonPropertyBindings: Record<string, string> = {
  inner_text: 'innerText',
  text_content: 'textContent',
  inner_html: 'innerHTML',
};

const inputBindings: Record<string, [string, (el: HTMLElement) => string]> = {
  value: ['input', (el) => (el as HTMLInputElement).value],
  checked: ['change', (el) => (el as HTMLInputElement).checked.toString()],
  selected: ['change', (el) => (el as HTMLOptionElement).selected.toString()],
};

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

function createBindings(
  elements: HTMLElement[],
  ctx: Record<string, Signal<any>>,
  opts?: { debug?: boolean },
) {
  const { debug = false } = opts || {};
  const logger = Object.fromEntries(
    logFns.map((fn) => [
      fn,
      (...args: any[]) => {
        if (debug) {
          console[fn]('[indulgent]', ...args);
        }
      },
    ]),
  );
  elements.forEach((el) => {
    if (el.hasAttribute('data-indulgent-id')) {
      return;
    }

    const attributeArr: string[] = [];
    // oxlint-disable-next-line prefer-for-of
    for (let i = 0; i < el.attributes.length; i++) {
      attributeArr.push(el.attributes[i].name);
    }
    const bindings = attributeArr.filter((attr) =>
      ['ibind', 'obind', 'iobind'].some((prefix) =>
        attr.startsWith(`${prefix}:`),
      ),
    );
    if (!bindings.length) {
      return;
    }

    let didAddBinding = false;
    bindings.forEach((binding) => {
      const [bindingType, unparsedProperty] = binding.split(':');
      const property = toProperty(unparsedProperty);
      const signalName = el.getAttribute(binding);
      if (!signalName) {
        if (debug) {
          logger.warn(
            `Element has empty binding for property "${property}"`,
            el,
          );
        }
        return;
      }

      if (!(signalName in ctx)) {
        logger.warn(`Signal "${signalName}" is not defined in context`);
        return;
      }

      if (!isSignal(ctx[signalName])) {
        logger.warn(`"${signalName}" is not a signal`, ctx[signalName]);
        return;
      }

      const signal = ctx[signalName];
      if (['iobind', 'obind'].includes(bindingType)) {
        if (debug) {
          logger.log(
            `Setting up output binding for property "${property}" and signal "${signalName}"`,
            el,
          );
        }
        effect(() => {
          logger.log('Updating', {
            property,
            value: signal.get(),
            el,
          });
          if (property in el) {
            (el as any)[property] = signal.get();
          } else {
            el.setAttribute(property, signal.get());
          }
        });
      }
      if (['iobind', 'ibind'].includes(bindingType)) {
        if (debug) {
          logger.log(
            `Setting up input binding for property "${property}" and signal "${signalName}"`,
            el,
          );
        }
        const handler = inputBindings[property];
        if (handler) {
          const [eventName, inputGetter] = handler;
          el.addEventListener(eventName, (e) => {
            const target = e.target as HTMLInputElement;
            signal.set(inputGetter(target));
          });
        } else {
          if (debug) {
            logger.warn(
              `Two-way binding for property "${property}" is not supported out of the box. Please set up a custom event listener to update the signal.`,
              el,
            );
          }
        }
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

const globalCtx: Record<string, Signal<any>> = {};
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
 *
 * @example
 * ```html
 * <script src="path/to/indulgent-dom.js"></script>
 * <script>
 *  const count = indulgent.createSignal(0);
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
 */
export function initIndulgent(
  /**
   * A context object mapping signal names to their corresponding Signal instances.
   */
  ctx: Record<string, Signal<any>>,
  opts?: { debug?: boolean; root?: HTMLElement },
): void {
  const { root = document.body } = opts || {};
  Object.assign(globalCtx, ctx);
  const didFirstInit = roots.has(root);
  if (!didFirstInit) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          const asArr: HTMLElement[] = [];
          mutation.addedNodes.forEach((node) => {
            if (node instanceof HTMLElement) {
              asArr.push(node);
            }
          });
          createBindings(asArr, globalCtx, opts);
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
  createBindings(initialElements, globalCtx, opts);
}

if (typeof globalThis !== 'undefined') {
  // For cases where we directly include this script in a browser via a <script> tag instead of bundling it.
  try {
    globalThis.__indulgentData ||= { currentId: 0 };
    globalThis.indulgent = indulgent;
    Object.assign(globalThis.indulgent, { init: initIndulgent });
  } catch {}
}
