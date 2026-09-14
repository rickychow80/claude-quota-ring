// Shared translation dictionary for popup.html and options.html.
// Language choice is stored in chrome.storage.local under `settings.language`.

const CQR_LANGS = [
  { code: "en", label: "English" },
  { code: "zh-TW", label: "繁體中文" },
  { code: "zh-CN", label: "简体中文" },
  { code: "ja", label: "日本語" }
];

const CQR_DEFAULT_LANG = "en";

const CQR_I18N = {
  "zh-TW": {
    tab_main: "用量",
    tab_debug: "Debug",
    label_session: "Session",
    label_weekly: "Weekly",
    empty_state: "還沒抓到用量資料。開一下 claude.ai 並瀏覽/發送訊息,或造訪 claude.ai/settings/usage 觸發一次用量請求。",
    updated_prefix: "更新於 ",
    reset_prefix: "重置於 ",
    refresh_title: "立即更新",
    settings_title: "設定",
    debug_hint_payload: "疑似用量相關的 JSON 回應(把這裡貼給我調整解析邏輯):",
    debug_hint_urls: "所有攔截到的 /api/ 路徑(就算不是 JSON 也會列出,拿來找真正的用量端點):",
    debug_empty: "（還沒有攔截到候選資料）",
    urllog_empty: "（還沒攔截到任何請求 — 確認擴充功能已啟用,且分頁是 claude.ai）",
    options_title: "Claude Quota Ring 設定",
    options_language_label: "語言",
    options_interval_label: "背景自動刷新間隔(分鐘)",
    options_debug_label: "顯示 Debug 分頁",
    options_save: "儲存",
    options_saved: "已儲存 ✓",
    options_back: "← 回上一頁"
  },
  "zh-CN": {
    tab_main: "用量",
    tab_debug: "调试",
    label_session: "Session",
    label_weekly: "Weekly",
    empty_state: "还没抓到用量数据。打开 claude.ai 并浏览/发送消息,或访问 claude.ai/settings/usage 触发一次用量请求。",
    updated_prefix: "更新于 ",
    reset_prefix: "重置于 ",
    refresh_title: "立即刷新",
    settings_title: "设置",
    debug_hint_payload: "疑似用量相关的 JSON 响应(把这里贴给我调整解析逻辑):",
    debug_hint_urls: "所有拦截到的 /api/ 路径(就算不是 JSON 也会列出,用来找真正的用量端点):",
    debug_empty: "（还没有拦截到候选数据）",
    urllog_empty: "（还没拦截到任何请求 — 确认扩展已启用,且标签页是 claude.ai）",
    options_title: "Claude Quota Ring 设置",
    options_language_label: "语言",
    options_interval_label: "后台自动刷新间隔(分钟)",
    options_debug_label: "显示 Debug 页",
    options_save: "保存",
    options_saved: "已保存 ✓",
    options_back: "← 返回"
  },
  "en": {
    tab_main: "Usage",
    tab_debug: "Debug",
    label_session: "Session",
    label_weekly: "Weekly",
    empty_state: "No usage data yet. Use claude.ai for a bit (send a message, or visit claude.ai/settings/usage) to trigger a usage request.",
    updated_prefix: "Updated ",
    reset_prefix: "Resets ",
    refresh_title: "Refresh now",
    settings_title: "Settings",
    debug_hint_payload: "Candidate JSON responses that look usage-related (paste these if the parser needs adjusting):",
    debug_hint_urls: "Every intercepted request path (listed even if not JSON — useful for spotting the real usage endpoint):",
    debug_empty: "(no candidates captured yet)",
    urllog_empty: "(no requests captured yet — check the extension is enabled and the tab is claude.ai)",
    options_title: "Claude Quota Ring Settings",
    options_language_label: "Language",
    options_interval_label: "Background refresh interval (minutes)",
    options_debug_label: "Show the Debug tab",
    options_save: "Save",
    options_saved: "Saved ✓",
    options_back: "← Back"
  },
  "ja": {
    tab_main: "使用状況",
    tab_debug: "デバッグ",
    label_session: "Session",
    label_weekly: "Weekly",
    empty_state: "まだ使用量データがありません。claude.ai を少し使う(メッセージを送る、または claude.ai/settings/usage を開く)と取得できます。",
    updated_prefix: "更新: ",
    reset_prefix: "リセット: ",
    refresh_title: "今すぐ更新",
    settings_title: "設定",
    debug_hint_payload: "使用量っぽい JSON レスポンスの候補(解析ロジックの調整用に貼ってください):",
    debug_hint_urls: "捕捉したすべてのリクエストパス(JSON でなくても表示 — 本当のエンドポイントを探すため):",
    debug_empty: "（まだ候補を捕捉していません）",
    urllog_empty: "（まだリクエストを捕捉していません — 拡張機能が有効で claude.ai のタブか確認してください）",
    options_title: "Claude Quota Ring 設定",
    options_language_label: "言語",
    options_interval_label: "バックグラウンド自動更新間隔(分)",
    options_debug_label: "Debug タブを表示する",
    options_save: "保存",
    options_saved: "保存しました ✓",
    options_back: "← 戻る"
  }
};

function cqrGetSettings(cb) {
  chrome.storage.local.get(["settings"], (res) => {
    const settings = Object.assign(
      { language: CQR_DEFAULT_LANG, refreshIntervalMinutes: 5, verboseDebug: true },
      res.settings || {}
    );
    cb(settings);
  });
}

function cqrT(lang, key) {
  const dict = CQR_I18N[lang] || CQR_I18N[CQR_DEFAULT_LANG];
  return dict[key] || CQR_I18N[CQR_DEFAULT_LANG][key] || key;
}
