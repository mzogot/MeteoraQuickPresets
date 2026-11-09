import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import * as esbuild from 'esbuild';

// package.json is the only place the version is set.
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const changelog = await readFile('CHANGELOG.md', 'utf8');
if (!changelog.includes(`## [${version}]`)) {
  throw new Error(`CHANGELOG.md has no "## [${version}]" entry. Add one before building.`);
}

await mkdir('dist/icons', { recursive: true });
const manifest = JSON.parse(await readFile('manifest.json', 'utf8'));
await writeFile('dist/manifest.json', `${JSON.stringify({ ...manifest, version }, null, 2)}\n`);
for (const size of [16, 32, 48, 128]) {
  await copyFile(`assets/logo/icon${size}.png`, `dist/icons/icon${size}.png`);
}

const options = {
  entryPoints: ['src/content.ts'],
  bundle: true,
  format: 'iife',
  target: 'chrome120',
  outfile: 'dist/content.js',
  logLevel: 'info',
};

if (process.argv.includes('--watch')) {
  const context = await esbuild.context(options);
  await context.watch();
} else {
  await esbuild.build(options);
}
