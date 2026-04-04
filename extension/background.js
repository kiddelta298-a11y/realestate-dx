/**
 * 不動産DX ブラウザ拡張 - バックグラウンドサービスワーカー
 * content scriptとpopupからのメッセージを受け取り、APIリクエストを代行する。
 */

const DEFAULT_API_BASE = "http://localhost:3002";
const DEFAULT_COMPANY_ID = "d2a99d6c-729c-4726-b880-c82dff485561";

// ---------------------------------------------------------------
// メッセージハンドラー
// ---------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse).catch((err) => {
    sendResponse({ ok: false, error: err.message });
  });
  return true; // 非同期レスポンスのため
});

async function handleMessage(message) {
  const { type, payload } = message;

  switch (type) {
    case "GET_SETTINGS":
      return getSettings();

    case "SAVE_SETTINGS":
      return saveSettings(payload);

    // iimon: 取得した物件データをAPIに登録
    case "IIMON_IMPORT_PROPERTY": {
      const settings = await getSettings();
      return importIimonProperty(payload, settings);
    }

    // iimon: 複数物件の一括取込
    case "IIMON_IMPORT_BATCH": {
      const settings = await getSettings();
      return importIimonBatch(payload, settings);
    }

    // SUUMO: 不動産DXから物件一覧取得
    case "SUUMO_GET_PROPERTIES": {
      const settings = await getSettings();
      return fetchProperties(settings);
    }

    // SUUMO: 投稿完了を記録
    case "SUUMO_RECORD_POST": {
      const settings = await getSettings();
      return recordSuumoPost(payload, settings);
    }

    default:
      return { ok: false, error: `Unknown message type: ${type}` };
  }
}

// ---------------------------------------------------------------
// 設定管理
// ---------------------------------------------------------------

async function getSettings() {
  const result = await chrome.storage.local.get(["apiBase", "companyId"]);
  return {
    apiBase: result.apiBase || DEFAULT_API_BASE,
    companyId: result.companyId || DEFAULT_COMPANY_ID,
  };
}

async function saveSettings({ apiBase, companyId }) {
  await chrome.storage.local.set({ apiBase, companyId });
  return { ok: true };
}

// ---------------------------------------------------------------
// iimon: 物件取込
// ---------------------------------------------------------------

async function importIimonProperty(property, { apiBase, companyId }) {
  // 1. 物件情報をDBに登録（confirm-import エンドポイントを使用）
  const res = await fetch(`${apiBase}/api/properties/confirm-import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      companyId,
      property: {
        name: property.name,
        propertyType: property.propertyType ?? "apartment",
        address: property.address,
        nearestStation: property.nearestStation,
        walkMinutes: property.walkMinutes,
        rent: property.rent,
        managementFee: property.managementFee ?? 0,
        deposit: property.deposit ?? 0,
        keyMoney: property.keyMoney ?? 0,
        roomLayout: property.roomLayout,
        floorArea: property.floorArea,
        floor: property.floor,
        totalFloors: property.totalFloors,
        builtYear: property.builtYear,
        availableFrom: property.availableFrom,
        features: property.features ?? [],
        description: property.description,
        externalId: `iimon_${property.iimonId}`,
      },
      importSource: {
        type: "url",
        url: property.sourceUrl,
        confidence: property.confidence ?? 0.8,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message ?? `API error: ${res.status}`);
  }

  // 2. 取込記録をiimon_syncsに追加
  await fetch(`${apiBase}/api/iimon/record-import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ companyId, newCount: 1, updatedCount: 0 }),
  }).catch(() => {}); // エラーは無視

  return { ok: true, data: await res.json() };
}

async function importIimonBatch(properties, settings) {
  const results = await Promise.allSettled(
    properties.map((p) => importIimonProperty(p, settings)),
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  return { ok: true, succeeded, failed };
}

// ---------------------------------------------------------------
// SUUMO: 物件一覧取得
// ---------------------------------------------------------------

async function fetchProperties({ apiBase, companyId }) {
  const res = await fetch(
    `${apiBase}/api/properties?companyId=${companyId}&status=available&limit=100`,
  );
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  return { ok: true, properties: data.data };
}

// ---------------------------------------------------------------
// SUUMO: 投稿記録
// ---------------------------------------------------------------

async function recordSuumoPost({ propertyId, suumoPropertyId, useStaging }, { apiBase, companyId }) {
  const res = await fetch(`${apiBase}/api/suumo/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      companyId,
      propertyId,
      suumoPropertyId,
      useStaging: useStaging ?? false,
      status: "posted",
    }),
  });

  if (!res.ok) return { ok: false };
  return { ok: true };
}
