// Runs in the MAIN world of claude.ai — same JS context as the page itself.
// We never make our own network requests and never touch cookies/tokens.
// We only look at responses the page ALREADY received for itself.

(() => {
  window.__CQR_DEBUG = window.__CQR_DEBUG || false;
  console.log("[ClaudeQuotaRing] fetch-hook.js loaded (MAIN world)");

  // Handed to us by content.js (isolated world) via a DOM attribute set
  // just before we run — see content.js for why this replaces a fixed
  // "source" string. We read it once and immediately scrub it from the
  // DOM so it isn't sitting there for other scripts to pick up later.
  const CQR_TOKEN = document.documentElement.dataset.cqrToken;
  delete document.documentElement.dataset.cqrToken;
  if (!CQR_TOKEN) return; // content.js didn't run first — nothing safe to do

  // Precise now that we know the real shape of the usage endpoint response:
  // { five_hour: {...}, seven_day: {...}, ... }. Checking actual top-level
  // keys (instead of a loose keyword search across the whole stringified
  // JSON) avoids false-positives on large, unrelated payloads — e.g. chat
  // history responses that happen to contain a "usage" token-count object
  // somewhere deep inside — which used to get captured whole and freeze
  // the popup's Debug tab when it tried to pretty-print them.
  function looksLikeUsagePayload(obj) {
    if (!obj || typeof obj !== "object") return false;
    return (
      (obj.five_hour && typeof obj.five_hour === "object") ||
      (obj.seven_day && typeof obj.seven_day === "object")
    );
  }

  function reportPayload(url, payload) {
    if (window.__CQR_DEBUG) console.log("[ClaudeQuotaRing] candidate", url, payload);
    window.postMessage({ source: CQR_TOKEN, type: "payload", url, payload }, "*");
  }

  // Records every /api/ URL we see a response for, even if we can't parse
  // it as JSON (e.g. Next.js RSC streaming payloads). This is the fallback
  // path for finding the real usage endpoint when payload-matching finds
  // nothing.
  function reportUrlSeen(url, contentType, snippet) {
    if (window.__CQR_DEBUG) console.log("[ClaudeQuotaRing] url seen", url, contentType);
    window.postMessage({ source: CQR_TOKEN, type: "url", url, contentType, snippet }, "*");
  }

  // Fires once when the page sends what looks like a chat completion request.
  // Used only as a "the user is active" signal to time a background refresh —
  // we never read the completion content itself.
  function reportActivity() {
    if (window.__CQR_DEBUG) console.log("[ClaudeQuotaRing] activity (completion-like request)");
    window.postMessage({ source: CQR_TOKEN, type: "activity" }, "*");
  }

  function looksLikeCompletion(url) {
    return /\/completion\b|\/chat_conversations\/[^/]+\/completion/i.test(url);
  }

  const STATIC_ASSET_RE = /\.(js|css|png|jpg|jpeg|svg|woff2?|ico|map)(\?|$)/i;

  function toAbsolute(url) {
    try { return new URL(url, location.href).href; } catch (e) { return url; }
  }

  function isApiUrl(absUrl) {
    // Broadened on purpose: some internal endpoints don't live under /api/
    // (e.g. Next.js RSC data fetches). Exclude obvious static assets instead.
    try {
      const u = new URL(absUrl);
      return u.hostname.endsWith("claude.ai") && !STATIC_ASSET_RE.test(u.pathname);
    } catch (e) {
      return false;
    }
  }

  // --- fetch() hook ---
  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await origFetch.apply(this, args);
    try {
      const rawUrl = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
      const url = toAbsolute(rawUrl);
      if (looksLikeCompletion(url)) reportActivity();
      if (isApiUrl(url)) {
        const clone = response.clone();
        const contentType = response.headers.get("content-type") || "";
        clone.text().then((text) => {
          reportUrlSeen(url, contentType, text.slice(0, 200));
          try {
            const data = JSON.parse(text);
            if (looksLikeUsagePayload(data)) reportPayload(url, data);
          } catch (e) {
            /* not JSON (e.g. RSC payload) — the URL log is still useful */
          }
        }).catch(() => {});
      }
    } catch (e) {
      /* never break the page's real request */
    }
    return response;
  };

  // --- XMLHttpRequest hook ---
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__cqr_url = toAbsolute(url);
    return origOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener("load", function () {
      try {
        const url = this.__cqr_url || "";
        if (isApiUrl(url)) {
          const text = typeof this.response === "string" ? this.response : JSON.stringify(this.response);
          reportUrlSeen(url, this.getResponseHeader("content-type") || "", (text || "").slice(0, 200));
          const data = typeof this.response === "string" ? JSON.parse(this.response) : this.response;
          if (looksLikeUsagePayload(data)) reportPayload(url, data);
        }
      } catch (e) {
        /* ignore non-JSON / unrelated responses */
      }
    });
    return origSend.apply(this, args);
  };
})();
