/**
 * SUUMO コンテンツスクリプト
 *
 * SUUMO管理者サイト（suumo.jp/edit/）上で動作し、
 * 不動産DXプラットフォームの物件情報をSUUMO入力フォームに自動入力する。
 */

(function () {
  "use strict";

  // 多重実行防止
  if (document.getElementById("fudosan-dx-suumo-panel")) return;

  // SUUMOの入力フォームページか確認
  const isPostingPage =
    location.href.includes("/edit/") ||
    document.querySelector('form[action*="property"], form[action*="chintai"]');

  // ---------------------------------------------------------------
  // UIの挿入
  // ---------------------------------------------------------------

  const panel = document.createElement("div");
  panel.id = "fudosan-dx-suumo-panel";
  panel.innerHTML = `
    <div id="sdx-header">
      <span>🏠 不動産DX → SUUMO</span>
      <button id="sdx-toggle" title="折りたたむ">▼</button>
    </div>
    <div id="sdx-body">
      <div id="sdx-status">物件を選んで自動入力します</div>
      <div id="sdx-search">
        <input id="sdx-search-input" type="text" placeholder="物件名・住所で検索..." />
      </div>
      <div id="sdx-prop-list">
        <div id="sdx-loading">読み込み中...</div>
      </div>
      <div id="sdx-selected" style="display:none">
        <div id="sdx-selected-name"></div>
        <button id="sdx-autofill" class="sdx-btn sdx-btn-primary">SUUMOに自動入力</button>
        <button id="sdx-cancel" class="sdx-btn sdx-btn-secondary">解除</button>
      </div>
      <div id="sdx-result" style="display:none"></div>
    </div>
  `;

  const style = document.createElement("style");
  style.textContent = `
    #fudosan-dx-suumo-panel {
      position: fixed;
      top: 20px;
      right: 20px;
      width: 280px;
      max-height: 70vh;
      background: #fff;
      border: 2px solid #e55e00;
      border-radius: 10px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      z-index: 999999;
      font-family: -apple-system, sans-serif;
      font-size: 13px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    #sdx-header {
      background: #e55e00;
      color: #fff;
      padding: 8px 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: bold;
      cursor: move;
      flex-shrink: 0;
    }
    #sdx-toggle {
      background: none;
      border: none;
      color: #fff;
      cursor: pointer;
      font-size: 12px;
      padding: 0;
    }
    #sdx-body {
      padding: 10px;
      overflow-y: auto;
      flex: 1;
    }
    #sdx-status {
      color: #6b7280;
      font-size: 12px;
      margin-bottom: 8px;
    }
    #sdx-search-input {
      width: 100%;
      box-sizing: border-box;
      padding: 6px 8px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 12px;
      margin-bottom: 8px;
      outline: none;
    }
    #sdx-search-input:focus { border-color: #e55e00; }
    #sdx-prop-list {
      max-height: 200px;
      overflow-y: auto;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
    }
    .sdx-prop-item {
      padding: 8px 10px;
      cursor: pointer;
      border-bottom: 1px solid #f3f4f6;
      transition: background 0.1s;
    }
    .sdx-prop-item:last-child { border-bottom: none; }
    .sdx-prop-item:hover { background: #fff7ed; }
    .sdx-prop-item.selected { background: #fed7aa; }
    .sdx-prop-name { font-weight: 500; color: #111; font-size: 12px; }
    .sdx-prop-meta { color: #6b7280; font-size: 11px; margin-top: 2px; }
    #sdx-selected {
      margin-top: 10px;
      padding: 8px;
      background: #fff7ed;
      border: 1px solid #fed7aa;
      border-radius: 6px;
    }
    #sdx-selected-name {
      font-size: 12px;
      font-weight: 600;
      color: #92400e;
      margin-bottom: 8px;
    }
    .sdx-btn {
      width: 100%;
      padding: 8px;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      margin-bottom: 4px;
      transition: opacity 0.2s;
    }
    .sdx-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .sdx-btn-primary { background: #e55e00; color: #fff; }
    .sdx-btn-primary:hover:not(:disabled) { background: #c2410c; }
    .sdx-btn-secondary { background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; }
    #sdx-result {
      margin-top: 8px;
      padding: 8px;
      border-radius: 6px;
      font-size: 12px;
    }
    #sdx-result.success { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }
    #sdx-result.error { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
    #sdx-loading { color: #9ca3af; font-size: 12px; padding: 12px; text-align: center; }
  `;

  document.head.appendChild(style);
  document.body.appendChild(panel);

  makeDraggable(panel, document.getElementById("sdx-header"));

  // 折りたたみ
  let collapsed = false;
  document.getElementById("sdx-toggle").addEventListener("click", () => {
    collapsed = !collapsed;
    document.getElementById("sdx-body").style.display = collapsed ? "none" : "block";
    document.getElementById("sdx-toggle").textContent = collapsed ? "▲" : "▼";
  });

  // ---------------------------------------------------------------
  // 物件リストの読み込み
  // ---------------------------------------------------------------

  let allProperties = [];
  let selectedProperty = null;

  async function loadProperties() {
    try {
      const res = await sendMessage("SUUMO_GET_PROPERTIES", null);
      allProperties = res.properties || [];
      renderPropertyList(allProperties);
    } catch (err) {
      document.getElementById("sdx-loading").textContent = `読込失敗: ${err.message}`;
    }
  }

  function renderPropertyList(properties) {
    const list = document.getElementById("sdx-prop-list");
    if (properties.length === 0) {
      list.innerHTML = '<div id="sdx-loading">空室物件がありません</div>';
      return;
    }

    list.innerHTML = properties
      .map(
        (p) => `
        <div class="sdx-prop-item" data-id="${p.id}">
          <div class="sdx-prop-name">${escHtml(p.name)}</div>
          <div class="sdx-prop-meta">
            ${p.rent.toLocaleString()}円 / ${p.roomLayout ?? "-"} / ${p.nearestStation ?? p.address.slice(0, 15)}
          </div>
        </div>
      `,
      )
      .join("");

    list.querySelectorAll(".sdx-prop-item").forEach((item) => {
      item.addEventListener("click", () => selectProperty(item.dataset.id));
    });
  }

  // 検索フィルター
  document.getElementById("sdx-search-input").addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = q
      ? allProperties.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.address.toLowerCase().includes(q) ||
            (p.nearestStation ?? "").toLowerCase().includes(q),
        )
      : allProperties;
    renderPropertyList(filtered);
  });

  function selectProperty(id) {
    selectedProperty = allProperties.find((p) => p.id === id);
    if (!selectedProperty) return;

    // ハイライト
    document.querySelectorAll(".sdx-prop-item").forEach((el) => {
      el.classList.toggle("selected", el.dataset.id === id);
    });

    // 選択済み表示
    document.getElementById("sdx-selected-name").textContent =
      `選択中: ${selectedProperty.name}`;
    document.getElementById("sdx-selected").style.display = "block";
    document.getElementById("sdx-result").style.display = "none";
  }

  document.getElementById("sdx-cancel").addEventListener("click", () => {
    selectedProperty = null;
    document.querySelectorAll(".sdx-prop-item").forEach((el) => el.classList.remove("selected"));
    document.getElementById("sdx-selected").style.display = "none";
  });

  // ---------------------------------------------------------------
  // フォーム自動入力
  // ---------------------------------------------------------------

  document.getElementById("sdx-autofill").addEventListener("click", async () => {
    if (!selectedProperty) return;

    const btn = document.getElementById("sdx-autofill");
    btn.disabled = true;
    btn.textContent = "入力中...";

    try {
      const filled = fillSuumoForm(selectedProperty);

      const result = document.getElementById("sdx-result");
      result.className = "success";
      result.style.display = "block";
      result.textContent = `✅ ${filled}項目を自動入力しました`;

      document.getElementById("sdx-status").textContent = "入力完了！内容を確認して送信してください";

      // 投稿記録（任意）
      await sendMessage("SUUMO_RECORD_POST", {
        propertyId: selectedProperty.id,
        suumoPropertyId: null,
        useStaging: false,
      }).catch(() => {});
    } catch (err) {
      const result = document.getElementById("sdx-result");
      result.className = "error";
      result.style.display = "block";
      result.textContent = `エラー: ${err.message}`;
    } finally {
      btn.disabled = false;
      btn.textContent = "SUUMOに自動入力";
    }
  });

  // ---------------------------------------------------------------
  // SUUMOフォームへの入力
  // フィールドのセレクタはSUUMO管理画面の実際のHTML構造に合わせて調整
  // ---------------------------------------------------------------

  function fillSuumoForm(property) {
    let filledCount = 0;

    const fieldMap = [
      // [セレクタ, 値, タイプ]
      ['input[name="bukken_name"], #bukken_name, input[name="property_name"]', property.name, "text"],
      ['input[name="address"], #address, input[name="jyusho"]', property.address, "text"],
      ['input[name="yachin"], #yachin, input[name="rent"]', String(property.rent), "number"],
      ['input[name="kanrihi"], #kanrihi, input[name="management_fee"]', String(property.managementFee), "number"],
      ['input[name="shikikin"], #shikikin, input[name="deposit"]', String(property.deposit), "number"],
      ['input[name="reikin"], #reikin, input[name="key_money"]', String(property.keyMoney), "number"],
      ['input[name="eki"], #eki, input[name="nearest_station"]', property.nearestStation ?? "", "text"],
      ['input[name="toho"], #toho, input[name="walk_minutes"]', String(property.walkMinutes ?? ""), "number"],
      ['input[name="madori"], #madori, input[name="room_layout"]', property.roomLayout ?? "", "text"],
      ['input[name="menseki"], #menseki, input[name="floor_area"]', String(property.floorArea ?? ""), "number"],
      ['textarea[name="setsumei"], #setsumei, textarea[name="description"]', property.description ?? "", "textarea"],
    ];

    for (const [selectors, value, type] of fieldMap) {
      if (!value) continue;
      for (const sel of selectors.split(", ")) {
        const el = document.querySelector(sel);
        if (!el) continue;

        // 値をセット
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value",
        )?.set;

        if (nativeInputValueSetter) {
          nativeInputValueSetter.call(el, value);
        } else {
          el.value = value;
        }

        // Reactなどのフレームワーク対応：changeイベントを発火
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));

        filledCount++;
        break;
      }
    }

    // 物件種別（セレクト or ラジオ）
    const typeMap = { apartment: "アパート", mansion: "マンション", house: "一戸建て", office: "事務所" };
    const typeLabel = typeMap[property.propertyType] ?? "アパート";
    const typeSelect = document.querySelector('select[name="bukken_shubetsu"], select[name="property_type"]');
    if (typeSelect) {
      for (const opt of typeSelect.options) {
        if (opt.text.includes(typeLabel) || opt.value === property.propertyType) {
          typeSelect.value = opt.value;
          typeSelect.dispatchEvent(new Event("change", { bubbles: true }));
          filledCount++;
          break;
        }
      }
    }

    return filledCount;
  }

  // ---------------------------------------------------------------
  // ユーティリティ
  // ---------------------------------------------------------------

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
    let startX, startY, startRight, startTop;
    handle.addEventListener("mousedown", (e) => {
      const rect = el.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      startRight = window.innerWidth - rect.right;
      startTop = rect.top;
      e.preventDefault();
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
    function onMove(e) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      el.style.right = `${startRight - dx}px`;
      el.style.left = "auto";
      el.style.top = `${startTop + dy}px`;
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
  }

  function escHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // 初期化
  loadProperties();
})();
