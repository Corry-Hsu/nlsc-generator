const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const out = path.resolve(__dirname, '../NLSCMobile/Resources');
fs.mkdirSync(out, { recursive: true });
let source = fs.readFileSync(path.join(root, 'content.js'), 'utf8');
const marker = '      let x = `<?xml version="1.0"';
if (!source.includes(marker)) throw Error('原始匯出程式已變更，請更新同步腳本');
source = source.replace(marker, `      if (win.NLSCiOS) {
        const xml = \`<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\${sh("逐筆結果", a)}\${sh("清單加總", sum(a))}</Workbook>\`;
        return win.NLSCiOS.exportFile(xml, f);
      }
` + marker);
source = source.replace("document.getElementById('btn-export-excel').onclick = () => {", "document.getElementById('btn-export-excel').onclick = async () => {")
  .replace('        win.nlsc.exportAreaExcel();', '        await win.nlsc.exportAreaExcel();')
  .replace('Excel 檔案已成功下載', 'Excel 已儲存，請點 App 上方「檔案」')
  .replace('首次截圖：點瀏覽器右上角拼圖 → NLSC 測繪自動化小工具，或按 Alt+Shift+S，即授權並開始。每行清單一張，同地段不同行分開處理，截圖時保持此分頁在前景。', '每行清單一張 PNG，同地段不同行分開處理。請保持 App 在前景，完成後點上方「檔案」分享或儲存。建議橫向操作。')
  .replace('，請查看瀏覽器下載紀錄', '，請點 App 上方「檔案」')
  .replace(' (按 Alt+Q 可召回此視窗)', '｜上方「面板」可召回');
fs.writeFileSync(path.join(out, 'content.js'), source);
fs.copyFileSync(path.join(root, 'capture-geometry.js'), path.join(out, 'capture-geometry.js'));
console.log('已同步桌面查詢核心與 iOS 匯出介面');
