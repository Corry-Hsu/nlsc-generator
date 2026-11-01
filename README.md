# NLSC 地號工具

地號腳本產生器、桌面瀏覽器外掛，以及共用同一份查詢核心的 iPhone／iPad App 專案。

## 專案位置

| 位置 | 用途 |
| --- | --- |
| `index.html`、`nlsc_5.html` | 原有地號腳本產生器網頁 |
| `extension/manifest.json` | Chrome／Edge 桌面外掛入口 |
| `extension/content.js` | 地號解析、批次查詢定位、著色、面積擷取與分組加總 |
| `extension/capture-*.js`、`extension/background.js` | 桌面截圖與下載 |
| `extension/ios/` | iOS App、原生截圖／匯出及觸控介面 |
| `extension/safari/` | iPhone Safari 單檔腳本、手動截圖取景與安裝說明 |
| `.github/workflows/ios-cloud.yml` | GitHub 雲端 Mac 編譯及手動 TestFlight 發布 |

## 桌面安裝

下載或 clone 此儲存庫，在 Chrome／Edge 擴充功能頁開啟開發人員模式，選「載入未封裝項目」，指定 `extension` 資料夾。開啟國土測繪網站 `https://maps.nlsc.gov.tw/T09/mapshow.action` 後重新整理。

先查詢地號，再擷取面積，可匯出 Excel XML 或依清單逐行截圖。桌面截圖首次需點外掛圖示授權。詳見 [截圖功能說明](extension/截圖功能說明.md)。

## iPhone／iPad

提供兩條路線，兩者共用桌面版查詢核心：

- **只有 iPhone、先試用**：[Safari 腳本安裝說明](extension/safari/README.md)。先裝 Userscripts，再用 Safari 開啟 [單檔腳本](https://raw.githubusercontent.com/Corry-Hsu/nlsc-generator/main/extension/safari/nlsc-mobile.user.js) 安裝。支援查詢、面積及 Excel XML；逐行截圖為自動取景後手動按截圖鍵，不會自動儲存 PNG。
- **App 完整功能路線**：[不用 Mac 的雲端編譯／TestFlight 設定](extension/ios/CLOUD.md)。GitHub 雲端 Mac 負責編譯及簽署；需自行完成 Apple Developer 與 GitHub secrets 設定才能上傳 TestFlight。尚無可直接安裝的邀請連結。

App 最低 iOS 16。程式層測試不能取代 iPhone 實機驗證，尤其網站手機排版與 GPU 地圖截圖。GitHub Pages 僅能提供腳本下載，不能直接安裝原生 App。自行使用 Mac 的步驟見 [iOS 說明](extension/ios/README.md)。

2026-11-01：[雲端 Xcode 免簽署編譯與 47 項測試通過](https://github.com/Corry-Hsu/nlsc-generator/actions/runs/41287924982)。TestFlight 簽署上傳尚待設定 Apple 帳號與 secrets，手機功能尚待實機驗收。

## 日後維護

若希望 Codex 在電腦休眠後繼續開發，見 [Codex 雲端開發接續說明](extension/cloud/README.md)。專案已放在 GitHub，還需在帳號建立並發布 Codex Cloud 環境。

需要 Node.js 20 以上；JavaScript 測試不需安裝額外 npm 套件。

```sh
git clone https://github.com/Corry-Hsu/nlsc-generator.git
cd nlsc-generator/extension
npm run sync:ios
npm run build:safari
npm run check
npm test
```

修改查詢或計算邏輯時編輯 `extension/content.js`；修改共用截圖幾何時編輯 `extension/capture-geometry.js`。接著執行上面的同步與測試指令，將原始碼和同步產生的手機資源一起提交。

`extension/ios/NLSCMobile/Resources/content.js`、`capture-geometry.js` 及 `extension/safari/nlsc-mobile.user.js` 是產物，請勿直接修改。手機專屬功能位於 `ios-bridge.js`、`mobile-ui.js`、`MapViewController.swift` 和 `safari/adapter.js`。

Mac 上建立 iOS 工程：

```sh
cd ios
xcodegen generate
open NLSCMobile.xcodeproj
```

`project.yml` 是 Xcode 工程設定來源；需先安裝 XcodeGen。簽署 Team 請使用自己的 Apple 帳號。建議每次調整後在 iPhone 驗證查詢、面積、分行截圖與檔案分享；JavaScript 測試不能代替實機驗收。
