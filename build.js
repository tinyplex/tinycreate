import {exec} from 'child_process';
import {build} from 'esbuild';
import {mkdir, readFile, rm, writeFile} from 'fs/promises';
import {promisify} from 'util';

const execAsync = promisify(exec);

await rm('dist', {recursive: true, force: true});
await mkdir('dist', {recursive: true});

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  minify: true,
  platform: 'node',
  format: 'esm',
  outfile: 'dist/index.js',
  target: 'node18',
  external: [
    'prompts',
    'prettier',
    'typescript',
    'handlebars',
    'ts-blank-space',
  ],
});

await execAsync(
  'npx dts-bundle-generator -o dist/index.d.ts src/index.ts --no-banner',
);

const pkg = JSON.parse(await readFile('package.json', 'utf-8'));
delete pkg.devDependencies;
delete pkg.scripts;
delete pkg.private;
pkg.main = './index.js';
pkg.types = './index.d.ts';
pkg.exports = {
  '.': {
    import: './index.js',
    types: './index.d.ts',
  },
};
await writeFile('dist/package.json', JSON.stringify(pkg, null, 2));

console.log('✅ Built tinycreate');
