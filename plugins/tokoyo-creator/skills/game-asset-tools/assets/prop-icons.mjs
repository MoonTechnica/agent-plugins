import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

// Deterministic vector props; use for functional icons when the art direction fits.
const params = JSON.parse(process.env.ASSET_PARAMS ?? '{}')
const size = params.size ?? 128
if (!Number.isInteger(size) || size < 32 || size > 512) throw new Error('size must be 32..512')
if (!Array.isArray(params.items) || !params.items.length || params.items.length > 40)
  throw new Error('items must contain 1..40 props')
const paths = {
  coin: '<circle cx="64" cy="64" r="44"/><circle cx="64" cy="64" r="30" fill="none" stroke="white" stroke-width="4"/><path d="M64 44v40m-10-30h17m-17 20h17" fill="none" stroke="white" stroke-width="5"/>',
  gem: '<path d="M32 24h64l20 28-52 58L12 52z"/><path d="M12 52h104M32 24l32 86 32-86" fill="none" stroke="white" stroke-width="3"/>',
  potion:
    '<path d="M48 14h32v30c32 15 38 66-16 66S16 59 48 44z"/><path d="M48 14h32v20H48z" fill="white"/><path d="M39 73h50" fill="none" stroke="white" stroke-width="4"/>',
}
const names = new Set()
for (const item of params.items) {
  if (!item || !/^[a-z0-9][a-z0-9-]{0,39}$/.test(item.name) || names.has(item.name))
    throw new Error('prop names must be unique lowercase IDs')
  if (!Object.hasOwn(paths, item.shape) || !/^#[0-9a-fA-F]{6}$/.test(item.color))
    throw new Error('shape must be coin/gem/potion and color must be #RRGGBB')
  names.add(item.name)
}
if (!process.env.OUT) throw new Error('OUT is required')
await Promise.all(
  params.items.map((item) =>
    writeFile(
      join(process.env.OUT, `${item.name}.svg`),
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 128 128"><g fill="${item.color}">${paths[item.shape]}</g></svg>\n`
    )
  )
)
