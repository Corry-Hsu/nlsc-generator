# 只有 iPhone：用 GitHub 雲端編譯並透過 TestFlight 安裝

你不需要自己的 Mac；GitHub Actions 會使用雲端 macOS runner。此流程已提供設定檔，但首次仍需要你建立 Apple 帳號項目與 GitHub secrets。尚未取得你的 Apple 設定，現在沒有可安裝的 TestFlight 邀請連結。

## A. 不用 Apple 帳號也能先確認編譯

用 iPhone Safari 登入 [此儲存庫 Actions](https://github.com/Corry-Hsu/nlsc-generator/actions)，選 **iOS Cloud Build** → **Run workflow** → mode 選 `check` → 執行。必要時切換 Safari「要求桌面網站」。更新 `extension/` 時也會自動進行免簽署編譯與 JavaScript 測試。

輸出 artifact 是 **模擬器 App**，不能安裝至 iPhone。成功只代表編譯通過；不能證明網站及 GPU 地圖截圖已在實機正常運作。

如果 Actions 清單沒有這個流程，表示 `.github/workflows/ios-cloud.yml` 尚未啟用：將本目錄的 `../cloud/ios-cloud.yml`（儲存庫位置：`extension/cloud/ios-cloud.yml`）內容複製到儲存庫根目錄的 `.github/workflows/ios-cloud.yml` 並提交。GitHub 連線若沒有 Workflows 寫入權限，需要你在 GitHub 網頁完成這一步。

## B. 第一次準備（可在手機瀏覽器處理）

1. 加入 [Apple Developer Program](https://developer.apple.com/programs/enroll/)，完成身分驗證、付費、協議；以 Apple 顯示的當地費用為準。免費 Apple 帳號不能用此 TestFlight 發布流程。
2. 到 [Apple Developer 帳號](https://developer.apple.com/account/) 記下 10 碼 **Team ID**，建立一個 App ID／Bundle ID，例如 `tw.corry.nlsc.mobile`。之後所有地方必須填相同 ID。
3. 在 [App Store Connect](https://appstoreconnect.apple.com/) 建立 iOS App，選剛剛的 Bundle ID，填名稱、主要語言和自訂 SKU。App Store Connect 的 App 記錄必須先存在。
4. App Store Connect → Users and Access／使用者和存取權限 → Integrations／整合 → App Store Connect API，依 Apple 提示申請 API 存取，建立 **Team API Key**。為了初次建立簽署，需可管理 Certificates, Identifiers & Profiles 的權限（可使用 Admin 角色）。記下 Key ID、Issuer ID，將 `.p8` 私鑰下載到手機；Apple 只允許下載一次。這裡不是 individual API key。
5. 在 GitHub 建立**另一個私人儲存庫**，例如 `Corry-Hsu/nlsc-signing`，勾選建立 README，使預設 `main` 分支存在。這是加密憑證庫，**不可用公開的 nlsc-generator**。
6. GitHub 帳號 → Settings → Developer settings → Personal access tokens → Fine-grained tokens，建立僅能存取私人 `nlsc-signing` 的 token，Repository permissions 的 **Contents: Read and write**。記下 token；過期後需更新。
7. 回 `nlsc-generator` → Settings → Environments → 建立 `testflight` environment，並在此 environment 新增下表 Secrets 和 Variables。若手機版找不到選單，切換桌面網站。不要把密鑰貼到聊天、原始碼、Issue 或公開儲存庫。

### Environment Secrets

| 名稱 | 內容 |
| --- | --- |
| `ASC_KEY_ID` | Apple Team API Key 的 Key ID |
| `ASC_ISSUER_ID` | 同一組 Team API Key 的 Issuer ID |
| `ASC_KEY_P8` | `.p8` 檔完整文字，包含 BEGIN／END PRIVATE KEY 與換行；不用 Base64 |
| `MATCH_GIT_TOKEN` | 步驟 6 的私人簽署庫 GitHub token |
| `MATCH_PASSWORD` | 自訂長密碼，用來加密簽署庫；請保存，後續執行需相同密碼 |

手機若無法預覽 `.p8` 文字，可用支援純文字的本機編輯工具開啟。不要把私鑰上傳到線上轉檔網站。

### Environment Variables

| 名稱 | 範例 |
| --- | --- |
| `APPLE_TEAM_ID` | 自己的 10 碼 Team ID |
| `NLSC_BUNDLE_ID` | `tw.corry.nlsc.mobile`，需與 Apple 建立的記錄一致 |
| `MATCH_GIT_URL` | `https://github.com/Corry-Hsu/nlsc-signing.git`，需為私人 repo |

工作流程會先檢查簽署庫是否為 private，然後透過 fastlane match 將憑證及描述檔加密保存在該私人庫。私鑰不會輸出成公開 artifact；一般 `check` 編譯也不會接觸這些 secrets。

## C. 第一次產生簽署並上傳

1. Actions → **iOS Cloud Build** → Run workflow → `main` → mode 選 **bootstrap**。
2. 免簽署測試通過後，流程會建立 Apple Distribution 憑證及 App Store 描述檔、加密存至私人庫、編譯 IPA，並上傳 App Store Connect。這會使用你的 Apple 帳號建立新的簽署資產；不會撤銷既有憑證。
3. 到 App Store Connect → App → TestFlight 等候 Apple 處理。依提示填出口合規、測試資訊及測試人員；外部測試可能需 Beta App Review。上傳成功並不代表已可接受邀請。
4. 在 iPhone 安裝 [Apple TestFlight](https://testflight.apple.com/)，接受測試邀請再安裝。

此 App 僅使用系統 HTTPS，工程已設定不使用須另行申報的非豁免加密；提交時仍應核對 Apple 問卷與實際功能。

## D. 日後更新

修改原始碼並通過雲端 `check` 後，手動 Run workflow，mode 選 **testflight**。這會以唯讀方式取用現有簽署庫，不會重新建立憑證；每次 GitHub run 與 rerun 有不同 build number。需要更新憑證／描述檔時才再使用 bootstrap。

TestFlight 每個 build 最多可測試 90 天；到期前需重新上傳並安裝新 build。這不是永久免維護安裝。App Store 正式發布需另行完成 App Review 與商店資料。

## 常見失敗

- Missing settings：核對 environment 必須叫 `testflight`，並把 Secrets 與 Variables 分別放對位置。
- API authentication／permission：確認使用 Team API Key、Issuer ID、完整 p8；Apple 帳號已完成協議並有憑證管理權限。
- App not found：先在 App Store Connect 建 App，核對 Bundle ID。
- Cannot access signing repository：私人 repo 要有 main 分支，token 需存取該 repo 及 Contents 讀寫權限。
- readonly 找不到描述檔：首次應選 bootstrap；既有檔案到期後也需 bootstrap 修復。
- 憑證數量額滿：請在 Apple 帳號檢查自己的簽署資產，勿任意撤銷其他 App 使用的憑證。
- 一般編譯失敗：將 Actions 的失敗步驟與錯誤訊息提供給維護者，勿附私鑰或 token。

這份專案仍需實機驗收網站排版、地號查詢、面積與 PNG 內容，尤其 GPU 地圖圖層。設定雲端發布並不能代替實機測試。

參考：[fastlane match](https://docs.fastlane.tools/actions/match/)、[App Store Connect API](https://docs.fastlane.tools/app-store-connect-api/)、[Apple TestFlight](https://developer.apple.com/testflight/)。
