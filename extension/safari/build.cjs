const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
let core = read('ios/NLSCMobile/Resources/content.js');
core = core.replace('依清單逐行截圖 PNG', '逐行取景（手動截圖）')
  .replace('每行清單一張 PNG，同地段不同行分開處理。請保持 App 在前景，完成後點上方「檔案」分享或儲存。建議橫向操作。', 'Safari 版會逐行取景；每張需自行按 iPhone 截圖鍵。Excel 請從匯出視窗下載或分享。建議橫向操作。')
  .replace('Excel 已儲存，請點 App 上方「檔案」', 'Excel 已準備好，請在匯出視窗下載或分享')
  .replace('`已送出 ${count} 張 PNG 下載，請點 App 上方「檔案」`', '`已完成 ${count} 組取景；手動截圖請至「相片」查看`')
  .replace('已送出 ${completed}/${groups.size} 張下載；', '已確認 ${completed}/${groups.size} 組手動截圖；')
  .replace('｜上方「面板」可召回', '｜右下角「面板」可召回')
  .replace('截圖逾時，請重新載入外掛與網頁', '等待手動截圖超過 10 分鐘，已停止並還原地圖')
  .replace("finish('等待手動截圖超過 10 分鐘，已停止並還原地圖'), 30000)", "finish('等待手動截圖超過 10 分鐘，已停止並還原地圖'), 600000)");
const header = `// ==UserScript==
// @name         NLSC 地號與面積助手（iPhone Safari）
// @namespace    https://github.com/Corry-Hsu/nlsc-generator
// @version      1.2.0
// @description  批次查地號、擷取面積、Excel XML 匯出及逐行手動截圖取景
// @match        https://maps.nlsc.gov.tw/T09/mapshow.action*
// @run-at       document-end
// @inject-into  page
// @noframes
// ==/UserScript==
`;
const parts = [read('capture-geometry.js'), read('safari/adapter.js'), core, read('ios/NLSCMobile/Resources/mobile-ui.js')];
const output = header + '\n(() => {\nif (location.origin !== "https://maps.nlsc.gov.tw" || location.pathname !== "/T09/mapshow.action" || window.__nlscSafariLoaded) return;\nwindow.__nlscSafariLoaded = true;\n' + parts.join('\n;\n') + '\n})();\n';
fs.writeFileSync(path.join(__dirname, 'nlsc-mobile.user.js'), output);
console.log('已產生 Safari 單檔 userscript');
