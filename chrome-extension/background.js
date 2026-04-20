/**
 * background.js - Service Worker
 *
 * content.js から受け取った物件データを不動産DXバックエンドに送信する。
 * content script → background (message) → backend API
 */

// デフォルト設定
const DEFAULT_CONFIG = {
  apiBase: "https://realestate-dx-backend.onrender.com",
  companyId: "d2a99d6c-729c-4726-b880-c82dff485561",
};

async function getConfig() {
  const stored = await chrome.storage.local.get(["apiBase", "companyId"]);
  return {
    apiBase: stored.apiBase || DEFAULT_CONFIG.apiBase,
    companyId: stored.companyId || DEFAULT_CONFIG.companyId,
  };
}

// 物件データをバックエンドに送信
async function sendProperties(properties) {
  const config = await getConfig();
  const url = `${config.apiBase}/api/iimon/import`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      companyId: config.companyId,
      properties,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `API Error: ${res.status}`);
  }

  return res.json();
}

// content.js からのメッセージを処理
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "IMPORT_PROPERTIES") {
    sendProperties(message.properties)
      .then((result) => sendResponse({ success: true, data: result }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // 非同期応答を示す
  }

  if (message.type === "GET_CONFIG") {
    getConfig().then((config) => sendResponse(config));
    return true;
  }

  if (message.type === "SAVE_CONFIG") {
    chrome.storage.local
      .set({ apiBase: message.apiBase, companyId: message.companyId })
      .then(() => sendResponse({ success: true }));
    return true;
  }
});
