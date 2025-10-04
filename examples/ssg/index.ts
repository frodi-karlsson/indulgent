import fs from 'node:fs';
import { ssg } from 'indulgent-dom/server';

async function main(): Promise<void> {
  const res = await ssg('./templates');
  console.log(res);
  for (const [name, contents] of Object.entries(res)) {
    const outPath = `./dist/${name}`;
    fs.mkdirSync('./dist', { recursive: true });
    fs.writeFileSync(outPath, contents, 'utf8');
    console.log(`Wrote ${outPath}`);
  }
}
main().catch(console.error);
