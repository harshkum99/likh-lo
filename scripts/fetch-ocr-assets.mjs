// Puts the register scanner's OCR runtime + model files into public/ (git-ignored), so the app self-hosts them.
// Runs before `next dev` / `next build`. Plain Node, no deps. Files already present with the right size are skipped.
import { copyFile, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(await readFile(join(root, 'src/lib/register/ocr-assets.json'), 'utf8'))
const size = p => stat(p).then(s => s.size, () => -1)

for (const f of manifest.files) {
  const dest = join(root, 'public', f.path)
  if ((await size(dest)) === f.bytes) continue
  await mkdir(dirname(dest), { recursive: true })
  if (f.npm) {
    const src = join(root, 'node_modules', f.npm)
    // The JS runtime and its wasm must come from the same onnxruntime-web release; sizes catch a silent upgrade.
    if ((await size(src)) !== f.bytes) throw new Error(`${f.npm} is missing or changed size: reinstall, or update bytes + cache name in ocr-assets.json`)
    await copyFile(src, dest)
  } else {
    process.stdout.write(`Downloading ${f.path} (${(f.bytes / 1e6).toFixed(1)} MB)… `)
    const res = await fetch(f.url).catch(e => {
      throw new Error(`Could not download ${f.url} (${e.cause?.code ?? e.message}). Connect to the internet, or put the file at public${f.path} yourself.`)
    })
    if (!res.ok) throw new Error(`${f.url}: HTTP ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length !== f.bytes) throw new Error(`${f.url}: got ${buf.length} bytes, expected ${f.bytes}`)
    await writeFile(dest + '.part', buf)
    await rename(dest + '.part', dest)
    console.log('done')
  }
}
console.log('OCR assets ready in public/ort and public/models')
