# Claude Quota Ring

<p align="center"><img src="assets/logo.png" width="120" alt="Claude Quota Ring logo" /></p>

[English](README.md) | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md)

**不需要 API key,不需要登录 token,完全不需要任何授权。**

一个小小的 Chrome 扩展,在工具栏用双环图标显示你在 [claude.ai](https://claude.ai) 的 session(5小时)与 weekly(7天)用量 —— 全程不会要求你的凭证、不会存储任何 token,也不会主动调用 Anthropic 的任何 API。

![platform](https://img.shields.io/badge/platform-Chrome%20Extension-blue) ![manifest](https://img.shields.io/badge/manifest-v3-informational) ![permissions](https://img.shields.io/badge/permissions-storage%20%2B%20alarms-lightgrey)

---

## 截图

<p align="center"><img src="assets/screen-capture-1.png" width="360" alt="Claude Quota Ring 弹出窗口,显示 session 与 weekly 用量环" /></p>

## 为什么只支持 Claude?

因为我只付费订阅 Claude Pro!(开玩笑的)

其他用量追踪工具会让后台服务读取你的 cookie、直接用你的 session 调用各家 API,一次支持一大堆 AI 服务——但这正是这个项目想避免的信任模式。要在不碰 cookie、不自己发起认证请求的前提下安全地做到这件事,就得逐一逆向工程并维护每个网站自己那个没有公开文档的用量接口,而且大部分人根本不会同时用到所有这些服务。所以这个项目就只专注在 claude.ai——把一件事做好、不用多要一分信任,而不是靠多要信任去做很多事。

## 功能

- 🍩 双环工具栏图标 —— 外环 = session(5小时)、内环 = weekly(7天),依用量变色(接近上限会变红)
- 🔄 popup 里的手动刷新按钮,旋转动画会在真正抓到新数据时立刻停止
- ⏱️ 后台自动刷新(可调间隔,默认 5 分钟),发完消息后也会触发一次
- 🌐 多语言界面 —— English、繁體中文、简体中文、日本語
- ⚙️ 设置页可调整语言、刷新间隔、Debug 详细程度
- 🐞 内置 Debug 页,清楚列出拦截到的所有内容,方便任何人自行验证「没有偷偷调用 API」这件事

## 安装

1. 下载或 clone 这个 repo
2. 打开 `chrome://extensions` → 开启「开发者模式」
3. 「加载已解压的扩展程序」→ 选这个文件夹
4. 打开 claude.ai 正常使用(或直接点扩展的刷新按钮)

## 真正的取数方式

大部分「用量追踪」扩展会让你粘贴 API key 或 OAuth token,或者读取你的 session cookie,让*它们自己*代你去调用 API。这个扩展两者都不做。

它做的事情是:**偷看 claude.ai 页面自己已经发出的请求**:

1. 一段运行在 `MAIN` world 的 content script(`fetch-hook.js`)会重写 `window.fetch` 和 `XMLHttpRequest`——但重写的是 **claude.ai 页面自己的 JS 上下文**,不是扩展自己的上下文。这跟网页分析工具常用的手法一样,只是这次是朝内看,而不是朝外发送。
2. 当你正常使用页面(打开、发消息、侧边栏渲染)时,claude.ai 前端会自己调用它内部的用量接口:

   ```
   GET https://claude.ai/api/organizations/{orgId}/usage
   ```

   用的是你本来就登录的 session。这段 hook 只是读取**页面自己已经合法拿到的响应**——它从不会自己发起请求,也不会碰 `document.cookie` 或任何认证头。
3. 从响应里取出需要的字段:

   ```json
   {
     "five_hour": { "utilization": 26, "resets_at": "2026-09-15T02:10:00Z" },
     "seven_day": { "utilization": 14, "resets_at": "2026-09-20T00:00:00Z" }
   }
   ```

4. 这些数据通过 `postMessage` → isolated world 的 content script → `chrome.runtime.sendMessage`,一路转发到后台 service worker,由它画出双环图标、存起来给 popup 用。

如果你完全不打开 claude.ai,扩展就没有东西可以显示——因为它本来就不会自己主动去抓数据。为了让你就算只是在看聊天记录(没发消息)也能保持数字新鲜,它会定期把 `claude.ai/settings/usage` 打开在一个**最小化、不抢焦点的窗口**里几秒钟,让页面自己触发它原本就会发的请求,然后关掉窗口。信任边界完全一样,只是自动化而已。

## 为什么这很重要

| | 一般用量追踪扩展 | Claude Quota Ring |
|---|---|---|
| 要求粘贴 token/API key | 常见 | 从不 |
| 读取 `document.cookie` | 常见 | 从不 |
| 直接调用 Anthropic API | 是 | 从不 |
| 要求的权限 | `cookies`、范围很广的 `host_permissions`,有时甚至 `<all_urls>` | `storage`、`alarms`、`host_permissions` 仅限 `claude.ai` |
| 能看到什么 | 它想请求什么就能看到什么 | 只有 claude.ai 页面自己已经拿到的东西 |

因为数据流程里完全没有「提取凭证」这一步,所以没有东西可以泄露、不会跟你实际的 session 状态脱节,也没有东西需要撤销。

## 权限说明

| 权限 | 用途 |
|---|---|
| `storage` | 在本地存储最近抓到的用量数字和你的设置 |
| `alarms` | 排程后台定期刷新 |
| `host_permissions: https://claude.ai/*` | content script 需要这个才能读取页面自己的响应 |

没有 `cookies` 权限、没有 `<all_urls>`、没有远程加载代码 —— 所有代码都在这个 repo 里。

## 已知限制

- Anthropic 没有公开这个接口的规格,字段解析是按撰写当下观察到的格式写死的。如果 Anthropic 之后改了格式,双环可能会停止更新,需要重新对字段(Debug 页让这件事变得很容易诊断)。
- 如果你在运行这个扩展的浏览器 profile 里没有登录 claude.ai,就没有东西可以拦截。

## 许可证

MIT
