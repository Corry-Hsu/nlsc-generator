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

## 桌面安裝

下載或 clone 此儲存庫，在 Chrome／Edge 擴充功能頁開啟開發人員模式，選「載入未封裝項目」，指定 `extension` 資料夾。開啟國土測繪網站 `https://maps.nlsc.gov.tw/T09/mapshow.action` 後重新整理。

先查詢地號，再擷取面積，可匯出 Excel XML 或依清單逐行截圖。桌面截圖首次需點外掛圖示授權。詳見 [截圖功能說明](extension/截圖功能說明.md)。

## iPhone／iPad

手機版為獨立 iOS App，最低 iOS 16，在 App 內開啟 NLSC 網站。它不是直接安裝至 Safari 的外掛。

已完成原始碼與 JavaScript 測試，尚未完成 Xcode 編譯及 iPhone 實機驗證，特別是地圖 GPU 圖層截圖與網站手機排版仍需驗收。需在 Mac 用 Xcode 編譯及簽署後才能安裝，不能直接從 GitHub Pages 安裝。

完整安裝、操作與實機驗收請見 [iOS 說明](extension/ios/README.md)。

## 日後維護

需要 Node.js 20 以上；JavaScript 測試不需安裝額外 npm 套件。

```sh
git clone https://github.com/Corry-Hsu/nlsc-generator.git
cd nlsc-generator/extension
npm run sync:ios
npm run check
npm test
```

修改查詢或計算邏輯時編輯 `extension/content.js`；修改共用截圖幾何時編輯 `extension/capture-geometry.js`。接著執行上面的同步與測試指令，將原始碼和同步產生的手機資源一起提交。

`extension/ios/NLSCMobile/Resources/content.js` 與 `capture-geometry.js` 是同步產物，請勿直接修改。手機專屬功能分別位於 `ios-bridge.js`、`mobile-ui.js` 和 `MapViewController.swift`。

Mac 上建立 iOS 工程：

```sh
cd ios
xcodegen generate
open NLSCMobile.xcodeproj
```

`project.yml` 是 Xcode 工程設定來源；需先安裝 XcodeGen。簽署 Team 請使用自己的 Apple 帳號。建議每次調整後在 iPhone 驗證查詢、面積、分行截圖與檔案分享；JavaScript 測試不能代替實機驗收。
