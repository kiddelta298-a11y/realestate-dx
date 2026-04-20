document.addEventListener("DOMContentLoaded", () => {
  const apiBaseInput = document.getElementById("apiBase");
  const companyIdInput = document.getElementById("companyId");
  const saveBtn = document.getElementById("saveBtn");
  const statusBar = document.getElementById("statusBar");

  // 設定を読み込み
  chrome.runtime.sendMessage({ type: "GET_CONFIG" }, (config) => {
    if (config) {
      apiBaseInput.value = config.apiBase || "";
      companyIdInput.value = config.companyId || "";
    }
  });

  // 設定を保存
  saveBtn.addEventListener("click", () => {
    const apiBase = apiBaseInput.value.trim().replace(/\/+$/, "");
    const companyId = companyIdInput.value.trim();

    if (!apiBase) {
      showStatus("API接続先を入力してください", true);
      return;
    }
    if (!companyId) {
      showStatus("会社IDを入力してください", true);
      return;
    }

    chrome.runtime.sendMessage(
      { type: "SAVE_CONFIG", apiBase, companyId },
      (res) => {
        if (res?.success) {
          showStatus("設定を保存しました");
        } else {
          showStatus("保存に失敗しました", true);
        }
      }
    );
  });

  function showStatus(msg, isError = false) {
    statusBar.textContent = msg;
    statusBar.className = isError ? "status error" : "status";
    statusBar.style.display = "block";
    setTimeout(() => {
      statusBar.style.display = "none";
    }, 3000);
  }
});
