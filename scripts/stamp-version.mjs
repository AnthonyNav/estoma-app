import { readFileSync, writeFileSync } from 'node:fs';

const commit = process.argv[2];
if (!/^[0-9a-f]{40}$/.test(commit ?? '')) throw new Error('A full Git commit is required');
writeFileSync(
  new URL('../src/build-version.ts', import.meta.url),
  `export const BUILD_COMMIT = '${commit}';\n`,
);
const manifestPath = new URL('../ngsw-config.json', import.meta.url);
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
manifest.appData = { ...manifest.appData, commit };
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
