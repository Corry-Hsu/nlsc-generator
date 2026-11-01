const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup(options = {}) {
  let onAction, onMessage;
  const badges = [], sent = [];
  const tab = { id: 7, windowId: 1, url: 'https://maps.nlsc.gov.tw/T09/mapshow.action' };
  const chrome = {
    action: { onClicked: { addListener(cb) { onAction = cb; } }, async setBadgeText(m) { badges.push(m.text); }, async setBadgeBackgroundColor() {}, async setTitle() {} },
    tabs: { async sendMessage(id, m) { sent.push({ id, ...m }); }, async query() { return [{ id: options.otherTab ? 8 : 7 }]; }, async captureVisibleTab() { if (options.permissionError) throw Error("Either the '<all_urls>' or 'activeTab' permission is required."); if (options.otherError) throw Error('Capture failed'); return 'data:image/png;base64,test'; } },
    runtime: { onMessage: { addListener(cb) { onMessage = cb; } } },
    downloads: { async download() { return 4; } }
  };
  vm.runInNewContext(fs.readFileSync('background.js', 'utf8'), { chrome, console });
  return { badges, sent, click: () => onAction(tab), message: type => new Promise(resolve => onMessage({ type }, { tab, url: tab.url, frameId: 0 }, resolve)) };
}

test('工具列圖示直接通知目前網頁開始截圖，不預先顯示已授權', async () => {
  const s = setup();
  await s.click();
  assert.deepEqual(s.sent, [{ id: 7, type: 'nlsc-start-capture' }]);
  assert.deepEqual(s.badges, []);
});

test('權限預檢真正呼叫截圖但不回傳圖片，成功後才顯示 ON', async () => {
  const s = setup();
  const result = await s.message('nlsc-capture-check');
  assert.equal(result.ok, true);
  assert.equal(result.ready, true);
  assert.equal(result.dataUrl, undefined);
  assert.deepEqual(s.badges, ['ON']);
});

test('缺少 activeTab 時回覆具體授權入口，不顯示 ON', async () => {
  const s = setup({ permissionError: true });
  const result = await s.message('nlsc-capture-check');
  assert.equal(result.ok, false);
  assert.match(result.error, /擴充功能.*拼圖/);
  assert.match(result.error, /Alt\+Shift\+S/);
  assert.match(result.error, /網頁內的棕色按鈕無法/);
  assert.deepEqual(s.badges, ['!']);
});

test('其他截圖失敗不誤報為權限問題', async () => {
  const s = setup({ otherError: true });
  const result = await s.message('nlsc-capture-check');
  assert.equal(result.ok, false);
  assert.match(result.error, /瀏覽器截圖失敗：Capture failed/);
});

test('非前景分頁不執行截圖', async () => {
  const s = setup({ otherTab: true });
  const result = await s.message('nlsc-capture-check');
  assert.equal(result.ok, false);
  assert.match(result.error, /前景/);
});
