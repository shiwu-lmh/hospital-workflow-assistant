import { readFile, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const manifest = JSON.parse(await readFile('extension/manifest.json', 'utf8'));
if (manifest.manifest_version !== 3) throw new Error('Manifest must be v3');
for (const entry of await readdir('extension')) {
  if (!entry.endsWith('.js')) continue;
  const result = spawnSync(process.execPath, ['--check', `extension/${entry}`], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr);
}
for (const path of [manifest.background.service_worker, manifest.options_page, ...manifest.content_scripts.flatMap(x => x.js)]) await readFile(`extension/${path}`);
console.log('Manifest、入口文件、JavaScript语法检查通过');
