import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

await build({
  absWorkingDir: root,
  entryPoints: ['src/render/lab/main.js'],
  outfile: 'dist/render-lab.js',
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['chrome120', 'edge120'],
  sourcemap: false,
  minify: false,
  legalComments: 'none',
})

console.log('built dist/render-lab.js')
