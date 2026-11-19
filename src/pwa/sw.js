/* eslint-env serviceworker */
// AppChat Service Worker：预缓存应用外壳支持离线打开；绝不处理跨源请求（含 API）与非 GET 请求。
// 构建指纹注入到 BUILD_ID 常量：产物一变 sw.js 字节即变，浏览器据此触发更新安装。

const BUILD_ID = '__BUILD_ID__'
const CACHE_PREFIX = 'appchat-assets-'
const MANIFEST_URL = '/asset-manifest.json'

const cacheName = () => CACHE_PREFIX + BUILD_ID

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      // 绕过 HTTP 缓存拿最新清单，避免旧 SW 缓存里拿到过期列表
      const response = await fetch(MANIFEST_URL, { cache: 'reload' })
      if (!response.ok) {
        throw new Error(`asset manifest fetch failed: ${response.status}`)
      }
      const { files } = await response.json()
      const cache = await caches.open(cacheName())
      // 逐个缓存，单个文件失败不拖垮整个安装
      await Promise.all(
        files.map(async (file) => {
          const res = await fetch(file, { cache: 'reload' })
          if (res.ok) {
            await cache.put(file, res)
          }
        })
      )
      await self.skipWaiting()
    })()
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = cacheName()
      const names = await caches.keys()
      await Promise.all(
        names
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== keep)
          .map((name) => caches.delete(name))
      )
      await self.clients.claim()
    })()
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') {
    return
  }
  if (request.url.startsWith('blob:')) {
    return
  }
  const url = new URL(request.url)
  // 跨源请求（api.deepseek.com 及用户自设代理）一律直连，不进缓存
  if (url.origin !== self.location.origin) {
    return
  }
  if (request.mode === 'navigate') {
    // 页面导航网络优先：在线永远拿最新版本，离线回落缓存的 index.html
    event.respondWith(
      (async () => {
        try {
          return await fetch(request)
        } catch {
          return (await caches.match('/index.html')) ?? Response.error()
        }
      })()
    )
    return
  }
  // 静态资源缓存优先（文件名带内容哈希，命中即终态）
  event.respondWith(
    (async () => {
      const cached = await caches.match(request)
      if (cached) {
        return cached
      }
      try {
        const response = await fetch(request)
        if (response.ok && BUILD_ID !== '__BUILD_ID__') {
          const cache = await caches.open(cacheName())
          await cache.put(request, response.clone())
        }
        return response
      } catch {
        return Response.error()
      }
    })()
  )
})
