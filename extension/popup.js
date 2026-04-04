const DEFAULT_API_BASE = "http://localhost:3002";
const DEFAULT_COMPANY_ID = "d2a99d6c-729c-4726-b880-c82dff485561";

// ---------------------------------------------------------------
// 初期化
// ---------------------------------------------------------------

document.addEventListener("DOMContentLoaded", async () => {
  await loadSettings();
  await checkApiConnection();
});

// ---------------------------------------------------------------
// 設定の読み書き
// ---------------------------------------------------------------

async function loadSettings() {
  const result = await chrome.storage.local.get(["apiBase", "companyId"]);
  document.getElementById("api-base").value = result.apiBase || DEFAULT_API_BASE;
  document.getElementById("company-id").value = result.companyId || DEFAULT_COMPANY_ID;
  document.getElementById("api-url-display").textContent =
    new URL(result.apiBase || DEFAULT_API_BASE).host;
}

document.getElementById("save-settings").addEventListener("click", async () => {
  const apiBase = document.getElementById("api-base").value.trim();
  const companyId = document.getElementById("company-id").value.trim();

  if (!apiBase || !companyId) {
    showSaveResult("error", "APIのURLと会社IDを入力してください");
    return;
  }

  await chrome.storage.local.set({ apiBase, companyId });

  showSaveResult("success", "設定を保存しました");
  document.getElementById("api-url-display").textContent = new URL(apiBase).host;

  await checkApiConnection();
});

function showSaveResult(type, message) {
  const el = document.getElementById("save-result");
  el.className = `alert alert-${type}`;
  el.textContent = message;
  el.style.display = "block";
  setTimeout(() => { el.style.display = "none"; }, 3000);
}

// ---------------------------------------------------------------
// API接続確認
// ---------------------------------------------------------------

async function checkApiConnection() {
  const dot = document.getElementById("api-dot");
  const msg = document.getElementById("api-status-msg");

  dot.className = "status-dot yellow";
  msg.textContent = "接続確認中...";

  try {
    const result = await chrome.storage.local.get(["apiBase"]);
    const apiBase = result.apiBase || DEFAULT_API_BASE;

    const res = await fetch(`${apiBase}/health`, { signal: AbortSignal.timeout(5000) });

    if (res.ok) {
      dot.className = "status-dot green";
      msg.textContent = "接続OK";
    } else {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch (err) {
    dot.className = "status-dot gray";
    msg.textContent = `接続失敗: ${err.message}`;
  }
}
