import { Browser } from 'happy-dom';
import fs from 'node:fs';
import path from 'node:path';

function getBundleScript() {
  const currentDir = path.dirname(new URL(import.meta.url).pathname);
  // We're likely in node_modules/indulgent/dom/src/server and we need to go up to dist/index-cdn.js
  const distDir = path.resolve(currentDir, '..');
  const bundlePath = path.join(distDir, 'index-cdn.js');
  return bundlePath;
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
  const files = fs.readdirSync(directory, {
    recursive: true,
    withFileTypes: true,
  });

  const bundlePath = getBundleScript();
  const bundleContents = fs.readFileSync(bundlePath, 'utf8');

  const results: Record<string, string> = {};

  const browser = new Browser({
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

  for await (const file of files) {
    if (file.isFile()) {
      const src = path.join(directory, file.name);
      const contents = fs.readFileSync(src, 'utf8');
      console.log(`Processing ${file.name}...`, contents.length);
      const page = browser.newPage();
      await page.goto(`http://localhost:8080/${file.name}`);
      const { document } = page.mainFrame;
      const scriptEl = document.createElement('script');
      scriptEl.type = 'text/javascript';
      scriptEl.id = 'indulgent-ssg-loader';
      scriptEl.async = true;
      scriptEl.textContent = bundleContents;
      document.head.appendChild(scriptEl);

      const indulgentScript = document.querySelector('script[indulgent]');
      if (indulgentScript) {
        await page.evaluate(indulgentScript.textContent || '');
      }

      await page.waitUntilComplete();

      // remove any set data-indulgent-id attributes
      const allBound = document.querySelectorAll('[data-indulgent-id]');
      allBound.forEach((el) => el.removeAttribute('data-indulgent-id'));

      results[file.name] = page.content;
      browser.close();
    }
  }

  return results;
}
