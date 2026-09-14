# Claude Quota Ring

<p align="center"><img src="assets/logo.png" width="120" alt="Claude Quota Ring logo" /></p>

[English](README.md) | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md)

**不用 API key,不用登入 token,完全不需要任何授權。**

一個小小的 Chrome 擴充功能,在工具列用雙環圖示顯示你在 [claude.ai](https://claude.ai) 的 session(5小時)與 weekly(7天)用量 —— 從頭到尾不會要求你的憑證、不會儲存任何 token,也不會主動呼叫 Anthropic 的任何 API。

![platform](https://img.shields.io/badge/platform-Chrome%20Extension-blue) ![manifest](https://img.shields.io/badge/manifest-v3-informational) ![permissions](https://img.shields.io/badge/permissions-storage%20%2B%20alarms-lightgrey)

---

## 真正的取數方式

大部分「用量追蹤」擴充功能會要你貼上 API key 或 OAuth token,或是讀你的 session cookie,讓*它們自己*代你去打 API。這個擴充功能兩者都不做。

它做的事是:**偷看 claude.ai 頁面自己已經發出去的請求**:

1. 一支跑在 `MAIN` world 的 content script(`fetch-hook.js`)會覆寫 `window.fetch` 跟 `XMLHttpRequest`——但是覆寫的是 **claude.ai 頁面自己的 JS context**,不是擴充功能自己的 context。跟網頁分析工具常用的手法一樣,只是這次是朝內看,不是朝外送。
2. 當你正常使用頁面(開啟、發訊息、側邊欄渲染)時,claude.ai 前端會自己去打它內部的用量端點:

   ```
   GET https://claude.ai/api/organizations/{orgId}/usage
   ```

   用的是你原本就登入的 session。這支 hook 只是讀**頁面自己已經合法拿到的回應**——它從來不會自己發請求,也不會碰 `document.cookie` 或任何認證標頭。
3. 從回應裡取出需要的欄位:

   ```json
   {
     "five_hour": { "utilization": 26, "resets_at": "2026-09-15T02:10:00Z" },
     "seven_day": { "utilization": 14, "resets_at": "2026-09-20T00:00:00Z" }
   }
   ```

4. 這些資料透過 `postMessage` → isolated world 的 content script → `chrome.runtime.sendMessage`,一路轉送到 background service worker,由它畫出雙環圖示、存起來給 popup 用。

如果你完全不開 claude.ai,擴充功能就沒東西可以顯示——因為它本來就不會自己主動去抓資料。為了讓你就算只是在看聊天記錄(沒發訊息)也能保持數字新鮮,它會定期把 `claude.ai/settings/usage` 開在一個**最小化、不搶焦點的視窗**裡幾秒鐘,讓頁面自己觸發它原本就會發的請求,然後關掉視窗。信任邊界完全一樣,只是自動化而已。

## 為什麼這很重要

| | 一般用量追蹤擴充功能 | Claude Quota Ring |
|---|---|---|
| 要求貼上 token/API key | 常見 | 從不 |
| 讀取 `document.cookie` | 常見 | 從不 |
| 直接呼叫 Anthropic API | 是 | 從不 |
| 要求的權限 | `cookies`、範圍很廣的 `host_permissions`,有時甚至 `<all_urls>` | `storage`、`alarms`、`host_permissions` 只限 `claude.ai` |
| 能看到什麼 | 它想要求什麼就能看到什麼 | 只有 claude.ai 頁面自己已經拿到的東西 |

因為資料流程裡完全沒有「擷取憑證」這一步,所以沒有東西可以外洩、不會跟你實際的 session 狀態脫節,也沒有東西需要撤銷。

## 功能

- 🍩 雙環工具列圖示 —— 外環 = session(5小時)、內環 = weekly(7天),依用量變色(接近上限會變紅)
- 🔄 popup 裡的手動刷新按鈕,旋轉動畫會在真的抓到新資料時立刻停止
- ⏱️ 背景自動刷新(可調間隔,預設 5 分鐘),發完訊息後也會觸發一次
- 🌐 多語系介面 —— English、繁體中文、简体中文、日本語
- ⚙️ 設定頁可調整語言、刷新間隔、Debug 詳細程度
- 🐞 內建 Debug 分頁,清楚列出攔截到的所有內容,方便任何人自行驗證「沒有偷打 API」這件事

## 安裝

1. 下載或 clone 這個 repo
2. 開 `chrome://extensions` → 打開「開發人員模式」
3. 「載入未封裝項目」→ 選這個資料夾
4. 打開 claude.ai 正常使用(或直接點擴充功能的刷新按鈕)

## 權限說明

| 權限 | 用途 |
|---|---|
| `storage` | 在本機儲存最近抓到的用量數字與你的設定 |
| `alarms` | 排程背景定期刷新 |
| `host_permissions: https://claude.ai/*` | content script 需要這個才能讀取頁面自己的回應 |

沒有 `cookies` 權限、沒有 `<all_urls>`、沒有遠端載入程式碼 —— 所有程式碼都在這個 repo 裡。

## 已知限制

- Anthropic 沒有公開這支端點的規格,欄位解析是照撰寫當下觀察到的格式寫死的。如果 Anthropic 之後改了格式,雙環可能會停止更新,需要重新對欄位(Debug 分頁讓這件事變得很容易診斷)。
- 如果你在跑這個擴充功能的瀏覽器 profile 裡沒有登入 claude.ai,就沒有東西可以攔截。

## 授權

MIT
