# AppChat

[English](README.md) | 简体中文

自带 API Key（BYOK）的 DeepSeek 聊天应用。基于 [deepseek-ai/chat-demo](https://github.com/deepseek-ai/chat-demo)（commit `5d5dd75`，MIT）定制，纯静态部署，**API Key 只保存在你的浏览器 localStorage，永远不经过服务器**。

## 架构

```mermaid
flowchart LR
    C[EdgeOne Pages<br/>纯静态托管·全球含大陆] --|HTML/JS/CSS| A
    subgraph 用户浏览器
        A[AppChat 前端<br/>PWA] --|Key 只存 localStorage| A
    end
    A --|浏览器直连 · Key 在请求头| B[api.deepseek.com]
    B --|SSE 流式响应| A
```

- 前端全部静态产物，托管在腾讯云 EdgeOne Pages，加速区域「全球可用（含中国大陆）」——大陆用户走国内节点（域名已备案），海外用户走腾讯海外节点
- 聊天请求由浏览器直连 `api.deepseek.com`（已实测 CORS 放行全部 5 个端点，见 `scripts/cors-check.sh`）
- 运营方（页面托管者）无法接触任何用户的 API Key 与对话内容

## 功能

- 文字流式输出、深度思考、联网搜索、文件上传、语音输入与朗读
- 历史对话导入 / 导出（兼容 DeepSeek 官方 App 导出的 ZIP）
- 中文 / 英文界面、浅色 / 深色主题
- PWA：可安装到主屏，Service Worker 预缓存应用外壳支持离线打开（绝不缓存 API 响应）
- 设置页可覆盖 API 地址（为自建代理留门；对应 CSP 需同步调整，见 `edgeone.json`）

## 面向用户的隐私声明（模板）

> 本应用不设账号系统、不收集任何数据。你的 DeepSeek API Key 只保存在你自己的浏览器
> localStorage 中，仅用于直接向 api.deepseek.com 发起请求，不会发送给本站或任何第三方。
> 对话记录保存在你浏览器的 IndexedDB 中，导出文件由你自行保管。清除浏览器数据即彻底删除。

## 开发

准备 Node.js 22.12+ 和 pnpm：

```sh
pnpm install
pnpm dev          # http://localhost:8090
pnpm type         # 类型检查
pnpm lint         # oxlint
pnpm build        # 产物输出到 dist/
pnpm icons        # 改了 src/brand/icon.svg 后重新生成 PWA 图标
pnpm cors-check   # api.deepseek.com 五端点 CORS 预检
```

### 改品牌

所有品牌信息集中在 `src/brand.ts`：应用名、短名、描述、主题色、背景色。改完后重新 `pnpm build`（如改了图标源文件再跑 `pnpm icons`），页面标题、manifest、系统提示词即全部生效。

## 部署（EdgeOne Pages，全球含大陆）

```sh
npm install -g edgeone     # EdgeOne CLI
pnpm build
edgeone login              # 浏览器弹窗授权腾讯云账号（大陆加速 + 备案走中国站）
edgeone makers deploy ./dist -n appchat
```

部署后控制台核对两件事：

1. **加速区域**：项目详情里确认为「全球可用（含中国大陆）」——CLI 自动创建的项目默认值若不含大陆，改此项后需重新触发部署生效。
2. **自定义域名**：项目设置 → 添加 `chat.ldx9706.cloud`，控制台会给出精确的 CNAME 记录值，到 DNSPod 控制台为该子域添加这条 CNAME 即可。

备案提示：域名已有 ICP 备案；若备案接入商不含腾讯云，需在腾讯云做一次「新增接入」（一般 1-3 天，期间不影响现有服务）。

安全响应头（CSP 等）已写入 **`edgeone.json`**（构建时随产物上传至 `dist/edgeone.json`），无需再在控制台规则引擎手动配置；规则引擎可作为备用方案。

将来海外用户变多时，可另建 Cloudflare Pages 项目加一个海外子域双部署（把 `edgeone.json` 的 CSP 恢复成 `_headers` 文件格式即可），本次不做。

## 安卓 APK（TWA）

```sh
npx @bubblewrap/cli init --manifest https://chat.ldx9706.cloud/manifest.webmanifest
npx @bubblewrap/cli build
```

- `bubblewrap init` 生成的签名 keystore（`android.keystore` 及其密码）**务必自行备份**——丢失后无法再对同一应用发更新，只能换包名重发。
- 构建产出的 `assetlinks.json` 放入 `public/.well-known/` 重新部署站点，TWA 才能去除地址栏。
- 证书指纹变更（重新生成 keystore）时必须重新发布 assetlinks。

## 同步上游

```sh
git fetch upstream
git merge upstream/main   # upstream = deepseek-ai/chat-demo，已保留完整血缘
```

## 许可

MIT。保留上游版权声明（见 `LICENSE`），本项目修改部分见追加的修改声明。
