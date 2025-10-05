import {
  type MockInstance,
  afterAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';
import { computed, signal } from 'indulgent/signal';
import { initIndulgent } from './index.js';

beforeEach(() => {
  document.body.innerHTML = '';
  vi.useFakeTimers();
});

afterAll(() => {
  vi.useRealTimers();
});

function expectLog(spy: MockInstance<any>, ...args: any[]) {
  expect(spy).toHaveBeenCalledWith(
    expect.any(String), // timestamp
    '[IndulgentDOM]',
    ...args,
  );
}

describe('initIndulgent', () => {
  describe('obind', () => {
    test('should bind signal to element property', async () => {
      document.body.innerHTML = `
        <div>
          <input id="input" type="text" obind:value="mySignal" />
        </div>
      `;
      const input = document.getElementById('input') as HTMLInputElement;
      const ctx = {
        mySignal: signal('Initial Value'),
      };

      initIndulgent(ctx, { root: document.body });

      expect(input.value).toBe('Initial Value');

      ctx.mySignal.set('Updated Value');
      await vi.runAllTimersAsync();

      expect(input.value).toBe('Updated Value');
    });

    test('should create reactive bindings for object paths', async () => {
      document.body.innerHTML = `
        <div>
          <input id="input" type="text" obind:value="user.name" />
        </div>
      `;
      const input = document.getElementById('input') as HTMLInputElement;
      const ctx = {
        user: signal({ name: 'Alice', age: 30 }),
      };

      initIndulgent(ctx, { root: document.body });

      expect(input.value).toBe('Alice');

      ctx.user.update((u) => ({ ...u, name: 'Bob' }));
      await vi.runAllTimersAsync();

      expect(input.value).toBe('Bob');
    });
  });
  describe('ibind', () => {
    test('should update signal on input event', async () => {
      document.body.innerHTML = `
        <div>
          <input id="input" type="text" ibind:value="mySignal" />
        </div>
      `;
      const input = document.getElementById('input') as HTMLInputElement;
      const ctx = {
        mySignal: signal('Initial Value'),
      };

      initIndulgent(ctx, { root: document.body });
      expect(ctx.mySignal.get()).toBe('Initial Value');

      input.value = 'User Input';
      input.dispatchEvent(new Event('input'));

      await vi.runAllTimersAsync();
      expect(ctx.mySignal.get()).toBe('User Input');
    });

    test('should warn if signal is object path', () => {
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {});

      document.body.innerHTML = `
        <div>
          <input id="input" type="text" ibind:value="user.name" />
        </div>
      `;
      const ctx = {
        user: signal({ name: 'Alice', age: 30 }),
      };

      initIndulgent(ctx, { root: document.body, debug: true });
      expectLog(
        consoleWarnSpy,
        'Signal "user.name" is not writable, cannot set up input binding for property "value"',
      );

      consoleWarnSpy.mockRestore();
    });
  });
  describe('iobind', () => {
    test('should bind signal to element property and update signal on input event', async () => {
      document.body.innerHTML = `
        <div>
          <input id="input" type="text" iobind:value="mySignal" />
        </div>
      `;
      const input = document.getElementById('input') as HTMLInputElement;
      const ctx = {
        mySignal: signal('Initial Value'),
      };

      initIndulgent(ctx, { root: document.body });
      expect(input.value).toBe('Initial Value');

      ctx.mySignal.set('Updated Value');
      await vi.runAllTimersAsync();
      expect(input.value).toBe('Updated Value');

      input.value = 'User Input';
      input.dispatchEvent(new Event('input'));

      await vi.runAllTimersAsync();
      expect(ctx.mySignal.get()).toBe('User Input');
    });

    test('should warn for unsupported property binding', () => {
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {});

      document.body.innerHTML = `
        <div>
          <input id="input" type="text" iobind:title="mySignal" />
        </div>
      `;
      const ctx = {
        mySignal: signal('Initial Value'),
      };

      initIndulgent(ctx, { root: document.body, debug: true });
      expectLog(
        consoleWarnSpy,
        'Input binding for property "title" is not supported out of the box. Please set up a custom event listener to update the signal.',
      );

      consoleWarnSpy.mockRestore();
    });

    test('should warn if signal not found in context', () => {
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {});

      document.body.innerHTML = `
        <div>
          <input id="input" type="text" iobind:value="nonExistentSignal" />
        </div>
      `;
      const ctx = {
        mySignal: signal('Initial Value'),
      };

      initIndulgent(ctx, { root: document.body, debug: true });
      expectLog(
        consoleWarnSpy,
        'Signal not found in context and not a path: "nonExistentSignal"',
      );

      consoleWarnSpy.mockRestore();
    });

    test('should warn if context property is not a signal', () => {
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {});

      document.body.innerHTML = `
        <div>
          <input id="input" type="text" iobind:value="notASignal" />
        </div>
      `;
      const ctx = {
        notASignal: 42,
      };

      initIndulgent(ctx as any, { root: document.body, debug: true });
      expectLog(consoleWarnSpy, '"notASignal" is not a signal');

      consoleWarnSpy.mockRestore();
    });

    const lowerCasePropertyTests = [
      { attr: 'obind:inner_html', prop: 'innerHTML' },
      { attr: 'obind:inner_text', prop: 'innerText' },
      { attr: 'obind:text_content', prop: 'textContent' },
    ];
    test.each(lowerCasePropertyTests)(
      'should handle lower_case property names in bindings: $attr -> $prop',
      async ({ attr, prop }) => {
        document.body.innerHTML = `
        <div>
          <div id="div" ${attr}="mySignal"></div>
        </div>
      `;
        const div = document.getElementById('div') as HTMLDivElement;
        const ctx = {
          mySignal: signal('Initial Value'),
        };

        initIndulgent(ctx, { root: document.body });
        expect((div as any)[prop]).toBe('Initial Value');

        ctx.mySignal.set('Updated Value');
        await vi.runAllTimersAsync();

        expect((div as any)[prop]).toBe('Updated Value');
      },
    );

    test('should handle computed signal depending on another computed signal', async () => {
      document.body.innerHTML = `
        <div>
          <h1 id="header" obind:text_content="computedSignal2"></h1>
        </div>
      `;
      const baseSignal = signal('World');
      const computedSignal = computed(() => `Hello, ${baseSignal.get()}!`);
      const computedSignal2 = computed(() =>
        computedSignal.get().toUpperCase(),
      );
      const ctx = {
        computedSignal2,
      };
      initIndulgent(ctx, { root: document.body });

      const header = document.getElementById('header') as HTMLHeadingElement;
      expect(header.textContent).toBe('HELLO, WORLD!');

      baseSignal.set('Indulgent');
      await vi.runAllTimersAsync();
      expect(header.textContent).toBe('HELLO, INDULGENT!');
    });

    test('should create reactive bindings for nested object paths and warn that input binding is not supported', async () => {
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {});

      document.body.innerHTML = `
        <div>
          <input id="input" type="text" iobind:value="user.name" />
        </div>
      `;
      const input = document.getElementById('input') as HTMLInputElement;
      const ctx = {
        user: signal({ name: 'Alice', age: 30 }),
      };

      initIndulgent(ctx, { root: document.body, debug: true });
      expect(input.value).toBe('Alice');
      expectLog(
        consoleWarnSpy,
        'Signal "user.name" is not writable, cannot set up input binding for property "value"',
      );

      ctx.user.update((u) => ({ ...u, name: 'Bob' }));
      await vi.runAllTimersAsync();

      expect(input.value).toBe('Bob');

      consoleWarnSpy.mockRestore();
    });
  });

  describe('multiple bindings', () => {
    test('should handle multiple bindings on the same element', async () => {
      document.body.innerHTML = `
        <div>
          <input id="input" type="text" ibind:value="valueSignal" obind:placeholder="placeholder" />
        </div>
      `;

      const input = document.getElementById('input') as HTMLInputElement;
      const ctx = {
        valueSignal: signal(''),
        placeholder: signal('Placeholder'),
      };

      initIndulgent(ctx, { root: document.body });
      expect(input.placeholder).toBe('Placeholder');
      expect(input.value).toBe('');

      ctx.placeholder.set('New Placeholder');
      await vi.runAllTimersAsync();
      expect(input.placeholder).toBe('New Placeholder');

      input.value = 'User Input';
      input.dispatchEvent(new Event('input'));
      await vi.runAllTimersAsync();
      expect(ctx.valueSignal.get()).toBe('User Input');
    });
  });

  describe('multiple calls to initIndulgent', () => {
    test('should handle multiple calls to initIndulgent on the same root', async () => {
      document.body.innerHTML = `
        <div>
          <input id="input1" type="text" obind:value="signal1" />
          <input id="input2" type="text" obind:value="signal2" />
        </div>
      `;

      const input1 = document.getElementById('input1') as HTMLInputElement;
      const input2 = document.getElementById('input2') as HTMLInputElement;
      const ctx1 = {
        signal1: signal('Value 1'),
      };
      const ctx2 = {
        signal2: signal('Value 2'),
      };

      initIndulgent(ctx1, { root: document.body, debug: true });
      initIndulgent(ctx2, { root: document.body, debug: true });

      expect(input1.value).toBe('Value 1');
      expect(input2.value).toBe('Value 2');

      ctx1.signal1.set('Updated Value 1');
      ctx2.signal2.set('Updated Value 2');
      await vi.runAllTimersAsync();

      expect(input1.value).toBe('Updated Value 1');
      expect(input2.value).toBe('Updated Value 2');
    });

    test('should not re-initialize bindings on subsequent calls to initIndulgent with same root', async () => {
      const consoleLogSpy = vi
        .spyOn(console, 'info')
        .mockImplementation(() => {});

      document.body.innerHTML = `
        <div>
          <input id="input" type="text" obind:value="mySignal" />
        </div>
      `;
      const input = document.getElementById('input') as HTMLInputElement;
      const ctx = {
        mySignal: signal('Initial Value'),
      };

      initIndulgent(ctx, { root: document.body, debug: true });
      expect(input.value).toBe('Initial Value');
      expectLog(
        consoleLogSpy,
        'Setting up output binding for property "value" and signal "mySignal"',
      );

      consoleLogSpy.mockClear();

      // Second call with same root
      initIndulgent(ctx, { root: document.body, debug: true });
      expect(input.value).toBe('Initial Value');
      expect(consoleLogSpy).not.toHaveBeenCalled();

      consoleLogSpy.mockRestore();
    });

    test('should initialize bindings for new root elements', async () => {
      document.body.innerHTML = `
        <div id="root1">
          <input id="input1" type="text" obind:value="signal1" />
        </div>
        <div id="root2">
          <input id="input2" type="text" obind:value="signal2" />
        </div>
      `;

      const root1 = document.getElementById('root1') as HTMLDivElement;
      const root2 = document.getElementById('root2') as HTMLDivElement;
      const input1 = document.getElementById('input1') as HTMLInputElement;
      const input2 = document.getElementById('input2') as HTMLInputElement;
      const ctx1 = {
        signal1: signal('Value 1'),
      };
      const ctx2 = {
        signal2: signal('Value 2'),
      };

      initIndulgent(ctx1, { root: root1, debug: true });
      expect(input1.value).toBe('Value 1');

      initIndulgent(ctx2, { root: root2, debug: true });
      expect(input2.value).toBe('Value 2');
    });
  });
});

describe('for bindings', () => {
  test('should repeat template for each item in signal array', async () => {
    document.body.innerHTML = `
      <div>
        <p class="item" bind:for="item of itemsSignal" obind:text_content="item"></p>
      </div>
    `;
    const ctx = {
      itemsSignal: signal(['One', 'Two']),
    };
    initIndulgent(ctx, { root: document.body, debug: true });

    let items: string[] = [];
    document.querySelectorAll('.item').forEach((el) => {
      items.push(el.textContent || '');
    });
    expect(items).toEqual(['One', 'Two']);

    ctx.itemsSignal.set(['One', 'Two', 'Three']);
    await vi.runAllTimersAsync();

    items = [];
    document.querySelectorAll('.item').forEach((el) => {
      items.push(el.textContent || '');
    });
    expect(items).toEqual(['One', 'Two', 'Three']);

    ctx.itemsSignal.set(['One']);
    await vi.runAllTimersAsync();

    items = [];
    document.querySelectorAll('.item').forEach((el) => {
      items.push(el.textContent || '');
    });
    expect(items).toEqual(['One']);
  });

  test('should handle for binding with item path', async () => {
    document.body.innerHTML = `
      <div>
        <p class="item" bind:for="item of itemsSignal" obind:text_content="item.name"></p>
      </div>
    `;
    const ctx = {
      itemsSignal: signal([{ name: 'Alice' }, { name: 'Bob' }]),
    };
    initIndulgent(ctx, { root: document.body, debug: true });

    let items: string[] = [];
    document.querySelectorAll('.item').forEach((el) => {
      items.push(el.textContent || '');
    });
    expect(items).toEqual(['Alice', 'Bob']);

    ctx.itemsSignal.set([{ name: 'Charlie' }]);
    await vi.runAllTimersAsync();

    items = [];
    document.querySelectorAll('.item').forEach((el) => {
      items.push(el.textContent || '');
    });
    expect(items).toEqual(['Charlie']);
  });

  test('should handle for binding with tracker function', async () => {
    document.body.innerHTML = `
      <div>
        <p class="item" bind:for="item of itemsSignal by item.id" obind:text_content="item.name"></p>
      </div>
    `;
    const ctx = {
      itemsSignal: signal([
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ]),
    };
    initIndulgent(ctx, { root: document.body, debug: true });

    let items: string[] = [];
    document.querySelectorAll('.item').forEach((el) => {
      items.push(el.textContent || '');
    });
    expect(items).toEqual(['Alice', 'Bob']);

    // Update Bob's name, should not recreate element
    ctx.itemsSignal.set([
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Robert' },
    ]);
    await vi.runAllTimersAsync();

    items = [];
    document.querySelectorAll('.item').forEach((el) => {
      items.push(el.textContent || '');
    });
    expect(items).toEqual(['Alice', 'Robert']);

    // Remove Alice, add Charlie
    ctx.itemsSignal.set([
      { id: 2, name: 'Robert' },
      { id: 3, name: 'Charlie' },
    ]);
    await vi.runAllTimersAsync();

    items = [];
    document.querySelectorAll('.item').forEach((el) => {
      items.push(el.textContent || '');
    });
    expect(items).toEqual(['Robert', 'Charlie']);
  });

  test('should handle empty array in for binding', async () => {
    document.body.innerHTML = `
      <div>
        <p class="item" bind:for="item of itemsSignal" obind:text_content="item"></p>
      </div>
    `;
    const ctx = {
      itemsSignal: signal<string[]>([]),
    };
    initIndulgent(ctx, { root: document.body, debug: true });

    let items: string[] = [];
    document.querySelectorAll('.item').forEach((el) => {
      items.push(el.textContent || '');
    });
    expect(items).toEqual([]);

    ctx.itemsSignal.set(['First']);
    await vi.runAllTimersAsync();

    items = [];
    document.querySelectorAll('.item').forEach((el) => {
      items.push(el.textContent || '');
    });
    expect(items).toEqual(['First']);
  });

  test('should handle children referencing item in for binding', async () => {
    document.body.innerHTML = `
      <div>
        <div class="item" bind:for="item of itemsSignal">
          <h2 obind:text_content="item.name"></h2>
          <p obind:text_content="item.description"></p>
        </div>
      </div>
    `;
    const ctx = {
      itemsSignal: signal([
        { id: 1, name: 'Alice', description: 'A software engineer.' },
        { id: 2, name: 'Bob', description: 'A product manager.' },
      ]),
    };
    initIndulgent(ctx, { root: document.body, debug: true });

    let items: { name: string; description: string }[] = [];
    document.querySelectorAll('.item').forEach((el) => {
      const name = el.querySelector('h2')?.textContent || '';
      const description = el.querySelector('p')?.textContent || '';
      items.push({ name, description });
    });
    expect(items).toEqual([
      { name: 'Alice', description: 'A software engineer.' },
      { name: 'Bob', description: 'A product manager.' },
    ]);

    ctx.itemsSignal.set([
      { id: 1, name: 'Alice', description: 'A senior software engineer.' },
      { id: 3, name: 'Charlie', description: 'A UX designer.' },
    ]);
    await vi.runAllTimersAsync();

    items = [];
    document.querySelectorAll('.item').forEach((el) => {
      const name = el.querySelector('h2')?.textContent || '';
      const description = el.querySelector('p')?.textContent || '';
      items.push({ name, description });
    });
    expect(items).toEqual([
      { name: 'Alice', description: 'A senior software engineer.' },
      { name: 'Charlie', description: 'A UX designer.' },
    ]);
  });
});
