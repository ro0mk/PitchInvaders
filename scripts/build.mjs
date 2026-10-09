// Gera dist/PitchInvaders.html: um único ficheiro HTML com todo o jogo (JS + CSS embutidos),
// que abre diretamente no browser (file://) e é também o que a app Electron carrega.
import * as esbuild from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outFile = path.join(root, 'dist', 'PitchInvaders.html');
const watch = process.argv.includes('--watch');

const options = {
  entryPoints: [path.join(root, 'src', 'main.js')],
  bundle: true,
  format: 'iife',
  minify: !watch,
  sourcemap: false,
  target: ['es2020'],
  write: false,
  legalComments: 'none',
  logLevel: 'warning',
};

async function writeHtml(js) {
  const [template, css] = await Promise.all([
    readFile(path.join(root, 'src', 'index.html'), 'utf8'),
    readFile(path.join(root, 'src', 'style.css'), 'utf8'),
  ]);
  const safeJs = js.replace(/<\/script/gi, '<\\/script');
  const html = template
    .replace('<!-- STYLE -->', () => `<style>\n${css}\n</style>`)
    .replace('<!-- SCRIPT -->', () => `<script>\n${safeJs}\n</script>`);
  await mkdir(path.dirname(outFile), { recursive: true });
  await writeFile(outFile, html);
  console.log(`✔ ${path.relative(root, outFile)} (${(html.length / 1024).toFixed(0)} KB)`);
}

if (watch) {
  const ctx = await esbuild.context({
    ...options,
    plugins: [{
      name: 'html',
      setup(build) {
        build.onEnd(async (result) => {
          if (result.errors.length) return;
          await writeHtml(result.outputFiles[0].text);
        });
      },
    }],
  });
  await ctx.watch();
  console.log('A observar alterações em src/ ...');
} else {
  const result = await esbuild.build(options);
  await writeHtml(result.outputFiles[0].text);
}
