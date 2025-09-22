# Indulgent

A simple collection of TypeScript utilities for building web applications, dependency free and with reasonable runtime performance.

See the github.io page for documentation: https://frodi-karlsson.github.io/indulgent/ and the examples directory for example projects.

## ApiService

The main reason to want to use this is rich autocomplete for API calls. See example below:

<img src="/media/example.gif" />

I aim to use this only for my own personal projects, but if you think it looks useful, go ahead and use it / contribute / complain :)

## Signals

A very simple reactive state management system inspired by Angular 17+. Dependencies are tracked automatically, and updates are batched to avoid unnecessary recomputations.

```ts
import { createSignal, computed, storeSignal } from 'indulgent/signal';

const count = createSignal(0);

const input = storeSignal('my_key', '', { storage: sessionStorage });

const doubleCount = computed(() => count.get() * 2);
```

## Installation

```bash
npm install indulgent
# or
yarn add indulgent
# or
pnpm add indulgent
```

## Usage

See [examples](/examples) and [docs](https://frodi-karlsson.github.io/indulgent/)
