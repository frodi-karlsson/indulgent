# indulgent-dom

An extremely lightweight DOM binding library for [indulgent](https://frodi-karlsson.github.io/indulgent/) signals. No syntax that can't be rendered in plain HTML, no virtual DOM, no frameworks.

Can either be used as a module, with a bundler, or directly in the browser with a script tag, e.g `<script src="https://unpkg.com/indulgent-dom/dist/index.cdn.js"></script>`.

See more details in the docs.

## DOM bindings

Bind indulgent signals to DOM elements using custom attributes.

- `obind:` - one-way binding from signal to DOM element
- `ibind:` - one-way binding from DOM element to signal
- `iobind:` - two-way binding between signal and DOM element
- `bind:for` - repeat an element for each item in a signal array (WIP)

```ts
import { signal } from 'indulgent/signal';
import { initIndulgent } from 'indulgent-dom';

const name = signal('World');
const address = signal('Earth');
const items = signal(['Item 1', 'Item 2', 'Item 3']);

initIndulgent({ address, name, items });
// initIndulgent can be called multiple times
// in case you want to do it per-fragment or
// something along those lines
```

```html
<div obind:text_content="name"></div>
<input ibind:value="name" />
<input iobind:value="address" />
<button onclick="address.set('Mars')">Set address to Mars</button>
<ul>
  <li bind:for="item of items" obind:text_content="item"></li>
</ul>
```

As you can see, the library aims for supporting differently cased property names through snake_case.
Here are some examples of supported properties:

- `textContent` / `text_content`
- `innerHTML` / `inner_html`
- `value`
- `checked`
