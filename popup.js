const SESSION_CIRC = 2 * Math.PI * 50; // r=50
const WEEKLY_CIRC = 2 * Math.PI * 34;  // r=34

let currentLang = CQR_DEFAULT_LANG;

function colorForRing(pct, isOuter) {
  if (pct !== null && pct !== undefined && pct >= 90) return "#e53935"; // near-limit warning always overrides
  return isOuter ? "#fb8c00" : "#43a047"; // outer (session) = orange, inner (weekly) = green
}

function fmtReset(v) {
  if (!v) return "";
  const d = new Date(typeof v === "number" ? v * 1000 : v);
  if (isNaN(d.getTime())) return "";
  return cqrT(currentLang, "reset_prefix") + d.toLocaleString();
}

function applyI18n() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = cqrT(currentLang, el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    el.title = cqrT(currentLang, el.dataset.i18nTitle);
  });
}

function render(usage) {
  const empty = document.getElementById("emptyState");
  if (!usage) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  const sRing = document.getElementById("ringSession");
  const wRing = document.getElementById("ringWeekly");

  const sPct = usage.sessionPct;
  const wPct = usage.weeklyPct;

  sRing.style.stroke = colorForRing(sPct, true);
  sRing.style.strokeDashoffset = SESSION_CIRC - (SESSION_CIRC * ((sPct ?? 0) / 100));

  wRing.style.stroke = colorForRing(wPct, false);
  wRing.style.strokeDashoffset = WEEKLY_CIRC - (WEEKLY_CIRC * ((wPct ?? 0) / 100));

  document.getElementById("sessionPct").textContent = sPct ?? "--";
  document.getElementById("weeklyPct").textContent = wPct ?? "--";
  document.getElementById("sessionReset").textContent = fmtReset(usage.sessionReset);
  document.getElementById("weeklyReset").textContent = fmtReset(usage.weeklyReset);
  document.getElementById("updatedAt").textContent =
    cqrT(currentLang, "updated_prefix") + new Date(usage.updatedAt).toLocaleTimeString();
}

function renderDebug(list) {
  const el = document.getElementById("debugList");
  if (!list || !list.length) {
    el.textContent = cqrT(currentLang, "debug_empty");
    return;
  }
  el.textContent = list.map(c => {
    let body = JSON.stringify(c.payload, null, 2);
    if (body.length > 3000) body = body.slice(0, 3000) + "\n… (truncated)";
    return `[${new Date(c.ts).toLocaleTimeString()}] ${c.url}\n${body}`;
  }).join("\n\n---\n\n");
}

function renderUrlLog(list) {
  const el = document.getElementById("urlLogList");
  if (!list || !list.length) {
    el.textContent = cqrT(currentLang, "urllog_empty");
    return;
  }
  el.textContent = list.map(c =>
    `[${new Date(c.ts).toLocaleTimeString()}] (${c.contentType || "?"}) ${c.url}\n  ${c.snippet || ""}`
  ).join("\n\n");
}

function applyDebugTabVisibility(show) {
  const debugTab = document.querySelector('.tab[data-tab="debug"]');
  debugTab.style.display = show ? "" : "none";
  if (!show && debugTab.classList.contains("active")) {
    // switch back to the main tab if debug was showing when it got hidden
    document.querySelector('.tab[data-tab="main"]').click();
  }
}

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(tab.dataset.tab).classList.add("active");
  });
});

document.getElementById("settingsBtn").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

const refreshBtn = document.getElementById("refreshBtn");
let refreshSafetyTimer = null;

function stopSpinning() {
  refreshBtn.disabled = false;
  refreshBtn.classList.remove("spinning");
  if (refreshSafetyTimer) {
    clearTimeout(refreshSafetyTimer);
    refreshSafetyTimer = null;
  }
}

refreshBtn.addEventListener("click", () => {
  if (refreshBtn.disabled) return;
  refreshBtn.disabled = true;
  refreshBtn.classList.add("spinning");
  chrome.runtime.sendMessage({ type: "CQR_MANUAL_REFRESH" });
  // Safety fallback only — normally stopSpinning() is called the moment
  // fresh usage data actually lands, via the storage listener below.
  refreshSafetyTimer = setTimeout(stopSpinning, 15000);
});

cqrGetSettings((settings) => {
  currentLang = settings.language;
  applyI18n();
  applyDebugTabVisibility(settings.verboseDebug);

  chrome.storage.local.get(["usage", "debugCandidates", "urlLog"], (res) => {
    render(res.usage);
    renderDebug(res.debugCandidates);
    renderUrlLog(res.urlLog);
  });
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.settings) {
    const newSettings = changes.settings.newValue || {};
    currentLang = newSettings.language || CQR_DEFAULT_LANG;
    applyI18n();
    applyDebugTabVisibility(newSettings.verboseDebug);
  }
  if (changes.usage) {
    render(changes.usage.newValue);
    if (refreshBtn.classList.contains("spinning")) stopSpinning();
  }
  if (changes.debugCandidates) renderDebug(changes.debugCandidates.newValue);
  if (changes.urlLog) renderUrlLog(changes.urlLog.newValue);
});
