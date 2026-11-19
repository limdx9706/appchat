# AppChat

[English](README.md) | 简体中文

自带 API Key（BYOK）的 DeepSeek 聊天应用。基于 [deepseek-ai/chat-demo](https://github.com/deepseek-ai/chat-demo)（commit `5d5dd75`，MIT）定制，纯静态部署，**API Key 只保存在你的浏览器 localStorage，永远不经过服务器**。

## 架构

```mermaid
flowchart LR
    C[Cloudflare Pages<br/>纯静态托管] --|HTML/JS/CSS| A
    subgraph 用户浏览器
        A[AppChat 前端<br/>PWA] --|Key 只存 localStorage| A
    end
    A --|浏览器直连 · Key 在请求头| B[api.deepseek.com]
    B --|SSE 流式响应| A
```

- 前端全部静态产物，托管在 Cloudflare Pages（海外节点，域名无需备案）
- 聊天请求由浏览器直连 `api.deepseek.com`（已实测 CORS 放行全部 5 个端点，见 `scripts/cors-check.sh`）
- 运营方（页面托管者）无法接触任何用户的 API Key 与对话内容

## 功能

- 文字流式输出、深度思考、联网搜索、文件上传、语音输入与朗读
- 历史对话导入 / 导出（兼容 DeepSeek 官方 App 导出的 ZIP）
- 中文 / 英文界面、浅色 / 深色主题
- PWA：可安装到主屏，Service Worker 预缓存应用外壳支持离线打开（绝不缓存 API 响应）
- 设置页可覆盖 API 地址（为自建代理留门；对应 CSP 需同步调整，见 `public/_headers`）

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

## 部署（Cloudflare Pages）

```sh
pnpm build
npx wrangler pages project create appchat
npx wrangler pages deploy dist --project-name appchat
```

自定义域名：Pages 控制台 → appchat 项目 → Custom domains → 添加 `chat.ldx9706.cloud`，
再到 DNSPod 控制台为该子域添加 CNAME 记录指向 Pages 分配的 `<project>.pages.dev`。
（域名托管在腾讯云 DNSPod；海外托管无需备案。）

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
