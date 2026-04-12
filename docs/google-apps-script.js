/**
 * 不動産DXプラットフォーム - Google Sheets バックエンド管理スクリプト
 *
 * 使い方:
 * 1. スプレッドシートを開く
 * 2. 「拡張機能」→「Apps Script」を開く
 * 3. このコードを貼り付けて保存
 * 4. setupSheets() を実行してシート構造を初期化
 * 5. 「デプロイ」→「新しいデプロイ」→「ウェブアプリ」→「全員がアクセス可能」で公開
 * 6. デプロイURLを不動産DXプラットフォームの設定画面に登録
 */

// ===== シート初期化 =====

function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // シート定義
  const sheets = {
    "物件マスタ": [
      "物件ID", "物件名", "種別", "住所", "最寄駅", "徒歩(分)",
      "賃料(円)", "管理費(円)", "敷金(円)", "礼金(円)",
      "間取り", "面積(㎡)", "階数", "総階数", "築年",
      "入居可能日", "設備・特徴", "ステータス", "説明",
      "外部物件ID", "登録日", "更新日"
    ],
    "顧客マスタ": [
      "顧客ID", "氏名", "メール", "電話番号", "LINE ID",
      "流入経路", "ステータス", "担当者", "備考",
      "希望エリア", "希望駅", "予算下限(万円)", "予算上限(万円)",
      "希望間取り", "希望面積(㎡)", "入居希望日", "必須条件", "NG条件",
      "登録日", "更新日"
    ],
    "申込管理": [
      "申込ID", "顧客名", "物件名", "担当者",
      "ステータス", "入居希望日", "備考",
      "申込日", "更新日"
    ],
    "タスク管理": [
      "タスクID", "タイトル", "種別", "優先度", "ステータス",
      "担当者", "関連顧客", "期限", "説明",
      "完了日", "作成日", "更新日"
    ],
    "内見予約": [
      "予約ID", "顧客名", "物件名", "担当者",
      "予約日時", "ステータス", "備考",
      "作成日"
    ],
    "契約管理": [
      "契約ID", "顧客名", "物件名", "担当者",
      "契約種別", "契約開始日", "契約終了日", "月額賃料(円)",
      "ステータス", "備考",
      "作成日", "更新日"
    ],
    "入居者管理": [
      "入居者ID", "氏名", "物件名", "部屋番号",
      "入居日", "契約終了日", "月額賃料(円)",
      "ステータス", "緊急連絡先", "備考"
    ],
    "家賃管理": [
      "ID", "入居者名", "物件名", "対象月",
      "賃料(円)", "管理費(円)", "合計(円)",
      "入金日", "入金額(円)", "差額(円)", "ステータス", "備考"
    ],
    "売上実績": [
      "ID", "年月", "担当者", "区分",
      "売上額(円)", "物件名", "顧客名", "備考",
      "登録日"
    ],
    "担当者マスタ": [
      "担当者ID", "氏名", "メール", "役職", "権限",
      "ステータス", "登録日"
    ],
    "設定": [
      "設定キー", "設定値", "説明", "更新日"
    ],
    "同期ログ": [
      "日時", "方向", "対象シート", "操作", "件数", "ステータス", "詳細"
    ]
  };

  for (const [name, headers] of Object.entries(sheets)) {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
    }
    // ヘッダー行セット
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setValues([headers]);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#4285f4");
    headerRange.setFontColor("#ffffff");

    // 列幅自動調整
    for (let i = 1; i <= headers.length; i++) {
      sheet.autoResizeColumn(i);
    }

    // フィルター設定
    if (sheet.getMaxRows() > 1) {
      // データ範囲のフィルター
    }
    sheet.setFrozenRows(1);
  }

  // デフォルトのシート1を削除
  const sheet1 = ss.getSheetByName("シート1");
  if (sheet1 && ss.getSheets().length > 1) {
    ss.deleteSheet(sheet1);
  }

  // 設定シートに初期値を入れる
  const settingsSheet = ss.getSheetByName("設定");
  const settingsData = [
    ["company_name", "", "会社名", new Date()],
    ["company_target", "3000000", "今月の売上目標(円)", new Date()],
    ["smtp_email", "", "SMTP送信元メール", new Date()],
    ["smtp_host", "smtp.gmail.com", "SMTPホスト", new Date()],
    ["smtp_port", "587", "SMTPポート", new Date()],
    ["line_channel_id", "", "LINE Channel ID", new Date()],
    ["line_channel_secret", "", "LINE Channel Secret", new Date()],
    ["line_access_token", "", "LINE Access Token", new Date()],
    ["iimon_email", "", "iimonメール", new Date()],
    ["iimon_password", "", "iimonパスワード", new Date()],
    ["sync_url", "", "不動産DX プラットフォームURL", new Date()],
  ];
  settingsSheet.getRange(2, 1, settingsData.length, 4).setValues(settingsData);

  SpreadsheetApp.getUi().alert("シート構造の初期化が完了しました！\n\n次のステップ:\n1. 「デプロイ」→「新しいデプロイ」\n2. 種類: ウェブアプリ\n3. アクセス: 全員\n4. デプロイURLを不動産DXの設定画面に登録");
}


// ===== Web API (GET) =====

function doGet(e) {
  const action = e.parameter.action || "ping";
  const sheet = e.parameter.sheet;

  try {
    switch (action) {
      case "ping":
        return jsonResponse({ status: "ok", timestamp: new Date().toISOString() });

      case "list":
        return jsonResponse(getSheetData(sheet));

      case "sheets":
        return jsonResponse(listSheets());

      case "settings":
        return jsonResponse(getSettings());

      case "summary":
        return jsonResponse(getDashboardSummary());

      default:
        return jsonResponse({ error: "Unknown action: " + action }, 400);
    }
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}


// ===== Web API (POST) =====

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    switch (action) {
      case "upsert":
        return jsonResponse(upsertRows(body.sheet, body.rows, body.idColumn || 0));

      case "append":
        return jsonResponse(appendRows(body.sheet, body.rows));

      case "delete":
        return jsonResponse(deleteRows(body.sheet, body.ids, body.idColumn || 0));

      case "sync_from_platform":
        return jsonResponse(syncFromPlatform(body));

      case "update_setting":
        return jsonResponse(updateSetting(body.key, body.value));

      case "log":
        return jsonResponse(addSyncLog(body));

      default:
        return jsonResponse({ error: "Unknown action: " + action }, 400);
    }
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}


// ===== データ操作 =====

function getSheetData(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { error: "Sheet not found: " + sheetName, rows: [] };

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { headers: data[0] || [], rows: [] };

  const headers = data[0];
  const rows = data.slice(1).map((row, idx) => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] instanceof Date ? row[i].toISOString() : row[i];
    });
    obj._rowIndex = idx + 2; // 1-based, header=1
    return obj;
  });

  return { headers, rows, count: rows.length };
}

function appendRows(sheetName, rows) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { error: "Sheet not found" };

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const values = rows.map(row => headers.map(h => row[h] ?? ""));
  sheet.getRange(sheet.getLastRow() + 1, 1, values.length, headers.length).setValues(values);

  return { appended: values.length };
}

function upsertRows(sheetName, rows, idColIndex) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { error: "Sheet not found" };

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const data = sheet.getDataRange().getValues();
  const idCol = typeof idColIndex === "string"
    ? headers.indexOf(idColIndex)
    : idColIndex;

  let updated = 0, inserted = 0;

  for (const row of rows) {
    const rowValues = headers.map(h => row[h] ?? "");
    const id = rowValues[idCol];
    let found = false;

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idCol]) === String(id)) {
        sheet.getRange(i + 1, 1, 1, headers.length).setValues([rowValues]);
        data[i] = rowValues;
        updated++;
        found = true;
        break;
      }
    }

    if (!found) {
      sheet.appendRow(rowValues);
      data.push(rowValues);
      inserted++;
    }
  }

  return { updated, inserted };
}

function deleteRows(sheetName, ids, idColIndex) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { error: "Sheet not found" };

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const idCol = typeof idColIndex === "string"
    ? headers.indexOf(idColIndex)
    : idColIndex;

  const data = sheet.getDataRange().getValues();
  const idSet = new Set(ids.map(String));
  let deleted = 0;

  // 下から削除（行番号ズレ防止）
  for (let i = data.length - 1; i >= 1; i--) {
    if (idSet.has(String(data[i][idCol]))) {
      sheet.deleteRow(i + 1);
      deleted++;
    }
  }

  return { deleted };
}


// ===== 設定 =====

function getSettings() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("設定");
  if (!sheet) return {};

  const data = sheet.getDataRange().getValues();
  const settings = {};
  for (let i = 1; i < data.length; i++) {
    settings[data[i][0]] = {
      value: data[i][1],
      description: data[i][2],
      updatedAt: data[i][3] instanceof Date ? data[i][3].toISOString() : data[i][3],
    };
  }
  return settings;
}

function updateSetting(key, value) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("設定");
  if (!sheet) return { error: "設定シートが見つかりません" };

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      sheet.getRange(i + 1, 4).setValue(new Date());
      return { updated: key };
    }
  }

  // 存在しなければ追加
  sheet.appendRow([key, value, "", new Date()]);
  return { inserted: key };
}


// ===== ダッシュボードサマリー =====

function getDashboardSummary() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  function countRows(name) {
    const s = ss.getSheetByName(name);
    return s ? Math.max(0, s.getLastRow() - 1) : 0;
  }

  function sumColumn(name, colHeader) {
    const s = ss.getSheetByName(name);
    if (!s) return 0;
    const data = s.getDataRange().getValues();
    const headers = data[0];
    const colIdx = headers.indexOf(colHeader);
    if (colIdx < 0) return 0;
    return data.slice(1).reduce((sum, row) => sum + (Number(row[colIdx]) || 0), 0);
  }

  return {
    properties: countRows("物件マスタ"),
    customers: countRows("顧客マスタ"),
    applications: countRows("申込管理"),
    tasks: countRows("タスク管理"),
    tenants: countRows("入居者管理"),
    contracts: countRows("契約管理"),
    monthlySales: sumColumn("売上実績", "売上額(円)"),
    updatedAt: new Date().toISOString(),
  };
}


// ===== 同期 =====

function syncFromPlatform(body) {
  const results = {};

  if (body.properties) {
    results.properties = upsertRows("物件マスタ", body.properties, "物件ID");
  }
  if (body.customers) {
    results.customers = upsertRows("顧客マスタ", body.customers, "顧客ID");
  }
  if (body.applications) {
    results.applications = upsertRows("申込管理", body.applications, "申込ID");
  }
  if (body.tasks) {
    results.tasks = upsertRows("タスク管理", body.tasks, "タスクID");
  }
  if (body.sales) {
    results.sales = appendRows("売上実績", body.sales);
  }
  if (body.staff) {
    results.staff = upsertRows("担当者マスタ", body.staff, "担当者ID");
  }

  // 同期ログ追加
  addSyncLog({
    direction: "Platform → Sheet",
    target: Object.keys(results).join(", "),
    operation: "sync",
    count: Object.values(results).reduce((s, r) => s + (r.updated || 0) + (r.inserted || 0) + (r.appended || 0), 0),
    status: "成功",
    detail: JSON.stringify(results),
  });

  return results;
}

function addSyncLog(body) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("同期ログ");
  if (!sheet) return { error: "同期ログシートが見つかりません" };

  sheet.appendRow([
    new Date(),
    body.direction || "",
    body.target || "",
    body.operation || "",
    body.count || 0,
    body.status || "",
    body.detail || "",
  ]);

  return { logged: true };
}


// ===== シート一覧 =====

function listSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheets().map(s => ({
    name: s.getName(),
    rows: Math.max(0, s.getLastRow() - 1),
    columns: s.getLastColumn(),
  }));
}


// ===== ユーティリティ =====

function jsonResponse(data, code) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
