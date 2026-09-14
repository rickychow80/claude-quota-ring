// Normalizes whatever usage-shaped payload the content script forwards,
// draws a two-ring badge icon (outer = session, inner = weekly), and
// keeps the last few raw candidates around so the popup's Debug tab
// can show us the real field names to lock the parser onto.

importScripts("i18n.js");

const MAX_DEBUG_CANDIDATES = 8;
const MAX_URL_LOG = 20;

let cachedSettings = { language: CQR_DEFAULT_LANG, refreshIntervalMinutes: 5, verboseDebug: false };
cqrGetSettings((s) => {
  cachedSettings = s;
  setupAlarm(s.refreshIntervalMinutes);
});

console.log("[ClaudeQuotaRing][bg] service worker started");

// Exact shape of https://claude.ai/api/organizations/{orgId}/usage:
//   { five_hour: { utilization, resets_at, ... }, seven_day: { utilization, resets_at, ... }, ... }
// utilization is already 0-100 (not a fraction), resets_at is an ISO string.
function normalize(payload) {
  const fh = payload?.five_hour;
  const sd = payload?.seven_day;
  if (!fh && !sd) return null;
  return {
    sessionPct: typeof fh?.utilization === "number" ? Math.round(fh.utilization) : null,
    sessionReset: fh?.resets_at ?? null,
    weeklyPct: typeof sd?.utilization === "number" ? Math.round(sd.utilization) : null,
    weeklyReset: sd?.resets_at ?? null,
    updatedAt: Date.now()
  };
}

function colorForRing(pct, isOuter) {
  if (pct !== null && pct >= 90) return "#e53935"; // near-limit warning always overrides
  return isOuter ? "#fb8c00" : "#43a047"; // outer (session) = orange, inner (weekly) = green
}

async function drawBadge(state) {
  const size = 32;
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, size, size);

  const rings = [
    { pct: state.sessionPct, radius: 13, width: 4, isOuter: true },
    { pct: state.weeklyPct, radius: 8, width: 4, isOuter: false }
  ];

  for (const ring of rings) {
    const cx = size / 2, cy = size / 2;
    ctx.lineWidth = ring.width;
    ctx.strokeStyle = "#e0e0e0";
    ctx.beginPath();
    ctx.arc(cx, cy, ring.radius, 0, Math.PI * 2);
    ctx.stroke();

    if (ring.pct !== null) {
      ctx.strokeStyle = colorForRing(ring.pct, ring.isOuter);
      ctx.lineCap = "round";
      ctx.beginPath();
      const start = -Math.PI / 2;
      const end = start + (Math.PI * 2 * (ring.pct / 100));
      ctx.arc(cx, cy, ring.radius, start, end);
      ctx.stroke();
    }
  }

  const imageData = ctx.getImageData(0, 0, size, size);
  chrome.action.setIcon({ imageData });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "CQR_USAGE_CANDIDATE") {
    console.log("[ClaudeQuotaRing][bg] usage candidate received", msg.url);
    chrome.storage.local.get(["debugCandidates"], (res) => {
      const list = res.debugCandidates || [];
      // Safety cap even though looksLikeUsagePayload() is precise now —
      // never let one giant payload bloat storage or freeze the popup.
      const json = JSON.stringify(msg.payload);
      const safePayload = json.length > 20000 ? { _truncated: true, preview: json.slice(0, 2000) } : msg.payload;
      list.unshift({ url: msg.url, payload: safePayload, ts: msg.ts });
      chrome.storage.local.set({ debugCandidates: list.slice(0, MAX_DEBUG_CANDIDATES) });
    });

    const normalized = normalize(msg.payload);
    if (!normalized) return;

    chrome.storage.local.set({ usage: normalized });
    drawBadge(normalized);
    return;
  }

  if (msg.type === "CQR_URL_SEEN") {
    if (!cachedSettings.verboseDebug) return;
    console.log("[ClaudeQuotaRing][bg] url seen", msg.url);
    chrome.storage.local.get(["urlLog"], (res) => {
      const list = res.urlLog || [];
      // de-dupe by path so repeated polling doesn't fill the log with one URL
      const path = msg.url.split("?")[0];
      const filtered = list.filter(l => l.url.split("?")[0] !== path);
      filtered.unshift({ url: msg.url, contentType: msg.contentType, snippet: msg.snippet, ts: msg.ts });
      chrome.storage.local.set({ urlLog: filtered.slice(0, MAX_URL_LOG) });
    });
    return;
  }

  if (msg.type === "CQR_ACTIVITY") {
    console.log("[ClaudeQuotaRing][bg] activity detected, scheduling background refresh");
    scheduleBackgroundRefresh(6000); // give the completion a moment to land before checking usage
    return;
  }

  if (msg.type === "CQR_MANUAL_REFRESH") {
    console.log("[ClaudeQuotaRing][bg] manual refresh requested");
    if (refreshTimer) clearTimeout(refreshTimer);
    runBackgroundRefresh();
    sendResponse({ ok: true });
    return;
  }

  if (msg.type === "CQR_SETTINGS_UPDATED") {
    cachedSettings = msg.settings;
    setupAlarm(msg.settings.refreshIntervalMinutes);
  }
});

// ---- Background refresh: silently open claude.ai/settings/usage in a
// minimized, unfocused window, let the page make its own real usage
// request (which our content/fetch-hook scripts pick up as usual), then
// close the window. We never read its DOM ourselves — this only lets the
// page do what it would do anyway if you visited it yourself, without it
// ever appearing on screen or stealing focus. ----

let refreshTimer = null;
let refreshInFlight = false;

function scheduleBackgroundRefresh(delayMs) {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(runBackgroundRefresh, delayMs);
}

function runBackgroundRefresh() {
  if (refreshInFlight) return;
  refreshInFlight = true;
  chrome.windows.create(
    {
      url: "https://claude.ai/settings/usage",
      focused: false,
      state: "minimized",
      type: "popup"
    },
    (win) => {
      if (chrome.runtime.lastError || !win?.id) {
        refreshInFlight = false;
        return;
      }
      const winId = win.id;
      // Give the page enough time to load and fire its own usage request,
      // which our fetch-hook/content script will have already relayed by
      // the time we close this window.
      setTimeout(() => {
        chrome.windows.remove(winId, () => { refreshInFlight = false; });
      }, 8000);
    }
  );
}

// Periodic refresh in case the user is only reading, not sending messages.
// Interval is configurable from the settings page (default 5 min).
function setupAlarm(minutes) {
  chrome.alarms.create("cqrPeriodicRefresh", { periodInMinutes: Math.max(1, minutes || 5) });
}
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "cqrPeriodicRefresh") runBackgroundRefresh();
});
