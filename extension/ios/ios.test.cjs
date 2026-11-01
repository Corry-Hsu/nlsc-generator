const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const resources = path.join(__dirname, 'NLSCMobile/Resources');
function bridge({ visible = true, same = true, native = async () => ({ ok: true }), origin = 'https://maps.nlsc.gov.tw' } = {}) {
  const handlers = [], replies = [], calls = [];
  const window = {
    webkit: { messageHandlers: { nlsc: { postMessage: async m => { calls.push(m); return native(m); } } } },
    NLSCCaptureGeometry: { viewport: () => ({}), sameViewport: () => same, sameRect: () => true, clipRect: r => r },
    addEventListener: (_, callback) => handlers.push(callback), postMessage: m => replies.push(m)
  };
  vm.runInNewContext(fs.readFileSync(path.join(resources, 'ios-bridge.js'), 'utf8'), {
    window, location: { origin, pathname: '/T09/mapshow.action' }, document: { visibilityState: visible ? 'visible' : 'hidden' }
  });
  return { window, calls, replies, send: (m, source = window) => Promise.all(handlers.map(h => h({ source, origin, data: { type: 'nlsc-save-map', id: 'a', ...m } }))) };
}
test('iOS 截圖只送座標與檔名給原生層，不回傳圖片像素', async () => {
  const b = bridge();
  await b.send({ rect: { x: 0 }, filename: '地號.png' });
  assert.equal(b.calls[0].type, 'capture');
  assert.equal(b.calls[0].filename, '地號.png');
  assert.equal(b.replies[0].ok, true);
  assert.equal(b.replies[0].dataUrl, undefined);
});
test('背景或畫面改變時拒絕截圖', async () => {
  for (const options of [{ visible: false }, { same: false }]) {
    const b = bridge(options); await b.send({ rect: {} });
    assert.equal(b.calls.length, 0); assert.equal(b.replies[0].ok, false);
  }
});
test('儲存失敗會回覆錯誤，並可重新操作', async () => {
  const b = bridge({ native: async () => { throw Error('空間不足'); } });
  await b.send({ rect: {} }); await b.send({ rect: {} });
  assert.equal(b.calls.length, 2);
  assert.equal(b.replies[1].error, '空間不足');
});
test('拒絕跨視窗訊息與非目標網站', async () => {
  const b = bridge(); await b.send({}, {}); assert.equal(b.calls.length, 0);
  const other = bridge({ origin: 'https://example.com' });
  assert.equal(other.window.NLSCiOS, undefined);
});
test('同步的手機核心透過原生介面匯出原版兩張工作表', async () => {
  let source = fs.readFileSync(path.join(resources, 'content.js'), 'utf8');
  source = source.slice(source.indexOf('    exportAreaExcel('), source.indexOf('\n    TOWNS:'));
  let exported;
  const win = { nlscAreaResults: [{ 地號: '477', '面積(㎡)': 12 }], NLSCiOS: { exportFile: async (text, filename) => { exported = { text, filename }; } } };
  const api = vm.runInNewContext('({' + source + '})', { win, sh: (name, rows) => `<Worksheet name="${name}">${rows.length}</Worksheet>`, sum: a => a });
  await api.exportAreaExcel();
  assert.equal(exported.filename, 'nlsc-area-results.xml');
  assert.match(exported.text, /逐筆結果/); assert.match(exported.text, /清單加總/);
});
