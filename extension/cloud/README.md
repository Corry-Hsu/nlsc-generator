# Codex 雲端開發接續

本專案的程式碼、JavaScript 測試與 iOS 編譯流程已存放在 GitHub，不依賴原 Windows 電腦開機。若要讓 **Codex 的開發聊天本身** 也能在電腦休眠後繼續，還需建立並發布 Codex Cloud 環境，並在該環境啟動雲端工作。

這份說明及 setup 腳本本身不會建立雲端環境，也不會把既有本機聊天轉成雲端聊天。

## 建立環境

依 [OpenAI 官方雲端環境說明](https://learn.chatgpt.com/docs/environments/cloud-environments)，在網頁或桌面版的 Settings → Codex Cloud → Environments → Create environment，選擇 **Corry-Hsu/nlsc-generator**，完成設定並 Publish。也可從新工作中的 Work in → Cloud → Select environment → Create environment 進入。

設定時提供下列要求：

```text
請為 Corry-Hsu/nlsc-generator 的 main 分支建立可維護的雲端環境。
需要 Node.js 20 以上；JavaScript 不需額外 npm 套件。
在儲存庫根目錄執行 node extension/cloud/setup.cjs。
此指令會同步 iOS 資源、重建 Safari 單檔腳本、檢查 JavaScript 語法，並執行測試。
iOS Xcode 編譯交給既有 GitHub Actions 的 macOS runner，不要在 Linux 安裝 Xcode。
設定開發環境不需要任何 Apple 私鑰、GitHub signing token 或 TestFlight secrets。
```

發布後，從手機 Codex 選此環境建立雲端工作；後續請在同一個雲端工作接續。OpenAI 官方說明指出，Codex Cloud 工作可在電腦休眠時繼續。

## 接續工作背景

- 根目錄 `index.html`、`nlsc_5.html` 是既有腳本產生器網頁，保留其功能。
- 桌面核心為 `extension/content.js`，包含地號解析、批次查詢、著色、面積擷取與分行加總。
- 原生 App 在 `extension/ios/`，最低 iOS 16；原生層處理 PNG 快照與檔案分享。
- Safari 版在 `extension/safari/`，使用 Userscripts，必須在 page context 執行。Safari 逐行取景需使用者手動截圖，不能宣稱自動儲存、命名或裁切 PNG。
- 產生的 iOS Resources 核心與 `nlsc-mobile.user.js` 請由同步腳本更新，不要直接編輯。
- 2026-11-01 已完成 47 項 JavaScript 測試，以及 [GitHub 雲端 Xcode 免簽署編譯](https://github.com/Corry-Hsu/nlsc-generator/actions/runs/41287924982)。此結果不等於 iPhone 實機驗證。
- TestFlight 自動簽署上傳流程已提供，但尚待使用者設定 Apple Developer／App Store Connect 與 GitHub `testflight` environment。見 [CLOUD.md](../ios/CLOUD.md)。不要要求使用者將私鑰貼進聊天或公開儲存庫。
- 使用者只有 iPhone，沒有 Mac；手機上的實際網站操作及地圖 GPU 圖層快照仍需驗收。

## 工作完成後

將需要保留的變更提交到 GitHub。環境的保存狀態與程式碼版本管理是不同機制；不要只依賴本機檔案或未提交的暫存工作。
