/** Service Worker 注册：仅 https 生产环境启用；file:// 与本地 http dev 一律跳过 */
export const registerServiceWorker = () => {
  if (!('serviceWorker' in navigator)) {
    return
  }
  if (location.protocol !== 'https:') {
    return
  }
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      // 注册失败不影响使用，静默降级为普通站点
    })
  })
}
