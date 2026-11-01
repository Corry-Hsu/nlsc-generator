# iPhone Safari 腳本版

只有 iPhone 也可安裝，不需要 Mac、Apple 開發者帳號或自行編譯。需要先安裝 [Userscripts（Quoid 官方 App）](https://apps.apple.com/app/userscripts/id1463298887)。

## 只用手機安裝

1. 從 App Store 安裝 Userscripts，開啟 App，依提示選一個腳本資料夾（例如 iCloud Drive／Userscripts）。
2. iPhone「設定」→「App」→「Safari」→「延伸功能」啟用 Userscripts。不同 iOS 版本的選單位置可能略有不同。
3. 用 **Safari** 開啟 [安裝腳本原始檔](https://raw.githubusercontent.com/Corry-Hsu/nlsc-generator/main/extension/safari/nlsc-mobile.user.js)。
4. 點 Safari 的網頁選單 → Userscripts，在出現的安裝提示完成安裝。若沒出現提示，從上面的連結下載檔案，將 `nlsc-mobile.user.js` 放入步驟 1 選定的資料夾，並在 Userscripts 確認已啟用。
5. 開啟 [國土測繪地圖](https://maps.nlsc.gov.tw/T09/mapshow.action)，允許 Userscripts 存取 **maps.nlsc.gov.tw**，再重新整理。需出現「NLSC 地號與面積助手」。
6. 如果網站顯示另一套手機介面或查詢元件不存在，試用 Safari「要求桌面網站」再重新整理。這份腳本依賴原版網站元件；尚待實機驗證，無法保證網站所有手機版面可用。

腳本需在網站的 page context 執行，因為會使用 NLSC 地圖物件。已指定 `@inject-into page`；請勿改成 content。若無面板，檢查網站權限、Userscripts 是否啟用、腳本資料夾是否已下載到本機。不要同時啟用多個 NLSC 助手腳本。

## 使用

- 貼上原版格式清單 →「開始查詢定位」→「擷取面積」。
- 「匯出 Excel」會開啟下載／分享面板，再點下載連結或「分享／儲存到檔案」。格式與原版相同，為 Excel XML，並非 `.xlsx`；手機試算表 App 的相容性需實測。
- 「逐行取景（手動截圖）」會逐行調整地圖並隱藏其他著色。每行點「隱藏提示 5 秒」，自行按 iPhone 截圖鍵；提示回來後點「已截圖，下一張」。
- **不會自動產生 PNG 下載、不會自動命名、不會自動裁切地圖**；截圖在「相片」，需自行裁切。程式只能知道你按了確認，無法判斷是否真的截圖。
- 點「停止並還原地圖」可停止；離開 Safari、改變畫面大小或等待超過 10 分鐘也會停止。取景流程結束後還原原本視角與著色顯示。
- 右下角「面板」可召回助手。建議橫放、保持 Safari 前景，避免截圖期間旋轉、縮放或收合工具列。

## 更新與驗收

更新時重新開啟腳本原始檔連結，在 Userscripts 安裝／覆蓋最新版。以 Userscripts 顯示的版本為準；本專案未依賴它支援自動更新。

開發端先執行 `npm run sync:ios` 再執行 `npm run build:safari`。輸出 `nlsc-mobile.user.js` 已內嵌共用核心，不需另外安裝其他 JavaScript 檔。不要直接修改產生的單檔；修改 `adapter.js`／`build.cjs` 或共用核心再重建。

已提供程式層測試；Safari 實機仍需驗收：腳本是否在 page context 啟動、批次選單載入、每筆面積與桌面相同、下載與分享能否儲存、手動取景是否完整顯示地號。若網站的 CSP 阻擋 page 注入，請回報錯誤，不能改成 isolated context 後仍假設地圖追蹤會運作。

安裝方式依 [Userscripts 官方說明](https://github.com/quoid/userscripts)；請使用官方 App 並只授權需要的網站。
