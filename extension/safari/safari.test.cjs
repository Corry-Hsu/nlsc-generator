const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function setup() {
  const elements = [], listeners = {}, timers = new Map(), replies = [];
  let timerId = 0;
  const make = tag => {
    const el = { tag, style: { removeProperty(key) { delete this[key]; } }, children: [], append(...items) { this.children.push(...items); }, remove() { this.removed = true; } };
    elements.push(el); return el;
  };
  const document = { visibilityState: 'visible', createElement: make, body: make('body'),
    getElementById: id => elements.find(el => el.id === id && !el.removed),
    addEventListener: (type, cb) => { listeners[type] = cb; } };
  let same = true;
  const window = {
    addEventListener: (type, cb) => { listeners[type] = cb; }, postMessage: message => replies.push(message),
    NLSCCaptureGeometry: { viewport: () => ({}), sameViewport: () => same, sameRect: () => true, clipRect: r => r }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'adapter.js'), 'utf8'), {
    window, document, location: { origin: 'https://maps.nlsc.gov.tw' }, navigator: {}, Blob, File,
    URL: { createObjectURL: () => 'blob:export', revokeObjectURL() {} }, confirm: () => true,
    setTimeout: (cb, ms) => { timers.set(++timerId, { cb, ms }); return timerId; }, clearTimeout: id => timers.delete(id)
  });
  return { document, window, replies, timers, elements,
    click: label => elements.find(el => el.textContent === label && !el.removed).onclick(),
    send: (data, source = window) => listeners.message({ source, origin: 'https://maps.nlsc.gov.tw', data: { id: 'capture-1', type: 'nlsc-save-map', filename: '地號.png', rect: {}, viewport: {}, ...data } }),
    background: () => { document.visibilityState = 'hidden'; listeners.visibilitychange(); },
    changeViewport: () => { same = false; }, resize: () => listeners.resize()
  };
}
test('Safari 取景不假裝已儲存，必須由使用者確認下一張', () => {
  const s = setup(); s.send();
  assert.equal(s.replies.length, 0);
  s.click('已截圖，下一張');
  assert.equal(s.replies[0].ok, true);
  assert.equal(s.document.getElementById('nlsc-safari-capture'), undefined);
  assert.equal(s.timers.size, 0);
});
test('Safari 停止、逾時及背景切換回覆失敗並清除控制器', () => {
  for (const action of [s => s.click('停止並還原地圖'), s => s.background(), s => s.resize(), s => [...s.timers.values()][0].cb()]) {
    const s = setup(); s.send(); action(s);
    assert.equal(s.replies[0].ok, false);
    assert.equal(s.document.getElementById('nlsc-safari-capture'), undefined);
    assert.equal(s.timers.size, 0);
  }
});
test('畫面變更拒絕繼續，忙碌時拒絕另一個請求', () => {
  const s = setup(); s.send(); s.send({ id: 'second' });
  assert.equal(s.replies[0].ok, false); assert.equal(s.replies[0].id, 'second');
  s.changeViewport(); s.click('已截圖，下一張'); assert.equal(s.replies[1].ok, false);
});
test('隱藏提示期間也隱藏召回鍵，停止時還原', () => {
  const s = setup(); s.send(); s.click('隱藏提示 5 秒');
  assert.equal(s.document.getElementById('nlsc-safari-capture').style.visibility, 'hidden');
  assert.equal(s.document.getElementById('nlsc-safari-recall').style.visibility, 'hidden');
  s.background(); assert.equal(s.document.getElementById('nlsc-safari-recall').style.visibility, undefined);
});
test('Excel 產生可下載的檔案連結，等待使用者點擊', async () => {
  const s = setup(); await s.window.NLSCiOS.exportFile('<Workbook/>', 'nlsc-area-results.xml');
  const link = s.elements.find(el => el.tag === 'a');
  assert.equal(link.download, 'nlsc-area-results.xml'); assert.equal(link.href, 'blob:export');
});
test('組合腳本指定 page 執行、拒絕重複載入，並延長手動截圖等待', () => {
  const source = fs.readFileSync(path.join(__dirname, 'nlsc-mobile.user.js'), 'utf8');
  assert.match(source, /@inject-into\s+page/);
  assert.match(source, /window\.__nlscSafariLoaded/);
  assert.match(source, /finish\('等待手動截圖超過 10 分鐘，已停止並還原地圖'\), 600000/);
  assert.match(source, /已完成 \$\{count\} 組取景/);
  assert.doesNotMatch(source, /chrome\.(?:tabs|runtime|downloads)/);
});
