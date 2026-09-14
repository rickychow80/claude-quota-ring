let currentLang = CQR_DEFAULT_LANG;

function applyI18n() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = cqrT(currentLang, el.dataset.i18n);
  });
  document.title = cqrT(currentLang, "options_title");
}

function populateLangSelect(selected) {
  const select = document.getElementById("langSelect");
  select.innerHTML = "";
  CQR_LANGS.forEach(({ code, label }) => {
    const opt = document.createElement("option");
    opt.value = code;
    opt.textContent = label;
    if (code === selected) opt.selected = true;
    select.appendChild(opt);
  });
}

cqrGetSettings((settings) => {
  currentLang = settings.language;
  applyI18n();
  populateLangSelect(settings.language);
  document.getElementById("intervalInput").value = settings.refreshIntervalMinutes;
  document.getElementById("debugCheckbox").checked = settings.verboseDebug;

  // Re-apply translations live as the language dropdown changes, so the
  // rest of the page previews the change before Save is even clicked.
  document.getElementById("langSelect").addEventListener("change", (e) => {
    currentLang = e.target.value;
    applyI18n();
  });
});

document.getElementById("saveBtn").addEventListener("click", () => {
  const settings = {
    language: document.getElementById("langSelect").value,
    refreshIntervalMinutes: Math.max(1, Math.min(60, Number(document.getElementById("intervalInput").value) || 5)),
    verboseDebug: document.getElementById("debugCheckbox").checked
  };
  chrome.storage.local.set({ settings }, () => {
    chrome.runtime.sendMessage({ type: "CQR_SETTINGS_UPDATED", settings });
    const msg = document.getElementById("savedMsg");
    msg.classList.add("show");
    setTimeout(() => msg.classList.remove("show"), 2000);
  });
});
