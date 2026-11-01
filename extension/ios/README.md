# iPhone／iPad NLSC 地號助手

這是獨立 iOS App 原始碼，在 App 內開啟國土測繪網站並載入原有外掛核心。不是可直接匯入 Safari 的外掛，也不是已簽署可安裝的 IPA。桌面版檔案不受修改。

**沒有 Mac？** 請改看 [只有 iPhone 的雲端編譯／TestFlight 流程](CLOUD.md)，或 [Safari 腳本版](../safari/README.md)。下方是自行用 Mac 的開發方式。

## 已實作

- 原版多行地號解析、批次查詢定位、著色與面積擷取。
- 原版逐筆與逐行加總 Excel XML 匯出（與桌面原版同格式，並非 `.xlsx`）。
- 依清單逐行取景、隔離其他著色並產生 PNG；完成或失敗後還原圖層與視角。
- 觸控拖曳、收合與召回面板，輸入內容記憶，按鈕觸控尺寸調整。
- 原生儲存至 App Documents，同名檔案加序號；上方「檔案」分享所有已匯出的 PNG／XML。
- 「檔案」App →「我的 iPhone」→「NLSC 地號助手」可管理、分享、刪除輸出檔案。

## 在 Mac 建立與安裝

需要 Mac、支援 iOS 16 SDK 以上的 Xcode、Node.js 與 XcodeGen。手機最低 iOS 16。

1. 將整個 `nlsc-extension` 資料夾複製到 Mac。
2. 在專案根目錄執行：

   ```sh
   node ios/scripts/sync-resources.cjs
   cd ios
   xcodegen generate
   open NLSCMobile.xcodeproj
   ```

   尚未安裝 XcodeGen 時，依 [官方安裝方式](https://github.com/yonaskolb/XcodeGen#installing) 安裝。
3. 在 Xcode 選 NLSCMobile target → Signing & Capabilities，選自己的 Team，將 Bundle Identifier 改為自己的唯一識別碼。
4. 連接 iPhone，依 Xcode 與手機提示完成信任、開發者模式設定，選擇手機後按 Run。
5. 如需 TestFlight／App Store 發布，另需完成開發者帳號、簽署及 Apple 發布流程。此專案尚未發布。

不需要截圖或相片權限；PNG 儲存至 App 文件，透過系統分享頁另存或分享。

## 手機操作

1. 開啟 App，等待網站與助手載入，建議將手機橫放。
2. 貼上原本格式的清單，例如：

   ```text
   屏東市光明段 477、512
   屏東市龍華段 1385
   ```
3. 按「開始查詢定位」，完成後按「擷取面積」。
4. 按「匯出 Excel」或「依清單逐行截圖 PNG」。保持 App 在前景，截圖時不要旋轉或縮放。
5. 點上方「檔案」→「儲存到檔案」或分享至其他 App。部分批次失敗時，已完成的檔案仍保留。
6. 找不到面板時點上方「面板」。重新整理會重新載入網站，需重跑查詢與面積擷取。

## 驗證狀態與實機驗收

Windows 已通過原版 36 項 JavaScript 測試及新增的 iOS bridge／匯出測試；尚未在 Xcode 編譯、模擬器或真實 iPhone 執行，不能保證目前已達到手機上與桌面完全一致。

Mac 端先確認編譯：

```sh
xcodebuild -project NLSCMobile.xcodeproj -scheme NLSCMobile -sdk iphonesimulator CODE_SIGNING_ALLOWED=NO build
```

實機必須驗收：網站手機排版是否顯示地號查詢元件、各筆面積與桌面一致、同地段不同行是否分圖、PNG 的底圖／地籍著色／文字是否完整、直橫向尺寸是否正確，以及切換背景／旋轉時能否停止並還原畫面。WKWebView 快照對 GPU 地圖圖層的輸出需以實機結果為準，JavaScript 測試不能驗證像素內容。網站若提供不同手機介面，可能仍需調整網站 DOM 相容性。

Excel XML 可交給支援該格式的軟體開啟；手機預覽與 Numbers 的相容性需另驗證。查詢鄉鎮範圍與來源網站限制沿用原版，沒有增加其他縣市支援。

輸出檔會一直保留，使用「檔案」App 刪除不需要的歷史檔。原始查詢仍直接連接 NLSC 網站，本專案沒有額外後端。

## 更新原版核心

原版 `content.js` 或 `capture-geometry.js` 更新後重新執行同步腳本；它只產生手機資源並替換手機匯出入口。不要直接修改 Resources 內產生的這兩個檔案。

在專案根目錄執行測試：

```sh
node --test background.test.cjs capture-bridge.test.cjs capture.test.cjs options.test.cjs ios/ios.test.cjs
```
