/**
 * iimon（いい物件速いもん）コンテンツスクリプト
 *
 * iimon.co.jp 上で動作し、物件情報を自動抽出して
 * 不動産DXプラットフォームに取り込むボタンを表示する。
 */

(function () {
  "use strict";

  // 多重実行防止
  if (document.getElementById("fudosan-dx-iimon-panel")) return;

  // ---------------------------------------------------------------
  // UIの挿入
  // ---------------------------------------------------------------

  const panel = document.createElement("div");
  panel.id = "fudosan-dx-iimon-panel";
  panel.innerHTML = `
    <div id="fdx-header">
      <span>🏠 不動産DX</span>
      <button id="fdx-toggle" title="折りたたむ">▼</button>
    </div>
    <div id="fdx-body">
      <div id="fdx-status">iimonページを検出しました</div>
      <button id="fdx-scan" class="fdx-btn fdx-btn-primary">このページの物件を取込む</button>
      <button id="fdx-scan-all" class="fdx-btn fdx-btn-secondary">全ページを一括取込</button>
      <div id="fdx-result" style="display:none"></div>
    </div>
  `;

  const style = document.createElement("style");
  style.textContent = `
    #fudosan-dx-iimon-panel {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 260px;
      background: #fff;
      border: 2px solid #2563eb;
      border-radius: 10px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      z-index: 999999;
      font-family: -apple-system, sans-serif;
      font-size: 13px;
      overflow: hidden;
    }
    #fdx-header {
      background: #2563eb;
      color: #fff;
      padding: 8px 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: bold;
      cursor: move;
    }
    #fdx-toggle {
      background: none;
      border: none;
      color: #fff;
      cursor: pointer;
      font-size: 12px;
      padding: 0;
    }
    #fdx-body {
      padding: 12px;
    }
    #fdx-status {
      color: #6b7280;
      font-size: 12px;
      margin-bottom: 10px;
    }
    .fdx-btn {
      width: 100%;
      padding: 8px;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      margin-bottom: 6px;
      transition: opacity 0.2s;
    }
    .fdx-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .fdx-btn-primary { background: #2563eb; color: #fff; }
    .fdx-btn-primary:hover:not(:disabled) { background: #1d4ed8; }
    .fdx-btn-secondary { background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; }
    .fdx-btn-secondary:hover:not(:disabled) { background: #e5e7eb; }
    #fdx-result {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 6px;
      padding: 8px;
      font-size: 12px;
      color: #166534;
      margin-top: 8px;
    }
    #fdx-result.fdx-error {
      background: #fef2f2;
      border-color: #fecaca;
      color: #991b1b;
    }
    .fdx-prop-count {
      font-weight: bold;
      font-size: 16px;
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(panel);

  // パネルのドラッグ移動
  makeDraggable(panel, document.getElementById("fdx-header"));

  // 折りたたみ
  const toggleBtn = document.getElementById("fdx-toggle");
  const body = document.getElementById("fdx-body");
  let collapsed = false;
  toggleBtn.addEventListener("click", () => {
    collapsed = !collapsed;
    body.style.display = collapsed ? "none" : "block";
    toggleBtn.textContent = collapsed ? "▲" : "▼";
  });

  // ---------------------------------------------------------------
  // イベントリスナー
  // ---------------------------------------------------------------

  document.getElementById("fdx-scan").addEventListener("click", async () => {
    await scanAndImport(false);
  });

  document.getElementById("fdx-scan-all").addEventListener("click", async () => {
    if (confirm("全ページをスキャンして物件を一括取込しますか？\n（ページ数によっては時間がかかります）")) {
      await scanAndImport(true);
    }
  });

  // ---------------------------------------------------------------
  // 物件データの抽出・取込
  // ---------------------------------------------------------------

  async function scanAndImport(allPages) {
    const scanBtn = document.getElementById("fdx-scan");
    const scanAllBtn = document.getElementById("fdx-scan-all");
    const status = document.getElementById("fdx-status");
    const result = document.getElementById("fdx-result");

    scanBtn.disabled = true;
    scanAllBtn.disabled = true;
    result.style.display = "none";
    status.textContent = "物件情報を抽出中...";

    try {
      let properties = [];

      if (allPages) {
        // 全ページスキャン
        properties = await scanAllPages();
      } else {
        // 現在ページのみ
        properties = extractPropertiesFromPage();
      }

      if (properties.length === 0) {
        setStatus("このページに物件情報が見つかりませんでした", "warn");
        return;
      }

      status.textContent = `${properties.length}件を不動産DXに取込中...`;

      // バックグラウンドスクリプト経由でAPIに送信
      const res = await sendMessage("IIMON_IMPORT_BATCH", properties);

      result.className = ""; // reset error class
      result.style.display = "block";
      result.innerHTML = `
        <p>✅ 取込完了</p>
        <p class="fdx-prop-count">${res.succeeded}件</p>
        <p>成功 / ${res.failed > 0 ? `<span style="color:#dc2626">${res.failed}件失敗</span>` : "失敗なし"}</p>
      `;
      setStatus("取込が完了しました");
    } catch (err) {
      result.className = "fdx-error";
      result.style.display = "block";
      result.textContent = `エラー: ${err.message}`;
      setStatus("エラーが発生しました");
    } finally {
      scanBtn.disabled = false;
      scanAllBtn.disabled = false;
    }
  }

  // ---------------------------------------------------------------
  // iimon ページから物件情報を抽出
  // ---------------------------------------------------------------

  function extractPropertiesFromPage() {
    const properties = [];

    // iimonの物件リスト要素を取得
    // ※iimonのHTML構造に合わせてセレクタを調整
    const rows = document.querySelectorAll(
      "[data-room-id], .room-item, .property-item, .room-list-item, tr[data-id]",
    );

    if (rows.length > 0) {
      rows.forEach((row) => {
        const prop = extractFromRow(row);
        if (prop) properties.push(prop);
      });
    } else {
      // 詳細ページの場合（1物件）
      const single = extractFromDetailPage();
      if (single) properties.push(single);
    }

    return properties;
  }

  function extractFromRow(row) {
    const iimonId =
      row.dataset.roomId ||
      row.dataset.id ||
      row.getAttribute("data-room-id") ||
      generateId();

    // ページURL
    const linkEl = row.querySelector("a[href*='/room/'], a[href*='/rooms/']");
    const sourceUrl = linkEl ? new URL(linkEl.href, location.href).href : location.href;

    // 物件名
    const name = getText(row, [".room-name", ".property-name", "h3", "h4", ".name"]);

    // 住所
    const address = getText(row, [".address", "[data-address]", ".location"]);

    // 賃料
    const rentText = getText(row, [".rent", ".price", "[data-rent]", ".monthly-rent"]);
    const rent = parseYen(rentText);
    if (!rent && !name && !address) return null;

    // 最寄駅
    const stationText = getText(row, [".station", ".nearest-station", "[data-station]", ".access"]);

    // 間取り
    const layout = getText(row, [".layout", ".room-type", "[data-layout]", ".madori"]);

    // 面積
    const areaText = getText(row, [".area", ".floor-area", "[data-area]", ".menseki"]);

    // 申込・空室状況
    const statusText = getText(row, [".status", ".vacancy", "[data-status]", ".jotai"]);

    return {
      iimonId,
      sourceUrl,
      name: name || address || `物件${iimonId}`,
      address: address || "",
      nearestStation: parseStation(stationText),
      walkMinutes: parseWalkMinutes(stationText),
      rent,
      managementFee: 0,
      deposit: 0,
      keyMoney: 0,
      roomLayout: layout || null,
      floorArea: parseArea(areaText),
      floor: null,
      totalFloors: null,
      builtYear: null,
      availableFrom: null,
      features: [],
      description: statusText ? `申込状況: ${statusText}` : null,
      propertyType: guessPropertyType(name),
      confidence: 0.75,
    };
  }

  function extractFromDetailPage() {
    // 詳細ページ用（1物件の詳細情報をすべて取得）
    const iimonId = location.pathname.match(/\/rooms?\/(\d+)/)?.[1] || generateId();

    const name = getText(document, ["h1.room-name", ".property-title", "h1", ".bukken-name"]);
    const address = getText(document, [
      "[itemprop='address']",
      ".address",
      ".location",
      ".address-text",
    ]);
    const rentText = getText(document, [".rent-price", ".monthly-rent", ".price", "[data-rent]"]);
    const managementFeeText = getText(document, [".management-fee", ".kanri-hi"]);
    const depositText = getText(document, [".deposit", ".shikikin"]);
    const keyMoneyText = getText(document, [".key-money", ".reikin"]);
    const stationText = getText(document, [".nearest-station", ".station", ".access"]);
    const layoutText = getText(document, [".room-layout", ".madori", ".layout"]);
    const areaText = getText(document, [".floor-area", ".menseki", ".area"]);
    const floorText = getText(document, [".floor", ".kaisu"]);
    const builtYearText = getText(document, [".built-year", ".chikunen", ".age"]);

    const rent = parseYen(rentText);
    if (!name && !address && !rent) return null;

    return {
      iimonId,
      sourceUrl: location.href,
      name: name || address || "物件名不明",
      address: address || "",
      nearestStation: parseStation(stationText),
      walkMinutes: parseWalkMinutes(stationText),
      rent,
      managementFee: parseYen(managementFeeText),
      deposit: parseYen(depositText),
      keyMoney: parseYen(keyMoneyText),
      roomLayout: layoutText || null,
      floorArea: parseArea(areaText),
      floor: parseFloor(floorText),
      totalFloors: null,
      builtYear: parseBuiltYear(builtYearText),
      availableFrom: null,
      features: extractFeatures(),
      description: null,
      propertyType: guessPropertyType(name),
      confidence: 0.85,
    };
  }

  function extractFeatures() {
    const featureElements = document.querySelectorAll(
      ".features li, .setsubu li, .equipment li, [class*='feature'] li",
    );
    return Array.from(featureElements)
      .map((el) => el.textContent?.trim())
      .filter(Boolean)
      .slice(0, 20);
  }

  async function scanAllPages() {
    const allProperties = [];
    // 現在ページの物件を取得
    allProperties.push(...extractPropertiesFromPage());

    // ページネーションを辿る
    let nextLink = document.querySelector(
      'a[rel="next"], .pagination-next:not([disabled]), .next-page',
    );
    let pageCount = 1;
    const MAX_PAGES = 30;

    // 全ページスキャンはページ遷移が必要なため、
    // 現在実装では現在ページのみ対応（将来拡張）
    // 必要に応じてfetchで各ページのHTMLを取得して解析
    if (nextLink && pageCount < MAX_PAGES) {
      setStatus(`${pageCount}ページ目をスキャン済み（次ページへは手動で移動してください）`);
    }

    return allProperties;
  }

  // ---------------------------------------------------------------
  // ユーティリティ
  // ---------------------------------------------------------------

  function getText(root, selectors) {
    for (const sel of selectors) {
      const el = root.querySelector(sel);
      if (el && el.textContent?.trim()) return el.textContent.trim();
    }
    return "";
  }

  function parseYen(text) {
    if (!text) return 0;
    const cleaned = text.replace(/[^0-9.万]/g, "");
    const val = parseFloat(cleaned);
    if (isNaN(val)) return 0;
    if (text.includes("万")) return Math.round(val * 10000);
    return Math.round(val);
  }

  function parseArea(text) {
    if (!text) return null;
    const match = text.match(/[\d.]+/);
    if (!match) return null;
    const val = parseFloat(match[0]);
    return isNaN(val) ? null : val;
  }

  function parseStation(text) {
    if (!text) return null;
    const match = text.match(/(.+?[駅線])/);
    return match ? match[1] : null;
  }

  function parseWalkMinutes(text) {
    if (!text) return null;
    const match = text.match(/徒歩\s*(\d+)\s*分/);
    if (!match) return null;
    return parseInt(match[1], 10);
  }

  function parseFloor(text) {
    if (!text) return null;
    const match = text.match(/(\d+)\s*階/);
    return match ? parseInt(match[1], 10) : null;
  }

  function parseBuiltYear(text) {
    if (!text) return null;
    const match = text.match(/(\d{4})/);
    if (match) return parseInt(match[1], 10);
    // 「築〇年」形式
    const yearsMatch = text.match(/築\s*(\d+)\s*年/);
    if (yearsMatch) return new Date().getFullYear() - parseInt(yearsMatch[1], 10);
    return null;
  }

  function guessPropertyType(name) {
    if (!name) return "apartment";
    if (/マンション/.test(name)) return "mansion";
    if (/一戸建て|戸建|house/i.test(name)) return "house";
    if (/事務所|オフィス|office/i.test(name)) return "office";
    return "apartment";
  }

  function generateId() {
    return `iimon_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function setStatus(text, type) {
    const el = document.getElementById("fdx-status");
    if (el) el.textContent = text;
  }

  function sendMessage(type, payload) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type, payload }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response?.ok === false) {
          reject(new Error(response.error || "Unknown error"));
        } else {
          resolve(response);
        }
      });
    });
  }

  function makeDraggable(el, handle) {
    let startX, startY, startLeft, startBottom;
    handle.addEventListener("mousedown", (e) => {
      startX = e.clientX;
      startY = e.clientY;
      const rect = el.getBoundingClientRect();
      startLeft = rect.left;
      startBottom = window.innerHeight - rect.bottom;
      e.preventDefault();
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
    function onMove(e) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      el.style.left = `${startLeft + dx}px`;
      el.style.right = "auto";
      el.style.bottom = `${startBottom - dy}px`;
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
  }
})();
