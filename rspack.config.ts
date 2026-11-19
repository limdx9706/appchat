import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from '@rspack/cli'
import { Compilation, rspack, type Compiler, type Configuration } from '@rspack/core'
import { brand } from './src/brand.js'

const dev = process.env.NODE_ENV !== 'production'
const targets = ['chrome >= 105', 'edge >= 105', 'safari >= 16', 'firefox >= 110']
const root = path.dirname(fileURLToPath(import.meta.url))
const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8')
) as { version: string }

const cssLoader = {
  loader: 'builtin:lightningcss-loader',
  options: { targets },
}

type ConfigOptions = {
  /** 公开 API 的地址，注入为 __API_ORIGIN__ */
  apiOrigin?: string
  /** 开发服务器配置，支持本地接口代理 */
  devServer?: Configuration['devServer']
}

/** PWA manifest：品牌字段单点来自 src/brand.ts，图标由 scripts/gen-icons.mjs 生成 */
const manifestContent = () =>
  JSON.stringify(
    {
      name: brand.appName,
      short_name: brand.shortName,
      description: brand.description,
      start_url: '/',
      scope: '/',
      display: 'standalone',
      background_color: brand.backgroundColor,
      theme_color: brand.themeColor,
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        {
          src: '/icons/icon-maskable-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    },
    null,
    2
  ) + '\n'

/** 预缓存清单里排除的产物：SW 自身、清单自身、托管配置；字体只留 woff2（现代浏览器全支持） */
const PRECACHE_EXCLUDE = /^(asset-manifest\.json|sw\.js|LICENSE|_headers|\.well-known\/)|\.(woff|ttf)$/

/**
 * PWA 产物插件：
 * 1. 生成 manifest.webmanifest（品牌单点配置）；
 * 2. 生成 asset-manifest.json（Service Worker 预缓存清单）；
 * 3. 从 src/pwa/sw.js 原样产出 sw.js（不经过压缩），并注入预缓存集合指纹 ——
 *    产物一变 sw.js 字节即变，浏览器据此触发 SW 更新。
 */
const PwaAssetsPlugin = {
  name: 'PwaAssetsPlugin',
  apply(compiler: Compiler) {
    compiler.hooks.compilation.tap(PwaAssetsPlugin.name, (compilation: Compilation) => {
      compilation.hooks.processAssets.tapPromise(
        { name: PwaAssetsPlugin.name, stage: Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE },
        async () => {
          compilation.emitAsset(
            'manifest.webmanifest',
            new rspack.sources.RawSource(manifestContent())
          )
          const files = Object.keys(compilation.assets)
            .filter((name) => !PRECACHE_EXCLUDE.test(name) && !name.endsWith('.map'))
            .sort()
          const buildId = createHash('sha256').update(JSON.stringify(files)).digest('hex').slice(0, 12)
          compilation.emitAsset(
            'asset-manifest.json',
            new rspack.sources.RawSource(
              JSON.stringify({ version: `${version}.${buildId}`, files }, null, 2) + '\n'
            )
          )
          // RawSource 原样输出，避免 sw.js 被生产压缩改写、剥离兜底缓存逻辑
          const swSource = readFileSync(path.join(root, 'src/pwa/sw.js'), 'utf8')
          compilation.emitAsset(
            'sw.js',
            new rspack.sources.RawSource(swSource.replaceAll('__BUILD_ID__', buildId))
          )
        }
      )
    })
  },
}

/** 创建构建配置，支持自定义 API 地址和开发服务器选项 */
export const createConfig = ({
  apiOrigin = 'https://api.deepseek.com',
  devServer,
}: ConfigOptions = {}): Configuration => ({
  mode: dev ? 'development' : 'production',
  entry: './src/main.tsx',
  output: {
    path: path.resolve(root, 'dist'),
    // 运行时按当前脚本地址推导资源路径，file:// 下异步 chunk、字体都按相对位置加载
    publicPath: 'auto',
    filename: 'static/js/[name].[contenthash:8].js',
    chunkFilename: 'static/js/async/[name].[contenthash:8].js',
    cssFilename: 'static/css/[name].[contenthash:8].css',
    cssChunkFilename: 'static/css/async/[name].[contenthash:8].css',
    assetModuleFilename: 'static/media/[name].[contenthash:8][ext]',
    clean: true,
  },
  devtool: dev ? 'cheap-module-source-map' : false,
  // 开发模式预编译异步模块，保持首次加载代码高亮和公式时的页面状态
  lazyCompilation: false,
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    // 将 .js 导入路径解析到同名 .ts、.tsx 或 .js 文件
    extensionAlias: { '.js': ['.ts', '.tsx', '.js'] },
  },
  module: {
    // CSS Modules 使用默认导出：`import styles from './x.module.css'`
    parser: { 'css/module': { namedExports: false } },
    generator: { 'css/module': { localIdentName: '[local]-[hash:6]' } },
    rules: [
      { test: /\.module\.css$/, type: 'css/module', use: [cssLoader] },
      { test: /\.css$/, exclude: /\.module\.css$/, type: 'css', use: [cssLoader] },
      {
        test: /\.(j|t)sx?$/,
        exclude: /[\\/]node_modules[\\/]/,
        loader: 'builtin:swc-loader',
        options: {
          jsc: {
            parser: { syntax: 'typescript', tsx: true },
            transform: { react: { runtime: 'automatic', development: dev } },
            externalHelpers: true,
          },
          env: { targets },
        },
        type: 'javascript/auto',
      },
      { test: /\.(woff2?|ttf)$/, type: 'asset/resource' },
    ],
  },
  plugins: [
    // 经典 defer 脚本支持 file:// 页面的资源加载
    new rspack.HtmlRspackPlugin({
      template: './src/index.html',
      scriptLoading: 'defer',
      // 品牌单点配置：title 与 description 均来自 src/brand.ts
      title: brand.appName,
      meta: {
        'application-version': version,
        description: brand.description,
        'theme-color': brand.themeColor,
      },
    }),
    new rspack.DefinePlugin({ __API_ORIGIN__: JSON.stringify(apiOrigin) }),
    new rspack.CopyRspackPlugin({
      patterns: [
        { from: path.resolve(root, 'LICENSE'), to: 'LICENSE', toType: 'file' },
        // public/：Service Worker、Cloudflare Pages 的 _headers、图标与 .well-known
        {
          from: path.resolve(root, 'public'),
          globOptions: { ignore: ['**/.DS_Store'] },
        },
      ],
    }),
    PwaAssetsPlugin,
  ],
  performance: { hints: false },
  devServer: { port: 8090, ...devServer },
})

// eslint-disable-next-line import/no-default-export
export default defineConfig(createConfig())
