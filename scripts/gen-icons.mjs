// 从 src/brand/icon.svg 生成 public/icons/ 下的全部 PWA 图标（产物提交入库，CI 构建无需 sharp）
// 用法：node scripts/gen-icons.mjs
import { copyFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const svg = await sharp(path.join(root, 'src/brand/icon.svg')).png().toBuffer()
const outDir = path.join(root, 'public/icons')
await mkdir(outDir, { recursive: true })

// SVG 无固有尺寸，按目标像素提高渲染密度保证清晰
const render = (size, file) =>
  sharp(svg, { density: (72 * size) / 512 })
    .resize(size, size)
    .png()
    .toFile(path.join(outDir, file))

await Promise.all([
  render(192, 'icon-192.png'),
  render(512, 'icon-512.png'),
  render(512, 'icon-maskable-512.png'),
  render(180, 'apple-touch-icon.png'),
])
await copyFile(path.join(root, 'src/brand/icon.svg'), path.join(outDir, 'favicon.svg'))
console.log('icons generated in public/icons/')
