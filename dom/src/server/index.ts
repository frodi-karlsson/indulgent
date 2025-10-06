import {
  Browser,
  type BrowserPage,
  type IOptionalBrowserSettings,
} from 'happy-dom';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

function getBundlePath() {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  // We're likely in node_modules/indulgent/dom/src/server and we need to go up to dist/index-cdn.js
  const distDir = path.resolve(currentDir, '..');
  const bundlePath = path.join(distDir, 'index-cdn.js');
  return bundlePath;
}

let cachedBundle: string | null = null;
function getBundle(): string {
  if (cachedBundle) {
    return cachedBundle;
  }
  const bundlePath = getBundlePath();
  try {
    cachedBundle = fs.readFileSync(bundlePath, 'utf8');
    return cachedBundle;
  } catch (error) {
    throw new Error(
      `Could not read bundle at ${bundlePath}. Did you run 'npm run build' in the indulgent-dom package?`,
      {
        cause: error,
      },
    );
  }
}

function browserResource(options?: {
  settings?: IOptionalBrowserSettings;
  console?: Console;
}): Browser & AsyncDisposable {
  const browser = new Browser(options);
  return Object.assign(browser, {
    async [Symbol.asyncDispose]() {
      await browser.close();
    },
  });
}

function newPageResource(browser: Browser): BrowserPage & AsyncDisposable {
  const page = browser.newPage();
  return Object.assign(page, {
    async [Symbol.asyncDispose]() {
      await page.close();
    },
  });
}

/**
 * Happy DOM may strip stuff like <!DOCTYPE ...> from the start of the document.
 * This function attempts to preserve those losses by copying from the original
 */
function compatLossiness(original: string, updated: string): string {
  const doctypeMatch = original.match(/<!(DOCTYPE|doctype) [^>]+>/i);
  if (doctypeMatch) {
    return `${doctypeMatch[0]}\n${updated}`;
  }
  return updated;
}

/**
 * Collects full paths of all files in the given directory recursively.
 */
function collectAllFiles(
  currentPath: string,
  results: string[] = [],
): string[] {
  const dirents = fs.readdirSync(currentPath, { withFileTypes: true });
  for (const dirent of dirents) {
    const fullPath = path.join(currentPath, dirent.name);
    if (dirent.isDirectory()) {
      collectAllFiles(fullPath, results);
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Server-side generation support for Indulgent DOM.
 * This function takes an HTML document string and a context object containing signals,
 * initializes Indulgent DOM bindings, and returns the updated HTML string.
 *
 * In practice, this runs the HTML in a headless browser environment using `happy-dom`,
 * applies the Indulgent DOM bindings, and then extracts the final HTML and returns it.
 *
 * There is currently no state shared from the server to the client, so any signals used
 * will be reset when the client-side script runs, although the html will be updated.
 * This will hopefully be improved in the future.
 */
export async function ssg(directory: string): Promise<Record<string, string>> {
  const files = collectAllFiles(path.resolve(directory));
  const bundleContents = getBundle();
  const results: Record<string, string> = {};

  await using browser = browserResource({
    settings: {
      fetch: {
        virtualServers: [
          {
            directory: directory,
            url: 'http://localhost:8080',
          },
        ],
      },
      timer: {
        maxTimeout: 100,
        maxIntervalIterations: 1,
        maxIntervalTime: 100,
      },
    },
  });

  for await (const src of files) {
    const name = path.relative(directory, src);
    let contents: string;
    try {
      contents = fs.readFileSync(src, 'utf8');
    } catch (error) {
      throw new Error(`Could not read file at ${src}`, { cause: error });
    }
    console.log(`Processing ${src}...`, contents.length);
    await using page = newPageResource(browser);
    await page.goto(`http://localhost:8080/${name}`);
    const { document } = page.mainFrame;
    const scriptEl = document.createElement('script');
    scriptEl.type = 'text/javascript';
    scriptEl.id = 'indulgent-ssg-loader';
    scriptEl.async = true;
    scriptEl.textContent = bundleContents;
    document.head.appendChild(scriptEl);

    const indulgentScripts = document.querySelectorAll('script[indulgent]');
    if (indulgentScripts) {
      for await (const script of indulgentScripts) {
        await page.evaluate(script.textContent || '');
      }
    }

    await page.waitUntilComplete();

    // remove any set data-indulgent-id attributes
    const allBound = document.querySelectorAll('[data-indulgent-id]');
    allBound.forEach((el) => el.removeAttribute('data-indulgent-id'));

    results[name] = compatLossiness(contents, page.content);
  }

  return results;
}
