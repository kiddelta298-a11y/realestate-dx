/**
 * content.js - いいもん「物出し早いもん」ページから物件情報を抽出
 *
 * いいもんのページ上に「不動産DXに取込」ボタンを表示し、
 * クリックすると表示中の物件一覧をDOMから読み取ってバックエンドに送信する。
 *
 * DOM構造はいいもん側の更新で変わる可能性があるため、
 * セレクタは上部に集約して変更しやすくしている。
 */

// ============================================================
// セレクタ定義（いいもんのDOM変更時はここだけ修正）
// ============================================================
const SELECTORS = {
  // 物件カードのコンテナ（1物件 = 1要素）
  propertyCard: "table.bukken-table tbody tr, div.property-card, div.bukken-item, tr.bukken-row",

  // カード内の各データ要素（カード内での相対セレクタ）
  name: ".bukken-name, .property-name, td:nth-child(2)",
  address: ".bukken-address, .property-address, .address",
  rent: ".bukken-chinryo, .rent, .chinryo",
  layout: ".bukken-madori, .madori, .layout",
  area: ".bukken-menseki, .menseki, .area",
  deposit: ".bukken-shikikin, .shikikin, .deposit",
  keyMoney: ".bukken-reikin, .reikin, .key-money",
  builtYear: ".bukken-chikunen, .chikunen, .built-year",
  station: ".bukken-eki, .eki, .station",
  walkMinutes: ".bukken-toho, .toho, .walk",
  floor: ".bukken-kai, .kai, .floor",
  photoCount: ".bukken-photo-count, .photo-count",
  listingCompany: ".bukken-kaisha, .kanri-kaisha, .listing-company",
  adFee: ".bukken-koukokuryou, .koukoku, .ad-fee",
  externalUrl: "a.bukken-detail, a.detail-link, a[href*='detail']",
};

// ============================================================
// DOM からテキストを安全に取得するヘルパー
// ============================================================
function getText(parent, selector) {
  if (!selector) return "";
  const selectors = selector.split(",").map((s) => s.trim());
  for (const sel of selectors) {
    const el = parent.querySelector(sel);
    if (el) return el.textContent.trim();
  }
  return "";
}

function getHref(parent, selector) {
  if (!selector) return "";
  const selectors = selector.split(",").map((s) => s.trim());
  for (const sel of selectors) {
    const el = parent.querySelector(sel);
    if (el) return el.href || el.getAttribute("href") || "";
  }
  return "";
}

// 数値を抽出（"12.5万円" → 125000, "8,000円" → 8000 等）
function parseRent(text) {
  if (!text) return 0;
  const cleaned = text.replace(/[,、\s]/g, "");
  // "12.5万" or "12万5000" パターン
  const man = cleaned.match(/([\d.]+)\s*万/);
  if (man) return Math.round(parseFloat(man[1]) * 10000);
  // "125000円" パターン
  const yen = cleaned.match(/([\d]+)/);
  if (yen) return parseInt(yen[1], 10);
  return 0;
}

function parseNumber(text) {
  if (!text) return null;
  const m = text.match(/([\d.]+)/);
  return m ? parseFloat(m[1]) : null;
}

function parseYear(text) {
  if (!text) return null;
  // "2020年築" or "築4年" or "2020"
  const y = text.match(/((?:19|20)\d{2})/);
  if (y) return parseInt(y[1], 10);
  const age = text.match(/築\s*(\d+)\s*年/);
  if (age) return new Date().getFullYear() - parseInt(age[1], 10);
  return null;
}

// ============================================================
// 物件カードからデータを抽出
// ============================================================
function extractProperty(card) {
  const name = getText(card, SELECTORS.name);
  const address = getText(card, SELECTORS.address);
  const rentText = getText(card, SELECTORS.rent);
  const layout = getText(card, SELECTORS.layout);
  const areaText = getText(card, SELECTORS.area);
  const depositText = getText(card, SELECTORS.deposit);
  const keyMoneyText = getText(card, SELECTORS.keyMoney);
  const builtYearText = getText(card, SELECTORS.builtYear);
  const station = getText(card, SELECTORS.station);
  const walkText = getText(card, SELECTORS.walkMinutes);
  const floorText = getText(card, SELECTORS.floor);
  const photoCountText = getText(card, SELECTORS.photoCount);
  const listingCompany = getText(card, SELECTORS.listingCompany);
  const adFee = getText(card, SELECTORS.adFee);
  const detailUrl = getHref(card, SELECTORS.externalUrl);

  // 最低限の情報（物件名 or 住所）がなければスキップ
  if (!name && !address) return null;

  return {
    name: name || "名称不明",
    address: address || "",
    rent: parseRent(rentText),
    roomLayout: layout || null,
    floorArea: parseNumber(areaText),
    deposit: parseRent(depositText),
    keyMoney: parseRent(keyMoneyText),
    builtYear: parseYear(builtYearText),
    nearestStation: station || null,
    walkMinutes: parseNumber(walkText) ? Math.round(parseNumber(walkText)) : null,
    floor: parseNumber(floorText) ? Math.round(parseNumber(floorText)) : null,
    photoCount: parseNumber(photoCountText) ? Math.round(parseNumber(photoCountText)) : null,
    listingCompany: listingCompany || null,
    adFee: adFee || null,
    externalUrl: detailUrl || null,
    rawText: card.textContent.replace(/\s+/g, " ").trim().substring(0, 500),
  };
}

// ============================================================
// ページ全体から物件を一括抽出
// ============================================================
function extractAllProperties() {
  const cards = document.querySelectorAll(SELECTORS.propertyCard);
  const properties = [];

  cards.forEach((card) => {
    const prop = extractProperty(card);
    if (prop) properties.push(prop);
  });

  return properties;
}

// ============================================================
// フォールバック：テーブル/リスト構造を自動検出して抽出
// ============================================================
function extractFallback() {
  const properties = [];

  // テーブル行ベースの抽出を試行
  const tables = document.querySelectorAll("table");
  for (const table of tables) {
    const rows = table.querySelectorAll("tbody tr");
    if (rows.length < 2) continue; // データ行が少なすぎる

    rows.forEach((row) => {
      const cells = row.querySelectorAll("td");
      if (cells.length < 3) return;

      const text = row.textContent;
      // 物件っぽい行か判定（賃料・万円・間取りなどのキーワード）
      if (!/[万円]|[0-9]+(LDK|DK|K|R)|賃料|家賃/.test(text)) return;

      const cellTexts = Array.from(cells).map((c) => c.textContent.trim());

      // 賃料を含むセルを探す
      let rent = 0;
      let name = "";
      let address = "";
      for (const ct of cellTexts) {
        if (/万/.test(ct) && !rent) rent = parseRent(ct);
        else if (/[都道府県市区町村]/.test(ct) && !address) address = ct;
        else if (!name && ct.length > 2 && ct.length < 100) name = ct;
      }

      if (rent > 0 || name) {
        properties.push({
          name: name || "名称不明",
          address: address || "",
          rent,
          roomLayout: null,
          floorArea: null,
          deposit: 0,
          keyMoney: 0,
          builtYear: null,
          nearestStation: null,
          walkMinutes: null,
          floor: null,
          photoCount: null,
          listingCompany: null,
          adFee: null,
          externalUrl: null,
          rawText: row.textContent.replace(/\s+/g, " ").trim().substring(0, 500),
        });
      }
    });

    if (properties.length > 0) break; // 最初に見つかったテーブルのみ
  }

  return properties;
}

// ============================================================
// UIボタンの挿入
// ============================================================
function createUI() {
  // 既に挿入済みならスキップ
  if (document.getElementById("rdx-iimon-panel")) return;

  const panel = document.createElement("div");
  panel.id = "rdx-iimon-panel";
  panel.innerHTML = `
    <div class="rdx-header">
      <span class="rdx-logo">不動産DX</span>
      <span class="rdx-subtitle">物件取込</span>
    </div>
    <div class="rdx-body">
      <div id="rdx-status" class="rdx-status">待機中</div>
      <button id="rdx-extract-btn" class="rdx-btn rdx-btn-primary">
        物件を取込む
      </button>
      <div id="rdx-result" class="rdx-result" style="display:none;"></div>
    </div>
  `;

  document.body.appendChild(panel);

  // 取込ボタンのイベント
  document.getElementById("rdx-extract-btn").addEventListener("click", handleExtract);
}

// ============================================================
// 取込処理
// ============================================================
async function handleExtract() {
  const btn = document.getElementById("rdx-extract-btn");
  const status = document.getElementById("rdx-status");
  const result = document.getElementById("rdx-result");

  btn.disabled = true;
  btn.textContent = "取込中...";
  status.textContent = "物件情報を読み取っています...";
  status.className = "rdx-status";
  result.style.display = "none";

  try {
    // 1. DOM から物件を抽出
    let properties = extractAllProperties();

    // セレクタで見つからなければフォールバック
    if (properties.length === 0) {
      properties = extractFallback();
    }

    if (properties.length === 0) {
      status.textContent = "物件が見つかりませんでした";
      status.className = "rdx-status rdx-status-warn";
      result.innerHTML = `
        <p>ページ上に物件データが検出できませんでした。</p>
        <p>物出し早いもんの新着一覧ページを表示してから再度お試しください。</p>
      `;
      result.style.display = "block";
      return;
    }

    status.textContent = `${properties.length}件の物件を検出。送信中...`;

    // 2. バックエンドに送信
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: "IMPORT_PROPERTIES", properties },
        (res) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (!res.success) {
            reject(new Error(res.error));
          } else {
            resolve(res.data);
          }
        }
      );
    });

    const data = response.data || response;
    const newCount = data.newCount ?? properties.length;
    const updatedCount = data.updatedCount ?? 0;
    const skippedCount = data.skippedCount ?? 0;

    status.textContent = "取込完了";
    status.className = "rdx-status rdx-status-ok";
    result.innerHTML = `
      <div class="rdx-result-row"><span>新規取込</span><strong>${newCount}件</strong></div>
      <div class="rdx-result-row"><span>更新</span><strong>${updatedCount}件</strong></div>
      <div class="rdx-result-row"><span>スキップ（既存）</span><strong>${skippedCount}件</strong></div>
    `;
    result.style.display = "block";
  } catch (err) {
    status.textContent = "エラーが発生しました";
    status.className = "rdx-status rdx-status-error";
    result.innerHTML = `<p class="rdx-error-text">${err.message}</p>`;
    result.style.display = "block";
  } finally {
    btn.disabled = false;
    btn.textContent = "物件を取込む";
  }
}

// ============================================================
// 初期化
// ============================================================
createUI();
