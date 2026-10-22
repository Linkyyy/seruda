import { mkdir, rm, cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const dist = new URL('dist/', root);
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const file of ['index.html', 'styles.css', 'mobile.css', 'src']) {
  await cp(new URL(file, root), new URL(file, dist), { recursive: true });
}
console.log(`Static build created: ${fileURLToPath(dist)}`);
