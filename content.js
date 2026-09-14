// Bridges the MAIN-world fetch hook (page context, no extension APIs)
// to the extension's background service worker (has chrome.* APIs,
// no access to the page's JS context). This is the only path data
// takes; nothing is sent anywhere off-device.
//
// window.postMessage is visible to every script sharing this window
// (the page itself, and any other extension's isolated-world content
// script) — a fixed "source" string would let any of them read our
// payloads or forge fake ones. Instead we mint a fresh random token
// per page load and hand it to fetch-hook.js via a DOM attribute that
// it reads and deletes immediately (see fetch-hook.js), so only the
// script that wins that same-tick handoff can produce valid messages.
const CQR_TOKEN = crypto.randomUUID();
document.documentElement.dataset.cqrToken = CQR_TOKEN;

console.log("[ClaudeQuotaRing] content.js loaded (ISOLATED world)");

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const msg = event.data;
  if (!msg || msg.source !== CQR_TOKEN) return;

  if (msg.type === "payload") {
    console.log("[ClaudeQuotaRing] content.js relaying payload ->", msg.url);
    chrome.runtime.sendMessage({
      type: "CQR_USAGE_CANDIDATE",
      url: msg.url,
      payload: msg.payload,
      ts: Date.now()
    });
  } else if (msg.type === "url") {
    chrome.runtime.sendMessage({
      type: "CQR_URL_SEEN",
      url: msg.url,
      contentType: msg.contentType,
      snippet: msg.snippet,
      ts: Date.now()
    });
  } else if (msg.type === "activity") {
    chrome.runtime.sendMessage({ type: "CQR_ACTIVITY", ts: Date.now() });
  }
});
