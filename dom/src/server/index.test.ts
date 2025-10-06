import { beforeEach, describe, expect, test, vi } from 'vitest';
import fs from 'node:fs';

vi.mock('node:fs', async (importActual) => {
  const realFs = await importActual<typeof fs>();
  return {
    ...realFs,
    readFileSync: (...params: Parameters<typeof fs.readFileSync>) => {
      const [file, options] = params;
      console.log('Mocked readFileSync for', file.toString());
      if (file.toString().endsWith('index-cdn.js')) {
        return '/* mock bundle */';
      }
      return realFs.readFileSync(file, options);
    },
  };
});

describe('ssg', () => {
  beforeEach(() => {
    const originalReadFileSync = fs.readFileSync;
    vi.spyOn(fs, 'readFileSync').mockImplementation((...params) => {
      const [file, options] = params;
      if (file.toString().endsWith('index-cdn.js')) {
        return '/* mock bundle */';
      }
      return originalReadFileSync(file, options);
    });
  });
  test('should match snapshots', async () => {
    const { ssg } = await import('./index.js');
    const htmlDirectory = `${import.meta.dirname}/testfiles`;
    const results = await ssg(htmlDirectory);
    for (const [filename, content] of Object.entries(results)) {
      expect(content).toMatchSnapshot(filename);
    }
  });
});
