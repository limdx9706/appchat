/**
 * 品牌单点配置：应用名、描述与 PWA 外观全部集中在本文件，
 * 构建期（rspack.config.ts、gen-icons）与运行时（页面标题、系统提示词）共用。
 * 改完本文件后重新执行 `pnpm build` 并跑一次 `node scripts/gen-icons.mjs` 即全局生效。
 */
export const brand = {
  /** 应用全名：页面 <title>、PWA name、TWA APK label、对模型的系统提示词 */
  appName: 'AppChat',
  /** 短名：主屏图标下方显示，建议不超过 12 个字符 */
  shortName: 'AppChat',
  /** 应用描述：meta description 与 manifest description */
  description: '自带 DeepSeek API Key 的聊天应用，Key 只保存在你的浏览器里',
  /** PWA theme_color 初始值；运行时按当前主题背景色动态更新 */
  themeColor: '#ffffff',
  /** PWA 启动画面背景色 */
  backgroundColor: '#ffffff',
} as const

export type Brand = typeof brand
